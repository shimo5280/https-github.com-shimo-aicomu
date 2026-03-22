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

REPLICATE_GENERATE_MODEL = os.environ.get("REPLICATE_GENERATE_MODEL", "").strip()
REPLICATE_EDIT_MODEL = os.environ.get("REPLICATE_EDIT_MODEL", "").strip()

REPLICATE_GENERATE_PROMPT_KEY = os.environ.get("REPLICATE_GENERATE_PROMPT_KEY", "prompt").strip()
REPLICATE_EDIT_IMAGE1_KEY = os.environ.get("REPLICATE_EDIT_IMAGE1_KEY", "image").strip()
REPLICATE_EDIT_IMAGE2_KEY = os.environ.get("REPLICATE_EDIT_IMAGE2_KEY", "image2").strip()
REPLICATE_EDIT_PROMPT_KEY = os.environ.get("REPLICATE_EDIT_PROMPT_KEY", "prompt").strip()

CODE_VALUE = os.environ.get("AICOMU_CODE", "AICOMU2026").strip()

if REPLICATE_API_TOKEN:
    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


# =========================
# 共通
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


def require_code(code: str):
    if clean_text(code) != CODE_VALUE:
        raise ValueError("コードが違います")


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
                "content": "あなたは親しみやすく簡潔な日本語アシスタントです。短く自然に返答してください。"
            },
            {
                "role": "user",
                "content": user_message
            }
        ],
        temperature=0.7,
    )

    text = ""
    if resp.choices and resp.choices[0].message:
        text = resp.choices[0].message.content or ""

    return clean_text(text) or "うまく返答を作れませんでした。"


def build_generate_prompt(purpose: str, style: str, image_type: str, extra: str = "") -> str:
    purpose = clean_text(purpose)
    style = clean_text(style)
    image_type = clean_text(image_type)
    extra = clean_text(extra)

    if not client:
        parts = []
        if purpose:
            parts.append(f"用途: {purpose}")
        if style:
            parts.append(f"主役: {style}")
        if image_type:
            parts.append(f"仕上がり: {image_type}")
        if extra:
            parts.append(f"追加: {extra}")
        return " / ".join(parts)

    resp = client.chat.completions.create(
        model=OPENAI_TEXT_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "あなたは画像生成用のプロンプト整理アシスタントです。"
                    "ユーザーの意図を保ったまま、短く実用的な日本語プロンプトだけを返してください。"
                    "説明や前置きは不要です。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"用途: {purpose or 'なし'}\n"
                    f"主役: {style or 'なし'}\n"
                    f"仕上がり: {image_type or 'なし'}\n"
                    f"追加: {extra or 'なし'}"
                ),
            }
        ],
        temperature=0.4,
    )

    text = ""
    if resp.choices and resp.choices[0].message:
        text = resp.choices[0].message.content or ""

    text = clean_text(text)

    if not text:
        parts = []
        if purpose:
            parts.append(f"用途: {purpose}")
        if style:
            parts.append(f"主役: {style}")
        if image_type:
            parts.append(f"仕上がり: {image_type}")
        if extra:
            parts.append(f"追加: {extra}")
        text = " / ".join(parts)

    return text


def build_edit_prompt(image_count_type: str, edit_request: str, finish_type: str, keep_part: str, extra: str = "") -> str:
    image_count_type = clean_text(image_count_type)
    edit_request = clean_text(edit_request)
    finish_type = clean_text(finish_type)
    keep_part = clean_text(keep_part)
    extra = clean_text(extra)

    if not client:
        parts = []
        if image_count_type:
            parts.append(f"画像枚数: {image_count_type}")
        if edit_request:
            parts.append(f"修正内容: {edit_request}")
        if finish_type:
            parts.append(f"仕上がり: {finish_type}")
        if keep_part:
            parts.append(f"残したい部分: {keep_part}")
        if extra:
            parts.append(f"追加: {extra}")
        return " / ".join(parts)

    resp = client.chat.completions.create(
        model=OPENAI_TEXT_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "あなたは画像編集用のプロンプト整理アシスタントです。"
                    "ユーザーの意図を保ったまま、短く実用的な日本語プロンプトだけを返してください。"
                    "説明や前置きは不要です。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"画像枚数: {image_count_type or 'なし'}\n"
                    f"修正内容: {edit_request or 'なし'}\n"
                    f"仕上がり: {finish_type or 'なし'}\n"
                    f"残したい部分: {keep_part or 'なし'}\n"
                    f"追加: {extra or 'なし'}"
                ),
            }
        ],
        temperature=0.4,
    )

    text = ""
    if resp.choices and resp.choices[0].message:
        text = resp.choices[0].message.content or ""

    text = clean_text(text)

    if not text:
        parts = []
        if image_count_type:
            parts.append(f"画像枚数: {image_count_type}")
        if edit_request:
            parts.append(f"修正内容: {edit_request}")
        if finish_type:
            parts.append(f"仕上がり: {finish_type}")
        if keep_part:
            parts.append(f"残したい部分: {keep_part}")
        if extra:
            parts.append(f"追加: {extra}")
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


