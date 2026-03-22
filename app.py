import os
from flask import Flask, request, jsonify, render_template
import replicate

app = Flask(__name__, static_folder="static", template_folder="templates")

REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()

if not REPLICATE_API_TOKEN:
    raise RuntimeError("REPLICATE_API_TOKEN が設定されていません")

client = replicate.Client(api_token=REPLICATE_API_TOKEN)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/generate_image", methods=["POST"])
def generate_image():
    try:
        data = request.get_json(silent=True) or {}
        prompt = (data.get("prompt") or "").strip()

        if not prompt:
            return jsonify({"ok": False, "error": "prompt が空です"}), 400

        output = client.run(
            "stability-ai/sdxl",
            input={
                "prompt": prompt
            }
        )

        image_url = None

        if isinstance(output, list) and len(output) > 0:
            image_url = output[0]
        elif isinstance(output, str):
            image_url = output

        if not image_url:
            return jsonify({"ok": False, "error": "画像URLを取得できませんでした"}), 500

        return jsonify({
            "ok": True,
            "image_url": image_url
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(debug=True)