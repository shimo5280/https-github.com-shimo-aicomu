import os
from flask import Flask, render_template, jsonify

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/generate_image", methods=["POST"])
def generate_image():
    return jsonify({
        "success": False,
        "error": "一時停止中"
    })

if __name__ == "__main__":
    print("APP FILE:", __file__)
    print("CWD:", os.getcwd())
    print("TEMPLATES EXISTS:", os.path.exists("templates/index.html"))
    print("STATIC EXISTS:", os.path.exists("static"))
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)