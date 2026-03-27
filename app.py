import os
import traceback
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template
from openai import OpenAI

load_dotenv()

app = Flask(__name__)

OPENAI_API_KEY = (os.environ.get("OPENAI_API_KEY") or "").strip()
ACCESS_CODE = (os.environ.get("ACCESS_CODE") or "AICOMU2026").strip()

client = OpenAI(api_key=OPENAI_API_KEY)


# =========================
# 共通
# =========================
def check_access(code: str) -> bool:
    return (code or "").strip() == ACCESS_CODE


def require_openai_key():
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY が設定されていません")


def safe_json():
    return request.get_json(silent=True) or {}


# =========================
# OpenAIまとめ
# =========================
def chat_reply(system_text: str, user_text: str) -> str:
    require_openai_key()

    response = client.responses.create(
        model="gpt-4.1-mini",
        input=[
            {"role": "system", "content": system_text},
            {"role": "user", "content": user_text},
        ],
    )
    return response.output_text.strip()


def summarize_a(purpose: str, subject: str, image_type: str, extra: str = ""):
    user_text = (
        f"用途: {purpose}\n"
        f"主役: {subject}\n"
        f"仕上がり: {image_type}\n"
        f"追加: {extra}\n\n"
        "この内容を日本語でわかりやすく整理してください。"
    )

    system_text = (
        "あなたはやさしく案内するAIです。"
        "日本語で以下の形式で返してください。\n"
        "summary: 1〜3行で整理\n"
        "advice: 1行で短い助言\n"
    )

    text = chat_reply(system_text, user_text)

    summary = ""
    advice = ""

    for line in text.splitlines():
        line = line.strip()
        if line.startswith("summary:"):
            summary = line.replace("summary:", "", 1).strip()
        elif line.startswith("advice:"):
            advice = line.replace("advice:", "", 1).strip()

    if not summary:
        summary = text.strip()
    if not advice:
        advice = "もう少し具体的にすると狙いが伝わりやすいよ🐾"

    return summary, advice


def summarize_b(request_text: str, keep: str, background: str, mood: str, finish: str):
    user_text = (
        f"やりたいこと: {request_text}\n"
        f"変えたくない部分: {keep}\n"
        f"背景: {background}\n"
        f"雰囲気: {mood}\n"
        f"仕上がり: {finish}\n\n"
        "この内容を日本語で整理し、短い助言をつけ、最後に画像編集用の英語プロンプトを作ってください。"
    )

    system_text = (
        "あなたは画像編集アシスタントです。"
        "以下の形式で返してください。\n"
        "summary: 日本語で整理\n"
        "advice: 日本語で短い助言\n"
        "prompt: 英語の画像編集プロンプト\n"
        "prompt では、顔は変えない・不要な変更をしない・指定部分だけ編集する方針を自然に含めてください。"
    )

    text = chat_reply(system_text, user_text)

    summary = ""
    advice = ""
    prompt = ""

    for line in text.splitlines():
        line = line.strip()
        if line.startswith("summary:"):
            summary = line.replace("summary:", "", 1).strip()
        elif line.startswith("advice:"):
            advice = line.replace("advice:", "", 1).strip()
        elif line.startswith("prompt:"):
            prompt = line.replace("prompt:", "", 1).strip()

    if not summary:
        summary = text.strip()
    if not advice:
        advice = "自然さを優先するとまとまりやすいよ🐾"
    if not prompt:
        prompt = (
            f"Edit the image naturally. Main request: {request_text}. "
            f"Do not change: {keep or 'face and important identity details'}. "
            f"Background: {background}. Mood: {mood}. Finish: {finish}. "
            f"Only edit the requested parts. Keep the face unchanged. No unnecessary changes."
        )

    return summary, advice, prompt


# =========================
# 画像生成 / 修正
# 復旧優先で OpenAI 実行版
# 後で Replicate に戻すならこの2関数だけ差し替え
# =========================
def generate_image_base64(prompt: str) -> str:
    require_openai_key()

    result = client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size="1024x1024"
    )
    return result.data[0].b64_json


