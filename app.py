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
# A 生成用：AI相談
# --------------------------------
def ask_generate_followup(
    purpose: str,
    main_subject: str,
    turn: int,
    history: str = "",
) -> str:
    system_text = (
        "あなたは画像生成の相談役AIです。"
        "自然でやわらかい日本語で話してください。"
        "敬語すぎない言い方にしてください。"
        "1回につき質問は1つだけにしてください。"
        "長い説明は禁止です。"
        "回答は短めにしてください。"
        "区読点に『🐾』語尾に『🐾🐾』をつけてください。"
        "ユーザーが答えやすいように、例を3つくらい入れてください。"
        "今は画像生成プロンプトを作るための相談中です。"
        "用途と主役をもとに、次に必要なことを1つだけ聞いてください。"
        "turn=2 なら背景について聞いてください。"
        "turn=3 なら全体の雰囲気について聞いてください。"
        "turn=4 なら表現方法（写真風、イラスト風、漫画風 など）について聞いてください。"
        "turn=5 なら質問せず、ここまでの内容を自然に短くまとめて、"
        "『追加したいことや気になる点があれば、できるだけ具体的に書いてください。具体的に書いてくれると、よりイメージに近づくよ。🐾』"
        "で締めてください。"
        "turnが5以上なら新しい提案やアドバイスは禁止です。"
    )

    user_text = (
        f"用途: {purpose}\n"
        f"主役: {main_subject}\n"
        f"turn: {turn}\n"
        f"これまでの会話: {history if history else 'なし'}\n\n"
        "上の条件に従って、今必要な質問またはまとめを返してください。"
    )

    return chat_reply(system_text, user_text)


def build_generate_prompt_with_ai(
    purpose: str,
    main_subject: str,
    background_text: str,
    mood_text: str,
    style_text: str,
    final_detail: str,
) -> str:
    system_text = (
        "あなたは画像生成用の最終プロンプトを作るAIです。"
        "出力は画像生成に使う内容のみで、会話文は禁止です。"
        "説明、感想、アドバイスは禁止です。"
        "日本語でまとめてもよいですが、画像生成向けに具体的で分かりやすく整理してください。"
        "主役は絶対にぶらさないでください。"
        "用途、背景、雰囲気、表現、追加詳細を統合して、"
        "画像生成に使いやすい完成形にしてください。"
        "追加詳細がある場合は最優先で反映してください。"
        "用途がホームページ背景やバナー背景なら、"
        "余白を多めにし、テキストを載せやすい構図を意識してください。"
        "主役が背景向きのモチーフでない限り、勝手に別の人物や別の主役を追加しないでください。"
        "出力は1つの完成された生成指示だけにしてください。"
    )

    user_text = (
        f"用途: {purpose}\n"
        f"主役: {main_subject}\n"
        f"背景: {background_text if background_text else '指定なし'}\n"
        f"雰囲気: {mood_text if mood_text else '指定なし'}\n"
        f"表現: {style_text if style_text else '指定なし'}\n"
        f"追加詳細: {final_detail if final_detail else 'なし'}\n\n"
        "この内容をもとに、最終的な画像生成用プロンプトを作ってください。"
    )

    return chat_reply(system_text, user_text)


def generate_openai_image_from_prompt(final_prompt: str) -> str:
    api_client = ensure_openai_client()

    try:
        result = api_client.images.generate(
            model="gpt-image-1",
            prompt=final_prompt,
            size="1024x1024"
        )

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
# B 修正
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
        "区読点は🐾最後に🐾🐾を付けてください。"
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
            size="1024x1024"
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
# A 相談開始
# --------------------------------
@app.route("/api/generate_consult", methods=["POST"])
def generate_consult():
    data = request.get_json(silent=True) or {}
    code = data.get("code")

    if not check_access(code):
        return jsonify({"ok": False, "message": "コードが違います"}), 403

    purpose = (data.get("purpose") or "").strip()
    main_subject = (data.get("main_subject") or "").strip()
    turn = int(data.get("turn") or 2)
    history = (data.get("history") or "").strip()

    if not purpose or not main_subject:
        return jsonify({"ok": False, "message": "内容が足りません"}), 400

    try:
        message = ask_generate_followup(
            purpose=purpose,
            main_subject=main_subject,
            turn=turn,
            history=history
        )
        return jsonify({"ok": True, "message": message})
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({
            "ok": False,
            "message": f"相談エラー: {type(e).__name__}: {str(e)}"
        }), 500


# --------------------------------
# A 生成
# --------------------------------
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
    main_subject = (data.get("main_subject") or "").strip()
    background_text = (data.get("background_text") or "").strip()
    mood_text = (data.get("mood_text") or "").strip()
    style_text = (data.get("style_text") or "").strip()
    final_detail = (data.get("final_detail") or "").strip()

    if not purpose or not main_subject:
        return jsonify({"ok": False, "message": "内容が足りません"}), 400

    try:
        final_prompt = build_generate_prompt_with_ai(
            purpose=purpose,
            main_subject=main_subject,
            background_text=background_text,
            mood_text=mood_text,
            style_text=style_text,
            final_detail=final_detail
        )

        print("✅ generate_image 開始")
        print("✅ final_prompt:", final_prompt)

        # まずは安定優先で OpenAI のみ
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
        print(traceback.format_exc())
        return jsonify({
            "ok": False,
            "message": f"画像修正エラー: {type(e).__name__}: {str(e)}"
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)), debug=True)