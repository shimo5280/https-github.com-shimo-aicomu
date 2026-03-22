import os
import io
import re
import base64
import mimetypes
import traceback
from urllib.request import urlopen

from flask import Flask, request, jsonify, render_template
from openai import OpenAI
import replicate


app = Flask(__name__, static_folder="static", template_folder="templates")


# =========================
# 環境変数
# =========================
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()

OPENAI_TEXT_MODEL = os.environ.get("OPENAI_TEXT_MODEL", "gpt-4o-mini").strip()

# Replicate のモデル名を環境変数で入れる
# 例:
# REPLICATE_GENERATE_MODEL=black-forest-labs/flux-schnell
# REPLICATE_EDIT_MODEL=black-forest-labs/flux-kontext-pro
REPLICATE_GENERATE_MODEL = os.environ.get("REPLICATE_GENERATE_MODEL", "").strip()
REPLICATE_EDIT_MODEL = os.environ.get("REPLICATE_EDIT_MODEL", "").strip()

# モデルによって入力キーが違うので環境変数で変えられるようにする
REPLICATE_GENERATE_PROMPT_KEY = os.environ.get("REPLICATE_GENERATE_PROMPT_KEY", "prompt").strip()
REPLICATE_EDIT_IMAGE_KEY = os.environ.get("REPLICATE_EDIT_IMAGE_KEY", "image").strip()
REPLICATE_EDIT_PROMPT_KEY = os.environ.get("REPLICATE_EDIT_PROMPT_KEY", "prompt").strip()

if REPLICATE_API_TOKEN:
    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


# =========================
# 共通関数
# =========================
def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def to_b64(binary: bytes) -> str:
    return base64.b64encode(binary).decode("utf-8")


def guess_mime(filename: str, fallback: str = "image/png") -> str:
    mime, _ = mimetypes.guess_type(filename or "")
    return mime or fallback


def read_replicate_output(output) -> bytes:
    if isinstance(output, (list, tuple)):
        if not output:
            raise RuntimeError("Replicate の出力が空です")
        output = output[0]

    if hasattr(output, "read"):
        data = output.read()
        if not data:
            raise RuntimeError("Replicate 出力の読み込みに失敗しました")
        return data

    if isinstance(output, str):
        with urlopen(output) as res:
            data = res.read()
            if not data:
                raise RuntimeError("Replicate 出力URLの読み込みに失敗しました")
            return data

    raise RuntimeError(f"未対応の Replicate 出力形式です: {type(output)}")


def build_chat_reply(user_message: str) -> str:
    user_message = clean_text(user_message)

    if not user_message:
        return "入力が空です。"

    if not client:
        return f"受け取った内容: {user_message}"

    resp = client.chat.completions.create(
        model=OPENAI_TEXT_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "あなたは親しみやすく簡潔な日本語アシスタントです。"
                    "長すぎず、自然に返答してください。"
                ),
            },
            {"role": "user", "content": user_message},
        ],
        temperature=0.7,
    )

    text = ""
    if resp.choices and resp.choices[0].message:
        text = resp.choices[0].message.content or ""

    return clean_text(text) or "うまく返答を作れませんでした。"


def build_edit_prompt(user_prompt: str, current_prompt: str = "", detail: str = "") -> str:
    user_prompt = clean_text(user_prompt)
    current_prompt = clean_text(current_prompt)
    detail = clean_text(detail)

    if not user_prompt and not current_prompt and not detail:
        return ""

    if not client:
        parts = []
        if current_prompt:
            parts.append(f"元の内容: {current_prompt}")
        if user_prompt:
            parts.append(f"修正: {user_prompt}")
        if detail:
            parts.append(f"補足: {detail}")
        return " / ".join(parts)

    resp = client.chat.completions.create(
        model=OPENAI_TEXT_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "あなたは画像生成・画像編集用のプロンプト整理アシスタントです。"
                    "ユーザーの意図を保ったまま、短く実用的な日本語の指示文だけを返してください。"
                    "前置きや説明は不要です。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"元のプロンプト: {current_prompt or 'なし'}\n"
                    f"今回の指示: {user_prompt or 'なし'}\n"
                    f"補足: {detail or 'なし'}"
                ),
            },
        ],
        temperature=0.4,
    )

    text = ""
    if resp.choices and resp.choices[0].message:
        text = resp.choices[0].message.content or ""

    text = clean_text(text)

    if not text:
        parts = []
        if current_prompt:
            parts.append(f"元の内容: {current_prompt}")
        if user_prompt:
            parts.append(f"修正: {user_prompt}")
        if detail:
            parts.append(f"補足: {detail}")
        text = " / ".join(parts)

    return text


