import os
import re
import base64
import traceback
from urllib.request import urlopen
from io import BytesIO

from flask import Flask, request, jsonify, render_template
from openai import OpenAI
import replicate

app = Flask(__name__, static_folder="static", template_folder="templates")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_TEXT_MODEL = os.environ.get("OPENAI_TEXT_MODEL", "gpt-4o-mini").strip()
REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
AICOMU_CODE = os.environ.get("AICOMU_CODE", "AICOMU2026").strip()

openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
replicate_client = replicate.Client(api_token=REPLICATE_API_TOKEN) if REPLICATE_API_TOKEN else None


def clean_text(text: str) -> str:
    text = "" if text is None else str(text)
    return re.sub(r"\s+", " ", text).strip()


def json_error(message: str, status_code: int = 400, image_b64: str = ""):
    return jsonify({
        "ok": False,
        "message": message,
        "image_b64": image_b64
    }), status_code


def json_ok(message: str, **kwargs):
    payload = {
        "ok": True,
        "message": message
    }
    payload.update(kwargs)
    return jsonify(payload)


def require_code(code: str):
    if clean_text(code) != AICOMU_CODE:
        raise ValueError("コードが違います")


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
        output_str = output.strip()
        if output_str.startswith("http://") or output_str.startswith("https://"):
            with urlopen(output_str) as res:
                data = res.read()
                if not data:
                    raise RuntimeError("Replicate 出力URLの読み込みに失敗しました")
                return data

    output_str = str(output).strip()
    if output_str.startswith("http://") or output_str.startswith("https://"):
        with urlopen(output_str) as res:
            data = res.read()
            if not data:
                raise RuntimeError("Replicate 出力URLの読み込みに失敗しました")
            return data

    raise RuntimeError(f"未対応の Replicate 出力形式です: {type(output)}")


def translate_to_english(text: str) -> str:
    if not openai_client:
        raise RuntimeError("OPENAI_API_KEY が未設定です")

    jp_text = clean_text(text)
    if not jp_text:
        raise ValueError("翻訳するテキストが空です")

    response = openai_client.responses.create(
        model=OPENAI_TEXT_MODEL,
        input=[
            {
                "role": "system",
                "content": (
                    "You translate Japanese prompts into clear natural English for image generation or image editing. "
                    "Keep the main subject explicit and strong. "
                    "Do not add unnecessary details. "
                    "Return only the English prompt."
                )
            },
            {
                "role": "user",
                "content": jp_text
            }
        ]
    )

    prompt_en = clean_text(response.output_text or "")
    if not prompt_en:
        raise RuntimeError("英語プロンプトの生成に失敗しました")

    return prompt_en


def decode_base64_image(image_b64: str) -> bytes:
    if not image_b64:
        raise ValueError("image_b64 が空です")

    try:
        return base64.b64decode(image_b64, validate=True)
    except Exception as e:
        raise ValueError("image_b64 の変換に失敗しました") from e


