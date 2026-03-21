import os
import base64
import traceback
import requests
import replicate

from flask import Flask, request, jsonify, render_template
from openai import OpenAI

app = Flask(__name__)

# =========================
# 環境変数
# =========================
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "")

client = OpenAI(api_key=OPENAI_API_KEY)

# =========================
# 設定
# =========================
ACCESS_CODE = "AICOMU2026"
MAX_REQUEST = 20
request_count = 0


# =========================
# 共通
# =========================
def check_access(code):
    return (code or "").strip() == ACCESS_CODE


def chat_reply(system_text: str, user_text: str) -> str:
    response = client.responses.create(
        model="gpt-4.1-mini",
        input=[
            {"role": "system", "content": system_text},
            {"role": "user", "content": user_text},
        ],
    )
    return response.output_text.strip()


# =========================
# 相談文生成（OpenAI）
# =========================
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
        "ユーザーの画像生成条件を整理して、"
        "軽いアドバイスを1つだけ添えてください。"
        "新しい質問はしないでください。"
        "追加提案はしないでください。"
        "ボタン説明はしないでください。"
    )

    user_text = (
        f"用途: {purpose}\n"
        f"系統: {style}\n"
        f"画像タイプ: {image_type}\n"
        f"追加要素: {extra if extra else 'なし'}\n\n"
        "この内容を自然に整理して、軽いアドバイスを1つだけ付けてください。"
    )

    return chat_reply(system_text, user_text)


# =========================
# 画像プロンプト生成
# =========================
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

    # 画像は全部 Replicate に固定
    if image_type == "写真風":
        prompt += (
            "\nphotorealistic, real photograph, natural lighting, "
            "realistic skin texture, high detail, professional photography, "
            "depth of field, sharp focus, realistic face, realistic hands, "
            "not illustration, not anime, not cartoon\n"
        )
    elif image_type == "イラスト風":
        prompt += (
            "\ndigital illustration, clean composition, beautiful color balance, "
            "high detail, polished artwork\n"
        )
    elif image_type == "漫画風":
        prompt += (
            "\nmanga style, comic style, expressive line art, dynamic composition\n"
        )
    else:
        prompt += "\nhigh quality, detailed image\n"

    prompt += (
        "\n上の内容を満たす画像を生成してください。"
        "用途に合う見せ方を優先してください。"
        "系統と画像タイプをしっかり反映してください。"
        "子供っぽい印象になりすぎないようにしてください。"
        "人物がいる場合は、顔・手・目を自然にしてください。"
    )

    return prompt


# =========================
# Replicate 画像生成
# =========================
def generate_replicate_image(final_prompt: str) -> str:
    if not REPLICATE_API_TOKEN:
        raise RuntimeError("REPLICATE_API_TOKEN が設定されていません")

    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

    output = replicate.run(
        "stability-ai/sdxl:39ed52f2a78e934b1d4f73e7d0b5b6e4d4e4fdb3f8d7b8f1b7c1b9b6a4f2e7c8",
        input={
            "prompt": final_prompt,
            "width": 1024,
            "height": 1024,
            "num_outputs": 1,
            "scheduler": "K_EULER",
            "num_inference_steps": 30,
            "guidance_scale": 7.5,
            "refine": "expert_ensemble_refiner",
            "high_noise_frac": 0.8,
        }
    )

    image_url = output[0] if isinstance(output, list) else output

    if not image_url:
        raise RuntimeError("Replicateの画像URLが取得できませんでした")

    response = requests.get(image_url, timeout=60)
    response.raise_for_status()

    return base64.b64encode(response.content).decode("utf-8")


# =========================
# ルート
# =========================
@app.route("/")
def index():
    return render_template("index.html")


# =========================
# 相談API（OpenAI）
# JS: /api/generate_consult
# =========================
@app.route("/api/generate_consult", methods=["POST"])
@app.route("/api/generate_summary", methods=["POST"])
def generate_consult():
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
        message = summarize_generate_answers(
            purpose=purpose,
            style=style,
            image_type=image_type,
            extra=extra
        )

        return jsonify({
            "ok": True,
            "message": message,
            "remaining": MAX_REQUEST - request_count
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": f"相談エラー: {type(e).__name__}: {str(e)}"
        }), 500


# =========================
# 画像生成API（Replicate）
# JS: /api/generate_image
# =========================
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

        image_b64 = generate_replicate_image(final_prompt)

        request_count += 1

        return jsonify({
            "ok": True,
            "message": "お待たせ、画像を生成したよ🐾",
            "image_b64": image_b64,
            "remaining": MAX_REQUEST - request_count
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": f"画像生成エラー: {type(e).__name__}: {str(e)}"
        }), 500


if __name__ == "__main__":
    app.run(debug=True)