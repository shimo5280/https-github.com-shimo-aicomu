import os
from flask import Flask, request, jsonify
from openai import OpenAI
import os
from flask import Flask, request, jsonify
from openai import OpenAI

app = Flask(__name__)

# APIキー（環境変数）
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# =========================
# Bテスト用API
# =========================
@app.route("/api/b_test", methods=["POST"])
def b_test():
    try:
        data = request.get_json()
        text = data.get("text", "")

        if not text:
            return jsonify({"ok": False, "message": "入力が空"})

        response = client.responses.create(
            model="gpt-4.1-mini",
            input=[
                {
                    "role": "system",
                    "content": """
あなたは画像編集AIです。

ユーザーの内容をもとに：

① 日本語で分かりやすく整理
② 英語の画像編集プロンプトを作成

出力形式は必ず：

summary: （日本語まとめ）
prompt: （英語プロンプト）
"""
                },
                {
                    "role": "user",
                    "content": text
                }
            ]
        )

        output = response.output[0].content[0].text

        # 分解
        summary = ""
        prompt = ""

        if "prompt:" in output:
            parts = output.split("prompt:")
            summary = parts[0].replace("summary:", "").strip()
            prompt = parts[1].strip()
        else:
            summary = output
            prompt = ""

        return jsonify({
            "ok": True,
            "summary": summary,
            "prompt": prompt
        })

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"ok": False, "message": "エラー"})


# =========================
# 起動
# =========================
if __name__ == "__main__":
    app.run(debug=True)
app = Flask(__name__)

# APIキー（環境変数）
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# =========================
# Bテスト用API
# =========================
@app.route("/api/b_test", methods=["POST"])
def b_test():
    try:
        data = request.get_json()
        text = data.get("text", "")

        if not text:
            return jsonify({"ok": False, "message": "入力が空"})

        response = client.responses.create(
            model="gpt-4.1-mini",
            input=[
                {
                    "role": "system",
                    "content": """
あなたは画像編集AIです。

ユーザーの内容をもとに：

① 日本語で分かりやすく整理
② 英語の画像編集プロンプトを作成

出力形式は必ず：

summary: （日本語まとめ）
prompt: （英語プロンプト）
"""
                },
                {
                    "role": "user",
                    "content": text
                }
            ]
        )

        output = response.output[0].content[0].text

        # 分解
        summary = ""
        prompt = ""

        if "prompt:" in output:
            parts = output.split("prompt:")
            summary = parts[0].replace("summary:", "").strip()
            prompt = parts[1].strip()
        else:
            summary = output
            prompt = ""

        return jsonify({
            "ok": True,
            "summary": summary,
            "prompt": prompt
        })

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"ok": False, "message": "エラー"})


# =========================
# 起動
# =========================
if __name__ == "__main__":
    app.run(debug=True)

   