def edit_image_with_openai(image_bytes_list, prompt_en: str) -> str:
    if not openai_client:
        raise RuntimeError("OPENAI_API_KEY が未設定です")

    if not image_bytes_list:
        raise ValueError("編集元画像がありません")

    image_files = []
    for i, image_bytes in enumerate(image_bytes_list, start=1):
        image_file = BytesIO(image_bytes)
        image_file.name = f"input{i}.png"
        image_files.append(image_file)

    image_param = image_files[0] if len(image_files) == 1 else image_files

    result = openai_client.images.edit(
        model="gpt-image-1",
        image=image_param,
        prompt=prompt_en,
    )

    if not result.data or not result.data[0].b64_json:
        raise RuntimeError("画像編集の結果が空です")

    return result.data[0].b64_json


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/generate_summary", methods=["POST"])
def generate_summary():
    try:
        data = request.get_json(silent=True) or {}

        code = clean_text(data.get("code"))
        purpose = clean_text(data.get("purpose"))
        style = clean_text(data.get("style"))
        image_type = clean_text(data.get("image_type"))

        require_code(code)

        if not purpose or not style or not image_type:
            return jsonify({
                "ok": False,
                "message": "必要な要素が足りないよ🐾"
            }), 400

        if not openai_client:
            return jsonify({
                "ok": False,
                "message": "OPENAI_API_KEY が未設定です"
            }), 500

        user_text = f"""
用途: {purpose}
主役: {style}
仕上がり: {image_type}

この内容をもとに、
画像生成の方向性をぶらさない補足アドバイスだけを日本語で1〜2文で作ってください。

条件:
- 主役をぶらさない
- 少し具体性を足す
- 長くしすぎない
- 最終プロンプトそのものは作らない
- 日本語だけで返す
"""

        response = openai_client.responses.create(
            model=OPENAI_TEXT_MODEL,
            input=[
                {
                    "role": "system",
                    "content": (
                        "あなたは画像生成前の整理を手伝うアシスタントです。"
                        "主役を保ったまま、少しだけ具体性を足す補足を作ってください。"
                    )
                },
                {
                    "role": "user",
                    "content": user_text
                }
            ]
        )

        advice = clean_text(response.output_text or "")
        if not advice:
            advice = "主役が伝わるように、雰囲気や色味を少し具体的にすると良いよ🐾"

        return jsonify({
            "ok": True,
            "summary": f"主役は「{style}」、用途は「{purpose}」、仕上がりは「{image_type}」で進めるよ🐾",
            "advice": advice
        })

    except ValueError as e:
        return jsonify({
            "ok": False,
            "message": str(e)
        }), 400

    except Exception as e:
        print("generate_summary error:", e)
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "message": "まとめ作成でエラーが起きたよ🐾"
        }), 500


@app.route("/api/generate_image", methods=["POST"])
def generate_image():
    try:
        data = request.get_json(silent=True) or {}

        code = clean_text(data.get("code"))
        prompt_jp = clean_text(data.get("prompt"))

        require_code(code)

        if not prompt_jp:
            return json_error("prompt が空です", 400)

        if not replicate_client:
            return json_error("REPLICATE_API_TOKEN が未設定です", 500)

        if not openai_client:
            return json_error("OPENAI_API_KEY が未設定です", 500)

        prompt_en = translate_to_english(prompt_jp)

        print("generate_image に渡された日本語 prompt =", prompt_jp)
        print("generate_image に渡す英語 prompt =", prompt_en)

        output = replicate_client.run(
            "black-forest-labs/flux-schnell",
            input={
                "prompt": prompt_en
            }
        )

        image_bytes = read_replicate_output(output)
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        return json_ok(
            "お待たせ、画像を生成したよ🐾",
            image_b64=image_b64,
            final_prompt_jp=prompt_jp,
            final_prompt_en=prompt_en
        )

    except ValueError as e:
        return json_error(str(e), 400)

    except Exception as e:
        print("generate_image error:", e)
        traceback.print_exc()
        return json_error(f"generate_image エラー: {str(e)}", 500)


@app.route("/api/edit_image", methods=["POST"])
def edit_image():
    try:
        data = request.get_json(silent=True) or {}

        code = clean_text(data.get("code"))
        prompt_jp = clean_text(data.get("prompt"))
        image_b64 = data.get("image_b64") or ""
        image_b64_2 = data.get("image_b64_2") or ""

        require_code(code)

        if not prompt_jp:
            return json_error("prompt が空です", 400)

        if not image_b64 and not image_b64_2:
            return json_error("修正元画像がありません", 400)

        if not openai_client:
            return json_error("OPENAI_API_KEY が未設定です", 500)

        prompt_en = translate_to_english(prompt_jp)

        print("edit_image に渡された日本語 prompt =", prompt_jp)
        print("edit_image に渡す英語 prompt =", prompt_en)

        image_bytes_list = []

        if image_b64:
            image_bytes_list.append(decode_base64_image(image_b64))

        if image_b64_2:
            image_bytes_list.append(decode_base64_image(image_b64_2))

        edited_b64 = edit_image_with_openai(image_bytes_list, prompt_en)

        return json_ok(
            "お待たせ、画像を修正したよ🐾",
            image_b64=edited_b64,
            final_prompt_jp=prompt_jp,
            final_prompt_en=prompt_en
        )

    except ValueError as e:
        return json_error(str(e), 400)

    except Exception as e:
        print("edit_image error:", e)
        traceback.print_exc()
        return json_error(f"edit_image エラー: {str(e)}", 500)


if __name__ == "__main__":
    app.run(debug=True)