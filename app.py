import os
import io
import re
import base64
import traceback
from urllib.request import urlopen

from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI
import replicate


app = Flask(__name__, static_folder="static", template_folder="templates")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()

# OpenAI は文章整理だけで使う
OPENAI_TEXT_MODEL = os.environ.get("OPENAI_TEXT_MODEL", "gpt-4o-mini").strip()

# Replicate の画像編集モデル名を入れる
# 例: black-forest-labs/flux-kontext-pro
REPLICATE_EDIT_MODEL = os.environ.get("REPLICATE_EDIT_MODEL", "").strip()

# モデルによって入力キー名が違うことがあるので環境変数で変えられるようにする
REPLICATE_IMAGE_INPUT_KEY = os.environ.get("REPLICATE_IMAGE_INPUT_KEY", "image").strip()
REPLICATE_PROMPT_INPUT_KEY = os.environ.get("REPLICATE_PROMPT_INPUT_KEY", "prompt").strip()

if REPLICATE_API_TOKEN:
    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


@app.route("/")
def index():
    return send_from_directory("templates", "index.html")


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def to_b64(binary: bytes) -> str:
    return base64.b64encode(binary).decode("utf-8")


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


def build_edit_prompt(user_prompt: str, current_prompt: str = "", detail: str = "") -> str:
    user_prompt = clean_text(user_prompt)
    current_prompt = clean_text(current_prompt)
    detail = clean_text(detail)

    if not user_prompt and not current_prompt and not detail:
        raise ValueError("修正内容が空です")

    if not client:
        parts = []
        if current_prompt:
            parts.append(f"元の意図: {current_prompt}")
        if user_prompt:
            parts.append(f"今回の修正: {user_prompt}")
        if detail:
            parts.append(f"補足: {detail}")
        return " / ".join(parts)

    system_text = (
        "あなたは画像編集用のプロンプト整理アシスタントです。"
        "ユーザーの意図を保ったまま、短く実用的な日本語の編集指示に整えてください。"
        "前置きや説明は書かず、最終プロンプト本文だけを返してください。"
    )

    user_text = (
        f"元のプロンプト: {current_prompt or 'なし'}\n"
        f"今回の修正指示: {user_prompt or 'なし'}\n"
        f"補足: {detail or 'なし'}"
    )

    resp = client.chat.completions.create(
        model=OPENAI_TEXT_MODEL,
        messages=[
            {"role": "system", "content": system_text},
            {"role": "user", "content": user_text},
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
            parts.append(f"元の意図: {current_prompt}")
        if user_prompt:
            parts.append(f"今回の修正: {user_prompt}")
        if detail:
            parts.append(f"補足: {detail}")
        text = " / ".join(parts)

    return text


def run_replicate_edit(image_bytes: bytes, filename: str, prompt: str) -> bytes:
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
        REPLICATE_IMAGE_INPUT_KEY: file_obj,
        REPLICATE_PROMPT_INPUT_KEY: prompt,
    }

    output = replicate.run(REPLICATE_EDIT_MODEL, input=model_input)
    return read_replicate_output(output)


@app.route("/api/edit_summary", methods=["POST"])
def edit_summary():
    try:
        data = request.get_json(silent=True) or {}

        user_prompt = data.get("prompt") or data.get("user_prompt") or data.get("edit_prompt") or ""
        current_prompt = data.get("current_prompt") or data.get("base_prompt") or ""
        detail = data.get("detail") or ""

        final_prompt = build_edit_prompt(
            user_prompt=user_prompt,
            current_prompt=current_prompt,
            detail=detail,
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


@app.route("/api/edit_image", methods=["POST"])
def edit_image():
    try:
        image_file = request.files.get("image")
        prompt = clean_text(request.form.get("prompt") or request.form.get("final_prompt") or "")

        if image_file is None:
            return jsonify({
                "ok": False,
                "message": "image が送られていません"
            }), 400

        if not prompt:
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
            prompt=prompt
        )

        return jsonify({
            "ok": True,
            "image_b64": to_b64(edited_bytes),
            "mime": "image/png",
            "final_prompt": prompt
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": f"edit_image エラー: {str(e)}"
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)