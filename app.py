import os
import io
import base64
import traceback

from flask import Flask, request, jsonify, render_template
from openai import OpenAI

app = Flask(__name__)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
client = OpenAI(api_key=OPENAI_API_KEY)

ACCESS_CODE = "AICOMU2026"
MAX_REQUEST = 20
request_count = 0


def check_access(code):
    return (code or "").strip() == ACCESS_CODE


def chat_reply(system_text: str, user_text: str) -> str:
    try:
        response = client.responses.create(
            model="gpt-4.1-mini",
            input=[
                {"role": "system", "content": system_text},
                {"role": "user", "content": user_text},
            ],
        )
        return response.output_text.strip()
    except Exception as e:
        print("CHAT ERROR:", e)
        return "今ちょっと不安定みたい🐾"


# --------------------------------
# A 画像生成
# --------------------------------
def summarize_generate_answers(purpose, style, image_type, extra):
    system_text = (
        "あなたは親しみやすい相棒タイプの日本語AIです。"
        "敬語すぎる話し方は禁止です。"
        "自然でやわらかい、少しくだけた話し方にしてください。"
        "返答は短めにしてください。"
        "最後に🐾を付けてください。"
        "条件を整理して軽いアドバイスを1つだけ付けてください。"
    )

    user_text = (
        f"用途: {purpose}\n"
        f"系統: {style}\n"
        f"画像タイプ: {image_type}\n"
        f"追加要素: {extra if extra else 'なし'}\n"
    )

    return chat_reply(system_text, user_text)


def generate_image_prompt(purpose, style, image_type, extra):
    prompt = f"{purpose}, {style}, {image_type}"

    if extra:
        prompt += f", {extra}"

    if image_type == "写真風":
        prompt += ", photorealistic, realistic, high detail"
    elif image_type == "イラスト風":
        prompt += ", illustration"
    elif image_type == "漫画風":
        prompt += ", manga"

    return prompt


def generate_openai_image_from_prompt(prompt):
    result = client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size="1024x1024"
    )
    return result.data[0].b64_json


# --------------------------------
# B 修正
# --------------------------------
def edit_image_from_prompt(image_file_obj, final_prompt):
    image_bytes = image_file_obj.read()
    image_stream = io.BytesIO(image_bytes)
    image_stream.name = "upload.png"

    result = client.images.edit(
        model="gpt-image-1",
        image=image_stream,
        prompt=final_prompt,
        size="1024x1024"
    )
    return result.data[0].b64_json


# --------------------------------
# ルート
# --------------------------------
@app.route("/")
def index():
    return render_template("index.html")


# --------------------------------
# 生成（要約）
# --------------------------------
@app.route("/api/generate_summary", methods=["POST"])
def generate_summary():
    data = request.get_json(silent=True) or {}

    if not check_access(data.get("code")):
        return jsonify({"ok": False, "message": "コード違う"}), 403

    try:
        text = summarize_generate_answers(
            data.get("purpose", ""),
            data.get("style", ""),
            data.get("image_type", ""),
            data.get("extra", "")
        )
        return jsonify({"ok": True, "message": text})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "message": str(e)}), 500


# --------------------------------
# 生成（画像）
# --------------------------------
@app.route("/api/generate_image", methods=["POST"])
def generate_image():
    global request_count

    data = request.get_json(silent=True) or {}

    if not check_access(data.get("code")):
        return jsonify({"ok": False, "message": "コード違う"}), 403

    if request_count >= MAX_REQUEST:
        return jsonify({"ok": False, "message": "終了"}), 403

    try:
        prompt = generate_image_prompt(
            data.get("purpose", ""),
            data.get("style", ""),
            data.get("image_type", ""),
            data.get("extra", "")
        )

        image_b64 = generate_openai_image_from_prompt(prompt)

        request_count += 1

        return jsonify({
            "ok": True,
            "image_b64": image_b64
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "message": str(e)}), 500


# --------------------------------
# 修正
# --------------------------------
@app.route("/api/edit_image", methods=["POST"])
def edit_image():
    try:
        image = request.files.get("image1")
        if not image:
            return jsonify({"ok": False, "message": "画像なし"}), 400

        prompt = request.form.get("edit_request", "")

        image_b64 = edit_image_from_prompt(image, prompt)

        return jsonify({
            "ok": True,
            "image_b64": image_b64
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "message": str(e)}), 500


# --------------------------------
# 起動
# --------------------------------
if __name__ == "__main__":
    app.run(debug=True)