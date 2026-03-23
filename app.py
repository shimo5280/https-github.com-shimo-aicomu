import os
import re
import json
import base64
from urllib.request import urlopen

from flask import Flask, request, jsonify, render_template
from openai import OpenAI
import replicate
import traceback

app = Flask(__name__, static_folder="static", template_folder="templates")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_TEXT_MODEL = os.environ.get("OPENAI_TEXT_MODEL", "gpt-4o-mini").strip()
REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
AICOMU_CODE = os.environ.get("AICOMU_CODE", "AICOMU2026").strip()

openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
replicate_client = replicate.Client(api_token=REPLICATE_API_TOKEN) if REPLICATE_API_TOKEN else None


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


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
        with urlopen(output) as res:
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


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/generate_summary", methods=["POST"])
def generate_summary():
    try:
        data = request.get_json(silent=True) or {}

        code = (data.get("code") or "").strip()
        purpose = (data.get("purpose") or "").strip()
        style = (data.get("style") or "").strip()
        image_type = (data.get("image_type") or "").strip()

        require_code(code)

        if not purpose or not style or not image_type:
            return jsonify({
                "ok": False,
                "message": "3つの要素が足りないよ🐾"
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

この3つをもとに、
画像生成用の補足アドバイスだけを日本語で作ってください。

重要:
- 3つの要素を削らない
- 最終プロンプトそのものは作らない
- 主役をぶらさない
- 補足だけを1〜2文で返す
"""

        response = openai_client.responses.create(
            model=OPENAI_TEXT_MODEL,
            input=[
                {
                    "role": "system",
                    "content": "あなたは画像生成の補足を提案するアシスタントです。要約しすぎず、主役をぶらさず、補足だけ返してください。"
                },
                {
                    "role": "user",
                    "content": user_text
                }
            ]
        )

        advice = (response.output_text or "").strip()

        return jsonify({
            "ok": True,
            "summary": f"用途は「{purpose}」、主役は「{style}」、仕上がりは「{image_type}」で進めるよ🐾",
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

        code = clean_text(data.get("code") or "")
        prompt = clean_text(data.get("prompt") or "")

        require_code(code)

        if not prompt:
            return jsonify({
                "ok": False,
                "message": "prompt が空です",
                "image_b64": ""
            }), 400

        if not replicate_client:
            return jsonify({
                "ok": False,
                "message": "REPLICATE_API_TOKEN が未設定です",
                "image_b64": ""
            }), 500

        print("generate_image に渡された prompt =", prompt)

        output = replicate_client.run(
            "black-forest-labs/flux-schnell",
            input={"prompt": prompt}
        )

        image_bytes = read_replicate_output(output)
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        return jsonify({
            "ok": True,
            "message": "お待たせ、画像を生成したよ🐾",
            "image_b64": image_b64,
            "final_prompt": prompt
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "message": f"generate_image エラー: {str(e)}",
            "image_b64": ""
        }), 500


if __name__ == "__main__":
    app.run(debug=True)