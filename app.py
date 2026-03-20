import os
import traceback

from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI

app = Flask(__name__, static_folder="static", template_folder="templates")

# =========================
# 環境変数
# =========================
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
client = OpenAI(api_key=OPENAI_API_KEY)

# =========================
# ルート
# =========================
@app.route("/")
def index():
    return send_from_directory("templates", "index.html")

# =========================
# 画像生成API
# =========================
@app.route("/api/generate_image", methods=["POST"])
def generate_image():
    try:
        if not OPENAI_API_KEY:
            return jsonify({"error": "OPENAI_API_KEY が未設定です"}), 500

        data = request.get_json(silent=True) or {}

        # JS から送られてくる値
        prompt = (data.get("prompt") or "").strip()
        extra_detail = (data.get("detail") or "").strip()
        size = (data.get("size") or "1024x1024").strip()

        if not prompt:
            return jsonify({"error": "prompt が空です"}), 400

        # プロンプトをまとめる
        final_prompt = prompt
        if extra_detail:
            final_prompt += f"\n\n追加の要望:\n{extra_detail}"

        # 写真寄りにしたい時の補強文
        final_prompt += """

高品質なフォトリアル画像。
自然な肌、自然な光、実写風、リアルな質感、不自然なイラスト感を避ける。
人物がいる場合は、顔・手・指・目を自然に整える。
"""

        print("===== generate_image start =====")
        print("final_prompt:", final_prompt)
        print("size:", size)

        # OpenAI Images API
        # GPT image models は base64 画像を返せる
        result = client.images.generate(
            model="gpt-image-1",
            prompt=final_prompt,
            size=size,
            quality="high",
        )

        if not result.data or len(result.data) == 0:
            raise RuntimeError("画像データが返ってきませんでした")

        image_b64 = result.data[0].b64_json
        if not image_b64:
            raise RuntimeError("b64_json が空でした")

        image_url = f"data:image/png;base64,{image_b64}"

        print("===== generate_image success =====")

        return jsonify({
            "success": True,
            "image_url": image_url,
            "final_prompt": final_prompt
        })

    except Exception as e:
        print("===== generate_image error =====")
        print("error:", repr(e))
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

# =========================
# Render 用
# =========================

if __name__ == "__main__":
    app.run(debug=True)