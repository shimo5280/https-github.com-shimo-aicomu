import os
import io
import base64
import traceback
import requests
import replicate

from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template
from openai import OpenAI

load_dotenv()

app = Flask(__name__, template_folder="templates", static_folder="static")

# =========================
# 環境変数
# =========================
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()

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


def require_openai_key():
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY が設定されていません")


def require_replicate_key():
    if not REPLICATE_API_TOKEN:
        raise RuntimeError("REPLICATE_API_TOKEN が設定されていません")


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


def get_request_mode():
    if request.is_json:
        data = request.get_json(silent=True) or {}
        return (data.get("mode") or "").strip(), data, None
    else:
        form = request.form
        return (form.get("mode") or "").strip(), None, form


# =========================
# A 生成相談（OpenAI）
# =========================
def build_generate_consult_reply(
    purpose: str,
    main_subject: str,
    turn: int,
    history: str,
) -> str:
    system_text = (
        "あなたは親しみやすい相棒タイプの日本語AIです。"
        "敬語すぎる話し方は禁止です。"
        "自然でやわらかい、少しくだけた話し方にしてください。"
        "返答は短めにしてください。"
        "最後に🐾を付けてください。"
        "質問は1回につき1つだけにしてください。"
        "説明しすぎないでください。"
    )

    if turn == 2:
        ask = "背景や場所はどんな感じにしたい？そのままでもいいよ🐾"
    elif turn == 3:
        ask = "全体の雰囲気はどんな感じにしたい？なるべく具体的ね🐾"
    elif turn == 4:
        ask = "表現はどんな感じがいい？ たとえば写真風、やわらかい感じ、幻想的、などだよ🐾"
    elif turn == 5:
        ask = "最後に追加したい細かい要素があれば教えてね。なければ『お任せ』でいいよ🐾"
    else:
        ask = "続きを教えてね🐾"

    user_text = (
        f"用途: {purpose}\n"
        f"主役: {main_subject}\n"
        f"履歴: {history if history else 'なし'}\n"
        f"次に聞くこと: {ask}\n\n"
        "上の内容に沿って、自然に短く質問してください。"
    )

    return chat_reply(system_text, user_text)


# =========================
# A 画像プロンプト生成
# =========================
def build_generate_prompt(
    purpose: str,
    main_subject: str,
    background_text: str,
    mood_text: str,
    style_text: str,
    final_detail: str,
) -> str:
    prompt = (
        f"用途: {purpose}\n"
        f"主役: {main_subject}\n"
        f"背景: {background_text}\n"
        f"雰囲気: {mood_text}\n"
        f"表現: {style_text}\n"
        f"追加詳細: {final_detail if final_detail else 'なし'}\n\n"
        "上の内容を満たす高品質な画像を生成してください。"
        "主役がはっきり伝わる構図にしてください。"
        "背景、雰囲気、表現、追加詳細をしっかり反映してください。"
        "人物がいる場合は、顔・手・目を自然にしてください。"
    )

    style_lower = (style_text or "").lower()
    mood_lower = (mood_text or "").lower()

    if (
        "写真" in style_text
        or "real" in style_lower
        or "photo" in style_lower
        or "リアル" in style_text
    ):
        prompt += (
            "\nphotorealistic, real photograph, natural lighting, "
            "realistic skin texture, high detail, professional photography, "
            "depth of field, sharp focus, realistic face, realistic hands, "
            "not illustration, not anime, not cartoon"
        )
    elif (
        "漫画" in style_text
        or "マンガ" in style_text
        or "comic" in style_lower
        or "manga" in style_lower
    ):
        prompt += (
            "\nmanga style, comic style, expressive line art, dynamic composition"
        )
    else:
        prompt += (
            "\ndigital illustration, beautiful composition, high detail, polished artwork"
        )

    if "幻想" in mood_text or "fantasy" in mood_lower:
        prompt += "\nfantasy atmosphere, dreamy lighting"
    if "やわらか" in mood_text:
        prompt += "\nsoft light, gentle tone"
    if "かわいい" in mood_text:
        prompt += "\ncute impression, charming details"

    return prompt


# =========================
# Replicate 画像生成
# =========================
def generate_replicate_image(prompt: str) -> str:
    require_replicate_key()

    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

    output = replicate.run(
        "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        input={
            "prompt": prompt,
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

    if isinstance(output, list) and len(output) > 0:
        image_url = output[0]
    else:
        image_url = output

    if not image_url:
        raise RuntimeError("Replicateの画像URL取得失敗")

    response = requests.get(image_url, timeout=60)
    response.raise_for_status()

    return base64.b64encode(response.content).decode("utf-8")


# =========================
# B 修正相談（OpenAI）
# =========================
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
        "ユーザーの画像修正条件を整理して、軽いアドバイスを1つだけ付けてください。"
        "新しい質問はしないでください。"
    )

    user_text = (
        f"画像枚数: {image_count_type}\n"
        f"修正内容: {edit_request}\n"
        f"仕上がり: {finish_type}\n"
        f"残したい部分: {keep_part if keep_part else 'なし'}\n"
        f"追加要望: {extra if extra else 'なし'}\n\n"
        "自然に整理して、軽いアドバイスを1つだけ付けてください。"
    )

    return chat_reply(system_text, user_text)


