import os
import re
import json
import base64
from urllib.request import urlopen

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

        code = clean_text(data.get("code") or "")
        purpose = clean_text(data.get("purpose") or "")
        style = clean_text(data.get("style") or "")
        image_type = clean_text(data.get("image_type") or "")

        require_code(code)

        if not purpose or not style or not image_type:
            return jsonify({
                "ok": False,
                "message": "入力が足りません",
                "summary": "",
                "advice": "",
                "final_prompt": ""
            }), 400

        if openai_client:
            resp = openai_client.chat.completions.create(
                model=OPENAI_TEXT_MODEL,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "あなたは画像生成アシスタントです。"
                            "必ずJSONだけを返してください。"
                            '形式は {"summary":"...", "advice":"...", "final_prompt":"..."} です。'
                            "summary は入力内容を自然な日本語で短く整理した文。"
                            "advice は短い一言アドバイス。"
                            "final_prompt は画像生成にそのまま使える日本語プロンプト。"
                        )
                    },
                    {
                        "role": "user",
                        "content": (
                            f"用途: {purpose}\n"
                            f"主役: {style}\n"
                            f"仕上がり: {image_type}\n"
                            f"追加: なし"
                        )
                    }
                ],
                temperature=0.7
            )

            content = resp.choices[0].message.content or "{}"
            result = json.loads(content)

            summary = clean_text(result.get("summary") or "")
            advice = clean_text(result.get("advice") or "")
            final_prompt = clean_text(result.get("final_prompt") or "")
        else:
            summary = f"{purpose}向けで、主役は{style}、仕上がりは{image_type}"
            advice = "色や雰囲気を少し具体的にすると、画像が安定しやすいよ🐾"
            final_prompt = f"{purpose}用、{style}、{image_type}"

        if not summary:
            summary = f"{purpose}向けで、主役は{style}、仕上がりは{image_type}"
        if not advice:
            advice = "色や雰囲気を少し具体的にすると、画像が安定しやすいよ🐾"
        if not final_prompt:
            final_prompt = f"{purpose}用、{style}、{image_type}"

        return jsonify({
            "ok": True,
            "summary": summary,
            "advice": advice,
            "final_prompt": final_prompt
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "message": f"generate_summary エラー: {str(e)}",
            "summary": "",
            "advice": "",
            "final_prompt": ""
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