document.addEventListener("DOMContentLoaded", function () {
  const pageTop = document.getElementById("pageTop");
  const pageAicomu = document.getElementById("pageAicomu");
  const goAicomu = document.getElementById("goAicomu");
  const loadingOverlay = document.getElementById("loadingOverlay");

  const codeInput = document.getElementById("codeInput");
  const btnCodeOk = document.getElementById("btnCodeOk");

  const chatArea = document.getElementById("chatArea");
  const choiceRow = document.getElementById("choiceRow");
  const btnYes = document.getElementById("btnYes");
  const btnNo = document.getElementById("btnNo");

  const inputBox = document.getElementById("inputBox");
  const cameraArea = document.getElementById("cameraArea");
  const imageInput1 = document.getElementById("imageInput1");
  const imageInput2 = document.getElementById("imageInput2");

  const previewArea = document.getElementById("previewArea");
  const previewImg = document.getElementById("previewImg");

  const inputUser = document.getElementById("inputUser");
  const sendBtn = document.getElementById("sendBtn");

  const CODE_VALUE = "AICOMU2026";

  let currentMode = "";
  let file1 = null;
  let file2 = null;

  inputBox.style.display = "none";
  choiceRow.style.display = "none";
  cameraArea.style.display = "none";
  previewArea.style.display = "none";

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatArea.appendChild(bubble);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  // 🔥 プレビュー表示（ここが今回の核心）
  function updatePreview() {
    if (!file1 && !file2) {
      previewArea.style.display = "none";
      previewImg.src = "";
      return;
    }

    const file = file1 || file2;

    previewImg.src = URL.createObjectURL(file);
    previewArea.style.display = "block";
  }

  function clearPreview() {
    file1 = null;
    file2 = null;

    imageInput1.value = "";
    imageInput2.value = "";

    previewImg.src = "";
    previewArea.style.display = "none";
  }

  // スタート遷移
  goAicomu.addEventListener("click", function () {
    loadingOverlay.classList.remove("hidden");

    setTimeout(() => {
      loadingOverlay.classList.add("hidden");
      pageTop.classList.add("hidden");
      pageAicomu.classList.remove("hidden");
      codeInput.focus();
    }, 700);
  });

  // コード確認
  function handleCodeCheck() {
    const code = codeInput.value.trim();
    chatArea.innerHTML = "";

    if (code !== CODE_VALUE) {
      addBubble("ai", "コードが違うよ🐾");
      return;
    }

    addBubble("ai", "コードOK🐾");
    addBubble("ai", "A：生成 / B：修正 どっち？🐾");

    choiceRow.style.display = "flex";
  }

  btnCodeOk.addEventListener("click", handleCodeCheck);

  // A
  btnYes.onclick = function () {
    currentMode = "A";
    addBubble("user", "A");
    addBubble("ai", "画像生成だよ🐾");

    inputBox.style.display = "flex";
    cameraArea.style.display = "none";
    clearPreview();
  };

  // B
  btnNo.onclick = function () {
    currentMode = "B";
    addBubble("user", "B");
    addBubble("ai", "画像修正だよ🐾");
    addBubble("ai", "画像を選んでね🐾");

    inputBox.style.display = "flex";
    cameraArea.style.display = "flex";
    clearPreview();
  };

  // 🔥 画像選択
  imageInput1.addEventListener("change", function () {
    file1 = imageInput1.files[0] || null;
    updatePreview();
  });

  imageInput2.addEventListener("change", function () {
    file2 = imageInput2.files[0] || null;
    updatePreview();
  });

  // 送信
  sendBtn.addEventListener("click", function () {
    const text = inputUser.value.trim();

    if (!currentMode) {
      addBubble("ai", "AかB選んでね🐾");
      return;
    }

    if (currentMode === "B") {
      if (!file1 && !file2) {
        addBubble("ai", "画像選んでね🐾");
        return;
      }

      addBubble("user", "この画像で進める");

      // 👇ここでプレビューはそのまま残す
      addBubble("ai", "OK、この画像で進めるね🐾");
    }

    inputUser.value = "";
  });

  addBubble("ai", "ようこそAIコミュへ🐾");
  addBubble("ai", "コードを入力してOK押してね🐾");
});