# =========================
# B 修正プロンプト
# =========================
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

    if "写真" in finish_type or "リアル" in finish_type:
        prompt += (
            "\nphotorealistic, real photograph, natural lighting, "
            "realistic skin texture, high detail, "
            "not illustration, not anime, not cartoon\n"
        )
    elif "漫画" in finish_type or "マンガ" in finish_type:
        prompt += "\nmanga style, comic style, line art\n"
    else:
        prompt += "\nillustration, digital art, painted style\n"

    return prompt


# =========================
# OpenAI 画像修正
# =========================
def edit_image_from_prompt(image_file_obj, final_prompt: str) -> str:
    require_openai_key()

    image_bytes = image_file_obj.read()
    image_name = image_file_obj.filename or "upload.png"
    image_stream = io.BytesIO(image_bytes)
    image_stream.name = image_name

    result = client.images.edit(
        model="gpt-image-1",
        image=image_stream,
        prompt=final_prompt,
        size="1024x1024"
    )
    return result.data[0].b64_json


# =========================
# ルート
# =========================
@app.route("/")
def index():
    return render_template("index.html")


# =========================
# 統一相談API
# generate / edit 共通
# =========================
@app.route("/api/consult", methods=["POST"])
def consult():
    mode, data, form = get_request_mode()

    try:
        if mode == "generate":
            code = data.get("code")

            if not check_access(code):
                return jsonify({"ok": False, "message": "コードが違います"}), 403

            purpose = (data.get("purpose") or "").strip()
            main_subject = (data.get("main_subject") or "").strip()

            try:
                turn = int(data.get("turn") or 1)
            except Exception:
                turn = 1

            history = (data.get("history") or "").strip()

            if not purpose or not main_subject:
                return jsonify({"ok": False, "message": "内容が足りません"}), 400

            message = build_generate_consult_reply(
                purpose=purpose,
                main_subject=main_subject,
                turn=turn,
                history=history,
            )

            return jsonify({
                "ok": True,
                "message": message,
                "remaining": MAX_REQUEST - request_count
            })

        elif mode == "edit":
            if form is None:
                return jsonify({"ok": False, "message": "フォーム送信が必要です"}), 400

            code = form.get("code")

            if not check_access(code):
                return jsonify({"ok": False, "message": "コードが違います"}), 403

            image_count_type = (form.get("image_count_type") or "").strip()
            edit_request = (form.get("edit_request") or "").strip()
            finish_type = (form.get("finish_type") or "").strip()
            keep_part = (form.get("keep_part") or "").strip()
            extra = (form.get("extra") or "").strip()

            if not image_count_type or not edit_request or not finish_type:
                return jsonify({"ok": False, "message": "内容が足りません"}), 400

            message = summarize_edit_answers(
                image_count_type=image_count_type,
                edit_request=edit_request,
                finish_type=finish_type,
                keep_part=keep_part,
                extra=extra
            )

            return jsonify({
                "ok": True,
                "message": message,
                "remaining": MAX_REQUEST - request_count
            })

        return jsonify({"ok": False, "message": "mode が不正です"}), 400

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": f"相談エラー: {type(e).__name__}: {str(e)}"
        }), 500


# =========================
# 統一画像API
# generate / edit 共通
# =========================
@app.route("/api/image", methods=["POST"])
def image_api():
    global request_count

    mode, data, form = get_request_mode()

    try:
        if mode == "generate":
            code = data.get("code")

            if not check_access(code):
                return jsonify({"ok": False, "message": "コードが違います"}), 403

            if request_count >= MAX_REQUEST:
                return jsonify({"ok": False, "message": "体験は終了しました"}), 403

            purpose = (data.get("purpose") or "").strip()
            main_subject = (data.get("main_subject") or "").strip()
            background_text = (data.get("background_text") or "").strip()
            mood_text = (data.get("mood_text") or "").strip()
            style_text = (data.get("style_text") or "").strip()
            final_detail = (data.get("final_detail") or "").strip()

            if not purpose or not main_subject:
                return jsonify({"ok": False, "message": "内容が足りません"}), 400

            final_prompt = build_generate_prompt(
                purpose=purpose,
                main_subject=main_subject,
                background_text=background_text,
                mood_text=mood_text,
                style_text=style_text,
                final_detail=final_detail,
            )

            image_b64 = generate_replicate_image(final_prompt)
            request_count += 1

            return jsonify({
                "ok": True,
                "message": "お待たせ、画像を生成したよ🐾",
                "image_b64": image_b64,
                "remaining": MAX_REQUEST - request_count
            })

        elif mode == "edit":
            if form is None:
                return jsonify({"ok": False, "message": "フォーム送信が必要です"}), 400

            code = form.get("code")

            if not check_access(code):
                return jsonify({"ok": False, "message": "コードが違います"}), 403

            if request_count >= MAX_REQUEST:
                return jsonify({"ok": False, "message": "体験は終了しました"}), 403

            image_count_type = (form.get("image_count_type") or "").strip()
            edit_request = (form.get("edit_request") or "").strip()
            finish_type = (form.get("finish_type") or "").strip()
            keep_part = (form.get("keep_part") or "").strip()
            extra = (form.get("extra") or "").strip()

            image1 = request.files.get("image1")
            image2 = request.files.get("image2")

            if not image1 and not image2:
                return jsonify({"ok": False, "message": "画像を選んでください"}), 400

            if not image_count_type or not edit_request or not finish_type:
                return jsonify({"ok": False, "message": "内容が足りません"}), 400

            base_image = image1 if image1 else image2

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

        return jsonify({"ok": False, "message": "mode が不正です"}), 400

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": f"画像処理エラー: {type(e).__name__}: {str(e)}"
        }), 500


if __name__ == "__main__":
    app.run(debug=True)