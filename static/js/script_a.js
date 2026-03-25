document.addEventListener("DOMContentLoaded", function () {
  const chatArea = document.getElementById("chatArea");
  const inputUser = document.getElementById("inputUser");
  const sendBtn = document.getElementById("sendBtn");

  const previewArea = document.getElementById("previewArea");
  const previewImg = document.getElementById("previewImg");

  const imageInput1 = document.getElementById("imageInput1");
  const btnCamera = document.getElementById("btnCamera");

  let stage = "idle";
  let bImageBase64 = "";

  const bData = {
    goal: "",
    editPoint: "",
    mood: "",
    keep: ""
  };

  function addBubble(role, text) {
    const div = document.createElement("div");
    div.className = `bubble ${role}`;
    div.textContent = text;
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // =========================
  // 画像選択
  // =========================
  if (btnCamera && imageInput1) {
    btnCamera.addEventListener("click", () => {
      imageInput1.click();
    });
  }

  if (imageInput1) {
    imageInput1.addEventListener("change", async function (e) {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        bImageBase64 = await fileToBase64(file);

        // プレビュー表示
        if (previewImg) {
          previewImg.src = URL.createObjectURL(file);
        }
        if (previewArea) {
          previewArea.style.display = "block";
        }

      } catch (err) {
        console.error(err);
        addBubble("ai", "画像読み込み失敗したよ🐾");
      }
    });
  }

  // =========================
  // B開始
  // =========================
  function startB() {
    stage = "goal";
    addBubble("ai", "Bパターン開始🐾");
    addBubble("ai", "どんな仕上がりにしたい？");
  }

  startB(); // テスト用で即開始

  // =========================
  // 入力処理
  // =========================
  sendBtn.addEventListener("click", () => {
    const text = inputUser.value.trim();
    if (!text) return;

    addBubble("user", text);
    inputUser.value = "";

    if (stage === "goal") {
      bData.goal = text;
      stage = "edit";
      addBubble("ai", "どこをどう変えたい？");
      return;
    }

    if (stage === "edit") {
      bData.editPoint = text;
      stage = "mood";
      addBubble("ai", "どんな雰囲気にする？");
      return;
    }

    if (stage === "mood") {
      bData.mood = text;
      stage = "keep";
      addBubble("ai", "残したいところは？");
      return;
    }

    if (stage === "keep") {
      bData.keep = text;
      stage = "done";

      addBubble("ai", "まとめ👇");
      addBubble("ai",
        `・${bData.goal}\n・${bData.editPoint}\n・${bData.mood}\n・${bData.keep}`
      );

      addBubble("ai", "ここまでOKなら次いける👍");
      return;
    }
  });

  inputUser.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      sendBtn.click();
    }
  });
});