def run_replicate_generate(prompt: str) -> bytes:
    prompt = clean_text(prompt)

    if not REPLICATE_API_TOKEN:
        raise RuntimeError("REPLICATE_API_TOKEN が未設定です")

    if not REPLICATE_GENERATE_MODEL:
        raise RuntimeError("REPLICATE_GENERATE_MODEL が未設定です")

    if not prompt:
        raise RuntimeError("生成プロンプトが空です")

    model_input = {
        REPLICATE_GENERATE_PROMPT_KEY: prompt
    }

    output = replicate.run(REPLICATE_GENERATE_MODEL, input=model_input)
    return read_replicate_output(output)


def run_replicate_edit(image_bytes: bytes, filename: str, prompt: str) -> bytes:
    prompt = clean_text(prompt)

    if not REPLICATE_API_TOKEN:
        raise RuntimeError("REPLICATE_API_TOKEN が未設定です")

    if not REPLICATE_EDIT_MODEL:
        raise RuntimeError("REPLICATE_EDIT_MODEL が未設定です")

    if not image_bytes:
        raise RuntimeError("画像データが空です")

    if not prompt:
        raise RuntimeError("修正プロンプトが空です")

    file_obj = io.BytesIO(image_bytes)
    file_obj.name = filename or "input.png"

    model_input = {
        REPLICATE_EDIT_IMAGE_KEY: file_obj,
        REPLICATE_EDIT_PROMPT_KEY: prompt,
    }

    output = replicate.run(REPLICATE_EDIT_MODEL, input=model_input)
    return read_replicate_output(output)


# =========================
# ルート
# =========================
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(silent=True) or {}
        message = clean_text(data.get("message") or data.get("prompt") or "")

        if not message:
            return jsonify({
                "ok": False,
                "message": "message が空です"
            }), 400

        reply = build_chat_reply(message)

        return jsonify({
            "ok": True,
            "reply": reply
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": f"chat エラー: {str(e)}"
        }), 500


@app.route("/api/edit_summary", methods=["POST"])
def edit_summary():
    try:
        data = request.get_json(silent=True) or {}

        prompt = clean_text(data.get("prompt") or data.get("user_prompt") or data.get("edit_prompt") or "")
        current_prompt = clean_text(data.get("current_prompt") or data.get("base_prompt") or "")
        detail = clean_text(data.get("detail") or "")

        final_prompt = build_edit_prompt(
            user_prompt=prompt,
            current_prompt=current_prompt,
            detail=detail
        )

        return jsonify({
            "ok": True,
            "final_prompt": final_prompt
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": f"edit_summary エラー: {str(e)}"
        }), 500


@app.route("/api/generate_image", methods=["POST"])
def generate_image():
    try:
        data = request.get_json(silent=True) or {}

        prompt = clean_text(data.get("prompt") or "")
        detail = clean_text(data.get("detail") or "")
        current_prompt = clean_text(data.get("current_prompt") or "")

        final_prompt = build_edit_prompt(
            user_prompt=prompt,
            current_prompt=current_prompt,
            detail=detail
        ) if (detail or current_prompt) else prompt

        if not final_prompt:
            return jsonify({
                "ok": False,
                "message": "prompt が空です"
            }), 400

        image_bytes = run_replicate_generate(final_prompt)

        return jsonify({
            "ok": True,
            "image_b64": to_b64(image_bytes),
            "mime": "image/png",
            "final_prompt": final_prompt
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": f"generate_image エラー: {str(e)}"
        }), 500


@app.route("/api/edit_image", methods=["POST"])
def edit_image():
    try:
        image_file = request.files.get("image")
        prompt = clean_text(request.form.get("prompt") or request.form.get("final_prompt") or "")
        detail = clean_text(request.form.get("detail") or "")
        current_prompt = clean_text(request.form.get("current_prompt") or "")

        if image_file is None:
            return jsonify({
                "ok": False,
                "message": "image が送られていません"
            }), 400

        final_prompt = build_edit_prompt(
            user_prompt=prompt,
            current_prompt=current_prompt,
            detail=detail
        ) if (detail or current_prompt) else prompt

        if not final_prompt:
            return jsonify({
                "ok": False,
                "message": "prompt が空です"
            }), 400

        filename = image_file.filename or "input.png"
        image_bytes = image_file.read()

        if not image_bytes:
            return jsonify({
                "ok": False,
                "message": "画像の読み込みに失敗しました"
            }), 400

        edited_bytes = run_replicate_edit(
            image_bytes=image_bytes,
            filename=filename,
            prompt=final_prompt
        )

        return jsonify({
            "ok": True,
            "image_b64": to_b64(edited_bytes),
            "mime": guess_mime(filename),
            "final_prompt": final_prompt
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": f"edit_image エラー: {str(e)}"
        }), 500