def run_replicate_edit(image1_bytes: bytes, image1_name: str, image2_bytes: bytes, image2_name: str, prompt: str) -> bytes:
    prompt = clean_text(prompt)

    if not REPLICATE_API_TOKEN:
        raise RuntimeError("REPLICATE_API_TOKEN が未設定です")
    if not REPLICATE_EDIT_MODEL:
        raise RuntimeError("REPLICATE_EDIT_MODEL が未設定です")
    if not image1_bytes:
        raise RuntimeError("image1 が空です")
    if not prompt:
        raise RuntimeError("修正プロンプトが空です")

    file1 = io.BytesIO(image1_bytes)
    file1.name = image1_name or "image1.png"

    model_input = {
        REPLICATE_EDIT_IMAGE1_KEY: file1,
        REPLICATE_EDIT_PROMPT_KEY: prompt,
    }

    if image2_bytes:
        file2 = io.BytesIO(image2_bytes)
        file2.name = image2_name or "image2.png"
        model_input[REPLICATE_EDIT_IMAGE2_KEY] = file2

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

        code = clean_text(data.get("code") or "")
        message = clean_text(data.get("message") or data.get("prompt") or "")

        require_code(code)

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


@app.route("/api/generate_summary", methods=["POST"])
def generate_summary():
    try:
        data = request.get_json(silent=True) or {}

        code = clean_text(data.get("code") or "")
        purpose = clean_text(data.get("purpose") or "")
        style = clean_text(data.get("style") or "")
        image_type = clean_text(data.get("image_type") or "")
        extra = clean_text(data.get("extra") or "")

        require_code(code)

        final_prompt = build_generate_prompt(
            purpose=purpose,
            style=style,
            image_type=image_type,
            extra=extra
        )

        return jsonify({
            "ok": True,
            "message": f"こんな感じでまとめたよ🐾\n{final_prompt}",
            "final_prompt": final_prompt
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": f"generate_summary エラー: {str(e)}"
        }), 500


@app.route("/api/generate_image", methods=["POST"])
def generate_image():
    try:
        data = request.get_json(silent=True) or {}

        code = clean_text(data.get("code") or "")
        purpose = clean_text(data.get("purpose") or "")
        style = clean_text(data.get("style") or "")
        image_type = clean_text(data.get("image_type") or "")
        extra = clean_text(data.get("extra") or "")

        require_code(code)

        final_prompt = build_generate_prompt(
            purpose=purpose,
            style=style,
            image_type=image_type,
            extra=extra
        )

        image_bytes = run_replicate_generate(final_prompt)

        return jsonify({
            "ok": True,
            "message": "お待たせ、画像を生成したよ🐾",
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


@app.route("/api/edit_summary", methods=["POST"])
def edit_summary():
    try:
        code = clean_text(request.form.get("code") or "")
        image_count_type = clean_text(request.form.get("image_count_type") or "")
        edit_request = clean_text(request.form.get("edit_request") or "")
        finish_type = clean_text(request.form.get("finish_type") or "")
        keep_part = clean_text(request.form.get("keep_part") or "")
        extra = clean_text(request.form.get("extra") or "")

        require_code(code)

        final_prompt = build_edit_prompt(
            image_count_type=image_count_type,
            edit_request=edit_request,
            finish_type=finish_type,
            keep_part=keep_part,
            extra=extra
        )

        return jsonify({
            "ok": True,
            "message": f"こんな感じでまとめたよ🐾\n{final_prompt}",
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
        code = clean_text(request.form.get("code") or "")
        image_count_type = clean_text(request.form.get("image_count_type") or "")
        edit_request = clean_text(request.form.get("edit_request") or "")
        finish_type = clean_text(request.form.get("finish_type") or "")
        keep_part = clean_text(request.form.get("keep_part") or "")
        extra = clean_text(request.form.get("extra") or "")

        image1 = request.files.get("image1")
        image2 = request.files.get("image2")

        require_code(code)

        if image1 is None:
            return jsonify({
                "ok": False,
                "message": "image1 が送られていません"
            }), 400

        final_prompt = build_edit_prompt(
            image_count_type=image_count_type,
            edit_request=edit_request,
            finish_type=finish_type,
            keep_part=keep_part,
            extra=extra
        )

        image1_bytes = image1.read()
        image2_bytes = image2.read() if image2 else b""

        if not image1_bytes:
            return jsonify({
                "ok": False,
                "message": "image1 の読み込みに失敗しました"
            }), 400

        edited_bytes = run_replicate_edit(
            image1_bytes=image1_bytes,
            image1_name=image1.filename or "image1.png",
            image2_bytes=image2_bytes,
            image2_name=(image2.filename if image2 else "image2.png"),
            prompt=final_prompt
        )

        out_name = image1.filename or "result.png"

        return jsonify({
            "ok": True,
            "message": "お待たせ、画像を修正したよ🐾",
            "image_b64": to_b64(edited_bytes),
            "mime": guess_mime(out_name),
            "final_prompt": final_prompt
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": f"edit_image エラー: {str(e)}"
        }), 500