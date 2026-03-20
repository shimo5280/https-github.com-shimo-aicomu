import os
import io
import base64
import traceback
import requests
import replicate

from flask import Flask, request, jsonify, render_template
from openai import OpenAI

app = Flask(__name__)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

ACCESS_CODE = "AICOMU2026"
MAX_REQUEST = 20
request_count = 0


def check_access(code):
    return (code or "").strip() == ACCESS_CODE


def ensure_openai_client():
    if client is None:
        raise RuntimeError("OPENAI_API_KEY が設定されていません")
    return client


def chat_reply(system_text: str, user_text: str) -> str:
    api_client = ensure_openai_client()
    response = api_client.responses.create(
        model="gpt-5-mini",
        input=[
            {"role": "system", "content": system_text},
            {"role": "user", "content": user_text},
        ],
    )
    return response.output_text.strip()


# --------------------------------
# A 画像生成
# --------------------------------
def summarize_generate_answers(
    purpose: str,
    style: str,
    image_type: str,
    extra: str,
) -> str:
    system_text = (
        "あなたは親しみやすい相棒タイプの日本語AIです。"
        "敬語すぎる話し方は禁止です。"
        "自然でやわらかい、少しくだけた話し方にしてください。"
        "返答は短めにしてください。"
        "最後に🐾を付けてください。"
        "あなたの役割は、ユーザーの画像生成条件を整理して、"
        "軽いアドバイスを1つだけ添えることです。"
        "新しい質問はしてはいけません。"
        "追加の提案は禁止です。"
        "ボタン操作の説明は禁止です。"
        "アドバイスは必ず1つだけにしてください。"
    )

    user_text = (
        f"用途: {purpose}\n"
        f"系統: {style}\n"
        f"画像タイプ: {image_type}\n"
        f"追加要素: {extra if extra else 'なし'}\n\n"
        "この内容を自然に整理して、軽いアドバイスを1つだけ付けてください。"
    )

    return chat_reply(system_text, user_text)


def generate_image_prompt(
    purpose: str,
    style: str,
    image_type: str,
    extra: str,
) -> str:
    prompt = (
        f"用途: {purpose}\n"
        f"系統: {style}\n"
        f"画像タイプ: {image_type}\n"
    )

    if extra:
        prompt += f"追加要素: {extra}\n"

    if image_type == "写真風":
        prompt += (
            "\nphotorealistic, real photograph, shot with a real camera, "
            "natural lighting, realistic skin texture, high detail, "
            "depth of field, professional photography, "
            "not illustration, not anime, not cartoon\n"
        )
    elif image_type == "イラスト風":
        prompt += "\nillustration, digital art, painted style\n"
    elif image_type == "漫画風":
        prompt += "\nmanga style, comic style, line art\n"

    prompt += (
        "\n上の内容を満たす画像を生成してください。"
        "用途に合う見せ方を優先してください。"
        "系統と画像タイプをしっかり反映してください。"
        "子供っぽい印象になりすぎないようにしてください。"
    )

    return prompt


def generate_openai_image_from_prompt(final_prompt: str) -> str:
    api_client = ensure_openai_client()

    try:
        result = api_client.images.generate(
            model="gpt-image-1",
            prompt=final_prompt,
            size="512x512"
        )

        print("✅ OpenAI images.generate 成功")
        print("✅ result type:", type(result))
        print("✅ result:", result)

        if not hasattr(result, "data") or not result.data:
            raise RuntimeError("OpenAI画像生成レスポンスに data がありません")

        first_item = result.data[0]
        image_b64 = getattr(first_item, "b64_json", None)

        if not image_b64:
            raise RuntimeError("OpenAI画像生成レスポンスに b64_json がありません")

        return image_b64

    except Exception:
        print("🔥 OpenAI画像生成エラー開始")
        print(traceback.format_exc())
        print("🔥 OpenAI画像生成エラー終了")
        raise


def generate_replicate_photo_image(prompt: str) -> str:
    if not REPLICATE_API_TOKEN:
        raise RuntimeError("REPLICATE_API_TOKEN が設定されていません")

    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

    try:
        output = replicate.run(
            "stability-ai/sdxl",
            input={
                "prompt": prompt,
                "width": 512,
                "height": 512,
            }
        )

        image_url = output[0] if isinstance(output, list) else output
        if not image_url:
            raise RuntimeError("Replicate の画像URLが取得できませんでした")

        response = requests.get(image_url, timeout=60)
        response.raise_for_status()

        return base64.b64encode(response.content).decode("utf-8")

    except Exception:
        print("🔥 Replicate画像生成エラー開始")
        print(traceback.format_exc())
        print("🔥 Replicate画像生成エラー終了")
        raise


