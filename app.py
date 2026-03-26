import os
import base64
import traceback
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template
from openai import OpenAI

load_dotenv()

app = Flask(__name__)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
client = OpenAI(api_key=OPENAI_API_KEY)

ACCESS_CODE = "AICOMU2026"

# =========================
# 制限
# 1人1日1回
# 全体30回まで
# =========================
TOTAL_LIMIT = 30
total_count = 0
user_usage = {}


def check_access(code):
    return (code or "").strip() == ACCESS_CODE


def require_openai_key():
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY が設定されていません")


def check_daily_limit(user_id: str) -> bool:
    today = datetime.now().date()

    if user_id not in user_usage:
        user_usage[user_id] = {
            "date": today,
            "count": 0,
        }

    if user_usage[user_id]["date"] != today:
        user_usage[user_id] = {
            "date": today,
            "count": 0,
        }

    if user_usage[user_id]["count"] >= 1:
        return False

    user_usage[user_id]["count"] += 1
    return True


def check_total_limit() -> bool:
    global total_count

    if total_count >= TOTAL_LIMIT:
        return False

    total_count += 1
    return True


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


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/generate_summary", methods=["POST"])
def generate_summary():
    try:
        data = request.get_json(silent=True) or {}

        if not check_access(data.get("code")):
            return jsonify({"ok": False, "message": "コードが違うよ🐾"})

        purpose = (data.get("purpose") or "").strip()
        style = (data.get("style") or "").strip()
        image_type = (data.get("image_type") or "").strip()

        user_text = (
            f"用途: {purpose}\n"
            f"主役: {style}\n"
            f"仕上がり: {image_type}\n\n"
            "この内容をわかりやすく1文でまとめて、最後に短いアドバイスも付けてください。"
        )

        system_text = (
            "あなたはやさしく案内するAIです。"
            "日本語で簡潔に、まとめとアドバイスを返してください。"
            "返答は以下の形式にしてください。\n"
            "まとめ: ...\n"
            "アドバイス: ..."
        )

        text = chat_reply(system_text, user_text)

        summary = ""
        advice = ""

        for line in text.splitlines():
            line = line.strip()
            if line.startswith("まとめ:"):
                summary = line.replace("まとめ:", "", 1).strip()
            elif line.startswith("アドバイス:"):
                advice = line.replace("アドバイス:", "", 1).strip()

        if not summary:
            summary = text.strip()

        if not advice:
            advice = "少し具体的にすると良いよ🐾"

        return jsonify({
            "ok": True,
            "summary": summary,
            "advice": advice
        })

    except Exception:
        print(traceback.format_exc())
        return jsonify({"ok": False, "message": "まとめの作成でエラーが起きたよ🐾"})


@app.route("/api/generate_image", methods=["POST"])
def generate_image():
    try:
        data = request.get_json(silent=True) or {}

        if not check_access(data.get("code")):
            return jsonify({"ok": False, "message": "コードが違うよ🐾"})

        user_id = request.remote_addr or "unknown"

        if not check_daily_limit(user_id):
            return jsonify({"ok": False, "message": "今日はもう使ったよ🐾"})

        if not check_total_limit():
            return jsonify({"ok": False, "message": "上限に達したよ🐾"})

        prompt = (data.get("prompt") or "").strip()
        if not prompt:
            return jsonify({"ok": False, "message": "プロンプトが空だよ🐾"})

        image_b64 = generate_image_base64(prompt)

        return jsonify({
            "ok": True,
            "message": "お待たせ、画像を生成したよ🐾",
            "image_b64": image_b64
        })

    except Exception:
        print(traceback.format_exc())
        return jsonify({"ok": False, "message": "画像生成でエラーが起きたよ🐾"})


@app.route("/api/edit_image", methods=["POST"])
def edit_image():
    try:
        data = request.get_json(silent=True) or {}

        if not check_access(data.get("code")):
            return jsonify({"ok": False, "message": "コードが違うよ🐾"})

        user_id = request.remote_addr or "unknown"

        if not check_daily_limit(user_id):
            return jsonify({"ok": False, "message": "今日はもう使ったよ🐾"})

        if not check_total_limit():
            return jsonify({"ok": False, "message": "上限に達したよ🐾"})

        prompt = (data.get("prompt") or "").strip()
        image_b64 = (data.get("image_b64") or "").strip()
        image_b64_2 = (data.get("image_b64_2") or "").strip()

        print("prompt exists:", bool(prompt))
        print("image_b64 length:", len(image_b64) if image_b64 else 0)
        print("image_b64_2 length:", len(image_b64_2) if image_b64_2 else 0)

        if not prompt:
            return jsonify({"ok": False, "message": "修正内容が空だよ🐾"})

        if not image_b64 and not image_b64_2:
            return jsonify({"ok": False, "message": "画像が送られていないよ🐾"})

        result_b64 = edit_image_base64(prompt, image_b64, image_b64_2)

        return jsonify({
            "ok": True,
            "message": "お待たせ、画像を修正したよ🐾",
            "image_b64": result_b64
        })

    except Exception:
        print(traceback.format_exc())
        return jsonify({"ok": False, "message": "画像修正でエラーが起きたよ🐾"})


if __name__ == "__main__":
    app.run(debug=True)