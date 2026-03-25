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
  const inputUser = document.getElementById("inputUser");
  const sendBtn = document.getElementById("sendBtn");

  const cameraArea = document.getElementById("cameraArea");
  const imageInput1 = document.getElementById("imageInput1");

  const previewArea = document.getElementById("previewArea");
  const previewImg = document.getElementById("previewImg");

  if (
    !chatArea || !choiceRow || !inputBox || !inputUser ||
    !sendBtn || !codeInput || !btnCodeOk
  ) {
    console.error("必要な要素が見つかりません");
    return;
  }

  let stage = "idle";
  let bImageBase64 = "";

  const bData = {
    goal: "",
    editPoint: "",
    mood: "",
    keep: ""
  };

  inputBox.style.display = "none";
  choiceRow.style.display = "none";
  if (cameraArea) cameraArea.style.display = "none";
  if (previewArea) previewArea.style.display = "none";

  function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatArea.appendChild(bubble);
    scrollToBottom();
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function resetBFlow() {
    stage = "idle";
    bImageBase64 = "";
    bData.goal = "";
    bData.editPoint = "";
    bData.mood = "";
    bData.keep = "";

    if (previewImg) previewImg.src = "";
    if (previewArea) previewArea.style.display = "none";
    if (cameraArea) cameraArea.style.display = "none";

    inputBox.style.display = "none";
    choiceRow.style.display = "none";
    chatArea.innerHTML = "";
  }

  function startBFlow() {
    stage = "b-ask-goal";

    addBubble("user", "B");
    addBubble("ai", "画像修正だね🐾");
    addBubble("ai", "先に修正したい画像を選んでね🐾");

    if (cameraArea) cameraArea.style.display = "block";
    if (previewArea) previewArea.style.display = "none";

    inputBox.style.display = "flex";

    addBubble("ai", "どんな仕上がりにしたい？🐾");

    inputUser.value = "";
    inputUser.focus();
  }

  function handleCodeCheck() {
    const code = codeInput.value.trim();
    chatArea.innerHTML = "";

    if (!code) {
      addBubble("ai", "コードを入力してね🐾");
      return;
    }

    addBubble("ai", "コードを確認したよ🐾");
    addBubble("ai", "今日はBパターンの確認だよ🐾 Bを押して始めてね🐾");

    choiceRow.style.display = "flex";

    btnYes.textContent = "B";
    btnYes.onclick = startBFlow;

    btnNo.textContent = "戻る";
    btnNo.onclick = function () {
      resetBFlow();
      addBubble("ai", "ようこそAIコミュへ🐾");
      addBubble("ai", "コードを入力してOKを押してね🐾");
      codeInput.value = "";
      codeInput.focus();
    };
  }

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

  btnCodeOk.addEventListener("click", handleCodeCheck);

  codeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleCodeCheck();
  });

  // 👇ここが一番大事（プレビュー）
  if (imageInput1) {
    imageInput1.addEventListener("change", async function (e) {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        bImageBase64 = await fileToBase64(file);

        if (previewImg) {
          previewImg.src = URL.createObjectURL(file);
        }

        if (previewArea) {
          previewArea.style.display = "block";
        }

      } catch (error) {
        console.error(error);
        addBubble("ai", "画像の読み込みに失敗したよ🐾");
      }
    });
  }

  sendBtn.addEventListener("click", function () {
    const text = inputUser.value.trim();

    if (!stage || stage === "idle") {
      addBubble("ai", "先にコードを入れて B を押してね🐾");
      return;
    }

    if (!text) {
      addBubble("ai", "入力してね🐾");
      return;
    }

    addBubble("user", text);

    if (stage === "b-ask-goal") {
      bData.goal = text;
      stage = "b-ask-edit";
      inputUser.value = "";
      addBubble("ai", "どこをどう変えたい？🐾");
      return;
    }

    if (stage === "b-ask-edit") {
      bData.editPoint = text;
      stage = "b-ask-mood";
      inputUser.value = "";
      addBubble("ai", "どんな雰囲気にする？🐾");
      return;
    }

    if (stage === "b-ask-mood") {
      bData.mood = text;
      stage = "b-ask-keep";
      inputUser.value = "";
      addBubble("ai", "ここはそのままにしたい、ってところある？🐾");
      return;
    }

    if (stage === "b-ask-keep") {
      bData.keep = text;
      stage = "done";
      inputUser.value = "";

      addBubble("ai", "まとめ👇");
      addBubble("ai",
        `・${bData.goal}\n・${bData.editPoint}\n・${bData.mood}\n・${bData.keep}`
      );

      addBubble("ai", "ここまで通ればOKだよ🐾");
      return;
    }
  });

  inputUser.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      sendBtn.click();
    }
  });

  addBubble("ai", "ようこそAIコミュへ🐾");
  addBubble("ai", "コードを入力してOKを押してね🐾");
});