# --------------------------------
# B 画像修正
# --------------------------------
def summarize_edit_answers(
    image_count_type: str,
    edit_request: str,
    finish_type: str,
    keep_part: str,
    extra: str,
) -> str:
    system_text = (
        "あなたは親しみやすい相棒タイプの日本語AIです。"
        "敬語すぎる話し方は禁止です。"
        "自然でやわらかい、少しくだけた話し方にしてください。"
        "返答は短めにしてください。"
        "最後に🐾を付けてください。"
        "あなたの役割は、ユーザーの画像修正条件を整理して、"
        "軽いアドバイスを1つだけ添えることです。"
        "新しい質問はしてはいけません。"
        "追加の提案は禁止です。"
        "ボタン操作の説明は禁止です。"
        "アドバイスは必ず1つだけにしてください。"
    )

    user_text = (
        f"画像枚数: {image_count_type}\n"
        f"修正内容: {edit_request}\n"
        f"仕上がり: {finish_type}\n"
        f"残したい部分: {keep_part if keep_part else 'なし'}\n"
        f"追加要望: {extra if extra else 'なし'}\n\n"
        "この内容を自然に整理して、軽いアドバイスを1つだけ付けてください。"
    )

    return chat_reply(system_text, user_text)


def build_edit_prompt(
    image_count_type: str,
    edit_request: str,
    finish_type: str,
    keep_part: str,
    extra: str = "",
) -> str:
    keep_text = keep_part if keep_part else "特になし"

    prompt = (
        f"画像枚数: {image_count_type}\n"
        f"変更内容: {edit_request}\n"
        f"仕上がりスタイル: {finish_type}\n"
        f"維持する部分: {keep_text}\n"
    )

    if extra:
        prompt += f"追加要望: {extra}\n"

    prompt += (
        "\n修正ルール:\n"
        "・指定された部分のみ変更してください。\n"
        "・それ以外の人物、構図、ポーズ、背景はできるだけ維持してください。\n"
        "・維持する部分が指定されている場合は、その部分を優先して残してください。\n"
        "・変更内容を最優先してください。\n"
        "・仕上がりスタイルを反映してください。\n"
    )

    if finish_type == "写真風":
        prompt += (
            "\nphotorealistic, real photograph, natural lighting, "
            "realistic skin texture, high detail, "
            "not illustration, not anime, not cartoon\n"
        )
    elif finish_type == "イラスト風":
        prompt += "\nillustration, digital art, painted style\n"
    elif finish_type == "漫画風":
        prompt += "\nmanga style, comic style, line art\n"

    return prompt


def edit_image_from_prompt(image_file_obj, final_prompt: str) -> str:
    api_client = ensure_openai_client()

    try:
        image_bytes = image_file_obj.read()
        image_name = image_file_obj.filename or "upload.png"
        image_stream = io.BytesIO(image_bytes)
        image_stream.name = image_name

        result = api_client.images.edit(
            model="gpt-image-1",
            image=image_stream,
            prompt=final_prompt,
            size="512x512"
        )

        if not hasattr(result, "data") or not result.data:
            raise RuntimeError("OpenAI画像修正レスポンスに data がありません")

        first_item = result.data[0]
        image_b64 = getattr(first_item, "b64_json", None)

        if not image_b64:
            raise RuntimeError("OpenAI画像修正レスポンスに b64_json がありません")

        return image_b64

    except Exception:
        print("🔥 OpenAI画像修正エラー開始")
        print(traceback.format_exc())
        print("🔥 OpenAI画像修正エラー終了")
        raise


@app.route("/")
def index():
    return render_template("index.html")


# --------------------------------
# A 生成
# --------------------------------
@app.route("/api/generate_summary", methods=["POST"])
def generate_summary():
    data = request.get_json(silent=True) or {}
    code = data.get("code")

    if not check_access(code):
        return jsonify({"ok": False, "message": "コードが違います"}), 403

    purpose = (data.get("purpose") or "").strip()
    style = (data.get("style") or "").strip()
    image_type = (data.get("image_type") or "").strip()
    extra = (data.get("extra") or "").strip()

    if not purpose or not style or not image_type:
        return jsonify({"ok": False, "message": "内容が足りません"}), 400

    try:
        summary_text = summarize_generate_answers(
            purpose=purpose,
            style=style,
            image_type=image_type,
            extra=extra
        )

        return jsonify({
            "ok": True,
            "message": summary_text,
            "remaining": MAX_REQUEST - request_count
        })
    except Exception as e:
        print("🔥 generate_summary エラー")
        print(traceback.format_exc())
        return jsonify({
            "ok": False,
            "message": f"要約エラー: {type(e).__name__}: {str(e)}"
        }), 500


