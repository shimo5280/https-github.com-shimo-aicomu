document.addEventListener("DOMContentLoaded", function () {

  const pageTop = document.getElementById("pageTop");
  const pageAicomu = document.getElementById("pageAicomu");
  const goAicomu = document.getElementById("goAicomu");
  const loadingOverlay = document.getElementById("loadingOverlay");

  const codeInput = document.getElementById("codeInput");
  const btnCodeOk = document.getElementById("btnCodeOk");

  const chatArea = document.getElementById("chatArea");
  const choiceRow = document.getElementById("choiceRow");
  const btnYes = document.getElementById("btnYes"); // A
  const btnNo = document.getElementById("btnNo");   // B

  const inputBox = document.getElementById("inputBox");
  const inputUser = document.getElementById("inputUser");
  const sendBtn = document.getElementById("sendBtn");

  const cameraArea = document.getElementById("cameraArea");
  const imageInput1 = document.getElementById("imageInput1");
  const imageInput2 = document.getElementById("imageInput2");
  const previewArea = document.getElementById("previewArea");

  let currentMode = "";
  let file1 = null;
  let file2 = null;

  inputBox.style.display = "none";
  choiceRow.style.display = "none";
  if (cameraArea) cameraArea.style.display = "none";
  if (previewArea) previewArea.style.display = "none";

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatArea.appendChild(bubble);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  // =====================
  // 🔥 B：プレビュー（2枚対応）
  // =====================
  function updatePreview() {
    if (!previewArea) return;

    previewArea.innerHTML = "";

    if (!file1 && !file2) {
      previewArea.style.display = "none";
      return;
    }

    previewArea.style.display = "block";

    [file1, file2].forEach((file) => {
      if (!file) return;

      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);

      img.style.width = "90px";
      img.style.height = "90px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      img.style.margin = "4px";

      previewArea.appendChild(img);
    });
  }

  function resetPreview() {
    file1 = null;
    file2 = null;

    if (imageInput1) imageInput1.value = "";
    if (imageInput2) imageInput2.value = "";

    if (previewArea) {
      previewArea.innerHTML = "";
      previewArea.style.display = "none";
    }
  }

  // =====================
  // スタート遷移
  // =====================
  if (goAicomu) {
    goAicomu.addEventListener("click", function () {
      if (loadingOverlay) loadingOverlay.classList.remove("hidden");

      setTimeout(function () {
        if (loadingOverlay) loadingOverlay.classList.add("hidden");
        if (pageTop) pageTop.classList.add("hidden");
        if (pageAicomu) pageAicomu.classList.remove("hidden");
        codeInput.focus();
      }, 700);
    });
  }

  // =====================
  // コード確認
  // =====================
  function handleCodeCheck() {
    const code = codeInput.value.trim();
    chatArea.innerHTML = "";

    if (!code) {
      addBubble("ai", "コードを入力してね🐾");
      return;
    }

    addBubble("ai", "コードOK🐾");
    addBubble("ai", "A：生成 / B：修正 どっち？🐾");

    choiceRow.style.display = "flex";
  }

  btnCodeOk.addEventListener("click", handleCodeCheck);

  // =====================
  // A：画像生成（そのまま）
  // =====================
  btnYes.addEventListener("click", function () {
    currentMode = "A";

    addBubble("user", "A");
    addBubble("ai", "画像生成だよ🐾");

    inputBox.style.display = "flex";
    if (cameraArea) cameraArea.style.display = "none";
    resetPreview();
  });

  // =====================
  // B：画像修正
  // =====================
  btnNo.addEventListener("click", function () {
    currentMode = "B";

    addBubble("user", "B");
    addBubble("ai", "画像修正だよ🐾");
    addBubble("ai", "画像を2枚まで選べるよ🐾");

    inputBox.style.display = "flex";
    if (cameraArea) cameraArea.style.display = "flex";

    resetPreview();
  });

  // =====================
  // 画像選択
  // =====================
  if (imageInput1) {
    imageInput1.addEventListener("change", function () {
      file1 = imageInput1.files[0] || null;
      updatePreview();
    });
  }

  if (imageInput2) {
    imageInput2.addEventListener("change", function () {
      file2 = imageInput2.files[0] || null;
      updatePreview();
    });
  }

  // =====================
  // 送信
  // =====================
  sendBtn.addEventListener("click", function () {

    if (!currentMode) {
      addBubble("ai", "AかB選んでね🐾");
      return;
    }

    if (currentMode === "B") {

      if (!file1 && !file2) {
        addBubble("ai", "画像選んでね🐾");
        return;
      }

      // 🔥 吹き出しに小さく表示
      const bubble = document.createElement("div");
      bubble.className = "bubble user";

      [file1, file2].forEach((file) => {
        if (!file) return;

        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);

        img.style.width = "70px";
        img.style.height = "70px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "8px";
        img.style.margin = "4px";

        bubble.appendChild(img);
      });

      chatArea.appendChild(bubble);
      chatArea.scrollTop = chatArea.scrollHeight;

      if (previewArea) previewArea.style.display = "none";

      addBubble("ai", "どこをどう変えたい？🐾");
      return;
    }

  });

  addBubble("ai", "ようこそAIコミュへ🐾");
  addBubble("ai", "コードを入力してOKを押してね🐾");

});