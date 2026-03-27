document.addEventListener("DOMContentLoaded", function () {
  const chatArea = document.getElementById("chatArea");
  const inputUser = document.getElementById("inputUser");
  const sendBtn = document.getElementById("sendBtn");

  function addBubble(role, text) {
    const div = document.createElement("div");
    div.className = "bubble " + role;
    div.textContent = text;
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 初期表示
  addBubble("ai", "画像修正テストだよ🐾");
  addBubble("ai", "修正したい内容を自由に入力してね🐾");

  sendBtn.addEventListener("click", async function () {
    const text = inputUser.value.trim();
    if (!text) return;

    addBubble("user", text);
    inputUser.value = "";

    // ローディング
    addBubble("ai", "🐾");
    await delay(1000);

    try {
      const res = await fetch("/api/b_test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text
        })
      });

      const data = await res.json();

      if (!data.ok) {
        addBubble("ai", "エラーだよ🐾");
        return;
      }

      // 日本語まとめ
      addBubble("ai", "まとめ🐾\n" + data.summary);

      // 英語プロンプト（ここ重要）
      addBubble("ai", "英語プロンプト🐾\n" + data.prompt);

    } catch (e) {
      console.error(e);
      addBubble("ai", "通信エラー🐾");
    }
  });
});