@app.route("/api/generate_image", methods=["POST"])
def generate_image():
    global request_count

    data = request.get_json(silent=True) or {}
    code = data.get("code")

    if not check_access(code):
        return jsonify({"ok": False, "message": "コードが違います"}), 403

    if request_count >= MAX_REQUEST:
        return jsonify({"ok": False, "message": "体験は終了しました"}), 403

    purpose = (data.get("purpose") or "").strip()
    style = (data.get("style") or "").strip()
    image_type = (data.get("image_type") or "").strip()
    extra = (data.get("extra") or "").strip()

    if not purpose or not style or not image_type:
        return jsonify({"ok": False, "message": "内容が足りません"}), 400

    try:
        final_prompt = generate_image_prompt(
            purpose=purpose,
            style=style,
            image_type=image_type,
            extra=extra
        )

        print("✅ generate_image 開始")
        print("✅ image_type:", image_type)
        print("✅ final_prompt:", final_prompt)

        if image_type == "写真風":
            image_b64 = generate_replicate_photo_image(final_prompt)
        else:
            image_b64 = generate_openai_image_from_prompt(final_prompt)

        request_count += 1

        return jsonify({
            "ok": True,
            "message": "お待たせ、画像を生成したよ🐾",
            "image_b64": image_b64,
            "remaining": MAX_REQUEST - request_count
        })
    except Exception as e:
        print("🔥 generate_image エラー")
        print(traceback.format_exc())
        return jsonify({
            "ok": False,
            "message": f"画像生成エラー: {type(e).__name__}: {str(e)}"
        }), 500


# --------------------------------
# B 修正
# --------------------------------
@app.route("/api/edit_summary", methods=["POST"])
def edit_summary():
    code = request.form.get("code")

    if not check_access(code):
        return jsonify({"ok": False, "message": "コードが違います"}), 403

    image_count_type = (request.form.get("image_count_type") or "").strip()
    edit_request = (request.form.get("edit_request") or "").strip()
    finish_type = (request.form.get("finish_type") or "").strip()
    keep_part = (request.form.get("keep_part") or "").strip()
    extra = (request.form.get("extra") or "").strip()

    image1 = request.files.get("image1")
    image2 = request.files.get("image2")

    if not image1 and not image2:
        return jsonify({"ok": False, "message": "画像を選んでください"}), 400

    if not image_count_type or not edit_request or not finish_type:
        return jsonify({"ok": False, "message": "内容が足りません"}), 400

    try:
        summary_text = summarize_edit_answers(
            image_count_type=image_count_type,
            edit_request=edit_request,
            finish_type=finish_type,
            keep_part=keep_part,
            extra=extra
        )

        return jsonify({
            "ok": True,
            "message": summary_text,
            "remaining": MAX_REQUEST - request_count
        })
    except Exception as e:
        print("🔥 edit_summary エラー")
        print(traceback.format_exc())
        return jsonify({
            "ok": False,
            "message": f"要約エラー: {type(e).__name__}: {str(e)}"
        }), 500


@app.route("/api/edit_image", methods=["POST"])
def edit_image():
    global request_count

    code = request.form.get("code")

    if not check_access(code):
        return jsonify({"ok": False, "message": "コードが違います"}), 403

    if request_count >= MAX_REQUEST:
        return jsonify({"ok": False, "message": "体験は終了しました"}), 403

    image_count_type = (request.form.get("image_count_type") or "").strip()
    edit_request = (request.form.get("edit_request") or "").strip()
    finish_type = (request.form.get("finish_type") or "").strip()
    keep_part = (request.form.get("keep_part") or "").strip()
    extra = (request.form.get("extra") or "").strip()

    image1 = request.files.get("image1")
    image2 = request.files.get("image2")

    if not image1 and not image2:
        return jsonify({"ok": False, "message": "画像を選んでください"}), 400

    if not image_count_type or not edit_request or not finish_type:
        return jsonify({"ok": False, "message": "内容が足りません"}), 400

    base_image = image1 if image1 else image2

    try:
        final_prompt = build_edit_prompt(
            image_count_type=image_count_type,
            edit_request=edit_request,
            finish_type=finish_type,
            keep_part=keep_part,
            extra=extra
        )

        image_b64 = edit_image_from_prompt(base_image, final_prompt)

        request_count += 1

        return jsonify({
            "ok": True,
            "message": "お待たせ、画像を修正したよ🐾",
            "image_b64": image_b64,
            "remaining": MAX_REQUEST - request_count
        })
    except Exception as e:
        print("🔥 edit_image エラー")
        print(traceback.format_exc())
        return jsonify({
            "ok": False,
            "message": f"画像修正エラー: {type(e).__name__}: {str(e)}"
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)), debug=True)