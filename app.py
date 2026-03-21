import os
import base64
import requests
import replicate

from flask import Flask, request, jsonify, render_template
from openai import OpenAI

app = Flask(__name__)

# =========================
# 環境変数
# =========================
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN")

client = OpenAI(api_key=OPENAI_API_KEY)

os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN


# =========================
# トップ
# =========================
@app.route("/")
def index():
    return render_template("index.html")


# =========================
# 相談（OpenAI）
# =========================
@app.route("/api/consult", methods=["POST"])
def consult():
    try:
        data = request.get_json()
        mode = data.get("mode")

        system = "フレンドリーに短く答えて。最後に🐾をつける。"

        if mode == "generate":
            prompt = f"""
用途: {data.get("purpose")}
主役: {data.get("main_subject")}
履歴: {data.get("history")}
"""

        else:
            prompt = f"""
修正内容: {data.get("edit_request")}
仕上がり: {data.get("finish_type")}
"""

        res = client.responses.create(
            model="gpt-4.1-mini",
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ]
        )

        return jsonify({
            "ok": True,
            "message": res.output_text
        })

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


# =========================
# 画像API（A + B）
# =========================
@app.route("/api/image", methods=["POST"])
def image_api():
    try:
        # JSON or Form対応
        if request.is_json:
            data = request.get_json()
            mode = data.get("mode")
        else:
            data = request.form
            mode = data.get("mode")

        # =========================
        # A 画像生成（Replicate）
        # =========================
        if mode == "generate":
            prompt = str(data.get("final_detail", ""))

            output = replicate.run(
                "black-forest-labs/flux-schnell",
                input={"prompt": prompt}
            )

            if isinstance(output, list):
                output = output[0]

            if hasattr(output, "read"):
                content = output.read()
            else:
                content = requests.get(output).content

            image_b64 = base64.b64encode(content).decode("utf-8")

            return jsonify({
                "ok": True,
                "image_b64": image_b64
            })


        # =========================
        # B 画像修正（Replicate）
        # =========================
        elif mode == "edit":
            image1 = request.files.get("image1")
            image2 = request.files.get("image2")

            edit_request = data.get("edit_request", "")
            finish_type = data.get("finish_type", "")
            keep_part = data.get("keep_part", "")
            extra = data.get("extra", "")

            final_prompt = f"{edit_request}。仕上がりは{finish_type}。残す部分は{keep_part}。{extra}"

            if image2:
                output = replicate.run(
                    "flux-kontext-apps/multi-image-list",
                    input={
                        "images": [image1, image2],
                        "prompt": str(final_prompt)
                    }
                )
            else:
                output = replicate.run(
                    "prunaai/flux-kontext-fast",
                    input={
                        "input_image": image1,
                        "prompt": str(final_prompt)
                    }
                )

            if isinstance(output, list):
                output = output[0]

            if hasattr(output, "read"):
                content = output.read()
            else:
                content = requests.get(output).content

            image_b64 = base64.b64encode(content).decode("utf-8")

            return jsonify({
                "ok": True,
                "image_b64": image_b64
            })

        return jsonify({"ok": False})

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


# =========================
# 起動
# =========================
if __name__ == "__main__":
    app.run(debug=True)