def edit_image_base64(prompt: str, image_b64: str, image_b64_2: str = "") -> str:
    require_openai_key()

    input_images = []
    if image_b64:
        input_images.append(image_b64)
    if image_b64_2:
        input_images.append(image_b64_2)

    if not input_images:
        raise RuntimeError("画像データが送られていません")

    result = client.images.edit(
        model="gpt-image-1",
        image=input_images,
        prompt=prompt,
        size="1024x1024"
    )
    return result.data[0].b64_json


# =========================
# ルート
# =========================
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/generate_summary_a", methods=["POST"])
def generate_summary_a():
    try:
        data = safe_json()

        if not check_access(data.get("code")):
            return jsonify({"ok": False, "message": "コードが違うよ🐾"}), 400

        purpose = (data.get("purpose") or "").strip()
        subject = (data.get("subject") or "").strip()
        image_type = (data.get("image_type") or "").strip()
        extra = (data.get("extra") or "").strip()

        summary, advice = summarize_a(purpose, subject, image_type, extra)

        return jsonify({
            "ok": True,
            "summary": summary,
            "advice": advice
        })

    except Exception as e:
        print("ERROR /api/generate_summary_a")
        print(str(e))
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": "Aのまとめでエラーが起きたよ🐾",
            "error": str(e)
        }), 500


@app.route("/api/generate_summary_b", methods=["POST"])
def generate_summary_b():
    try:
        data = safe_json()

        if not check_access(data.get("code")):
            return jsonify({"ok": False, "message": "コードが違うよ🐾"}), 400

        request_text = (data.get("request") or "").strip()
        keep = (data.get("keep") or "").strip()
        background = (data.get("background") or "").strip()
        mood = (data.get("mood") or "").strip()
        finish = (data.get("finish") or "").strip()

        summary, advice, prompt = summarize_b(
            request_text=request_text,
            keep=keep,
            background=background,
            mood=mood,
            finish=finish
        )

        return jsonify({
            "ok": True,
            "summary": summary,
            "advice": advice,
            "english_prompt": prompt
        })

    except Exception as e:
        print("ERROR /api/generate_summary_b")
        print(str(e))
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": "Bのまとめでエラーが起きたよ🐾",
            "error": str(e)
        }), 500


@app.route("/api/generate_image", methods=["POST"])
def generate_image():
    try:
        data = safe_json()

        if not check_access(data.get("code")):
            return jsonify({"ok": False, "message": "コードが違うよ🐾"}), 400

        prompt = (data.get("prompt") or "").strip()

        print("=== /api/generate_image ===")
        print("prompt exists:", bool(prompt))
        print("prompt:", prompt)

        if not prompt:
            return jsonify({"ok": False, "message": "プロンプトが空だよ🐾"}), 400

        image_b64 = generate_image_base64(prompt)

        return jsonify({
            "ok": True,
            "message": "お待たせ、画像を生成したよ🐾",
            "image_b64": image_b64
        })

    except Exception as e:
        print("ERROR /api/generate_image")
        print(str(e))
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": "画像生成でエラーが起きたよ🐾",
            "error": str(e)
        }), 500


@app.route("/api/edit_image", methods=["POST"])
def edit_image():
    try:
        data = safe_json()

        if not check_access(data.get("code")):
            return jsonify({"ok": False, "message": "コードが違うよ🐾"}), 400

        prompt = (data.get("prompt") or "").strip()
        image_b64 = (data.get("image_b64") or "").strip()
        image_b64_2 = (data.get("image_b64_2") or "").strip()

        print("=== /api/edit_image ===")
        print("prompt exists:", bool(prompt))
        print("prompt:", prompt)
        print("image_b64 length:", len(image_b64) if image_b64 else 0)
        print("image_b64_2 length:", len(image_b64_2) if image_b64_2 else 0)

        if not prompt:
            return jsonify({"ok": False, "message": "修正内容が空だよ🐾"}), 400

        if not image_b64 and not image_b64_2:
            return jsonify({"ok": False, "message": "画像が送られていないよ🐾"}), 400

        result_b64 = edit_image_base64(prompt, image_b64, image_b64_2)

        return jsonify({
            "ok": True,
            "message": "お待たせ、画像を修正したよ🐾",
            "image_b64": result_b64
        })

    except Exception as e:
        print("ERROR /api/edit_image")
        print(str(e))
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": "画像修正でエラーが起きたよ🐾",
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(debug=True)