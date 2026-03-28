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

  const CODE_VALUE = "AICOMU2026";

  let currentMode = "";
  let stage = "idle";
  let isGenerating = false;

  let file1 = null;
  let file2 = null;
  let lastResultImageB64 = "";

  const aData = {
    purpose: "",
    subject: "",
    imageType: "",
    extra: ""
  };

  const bData = {
    request: "",
    target: "",
    finishType: "",
    extra: "",
    summary: "",
    advice: ""
  };

  if (inputBox) inputBox.style.display = "none";
  if (choiceRow) choiceRow.style.display = "none";
  if (cameraArea) cameraArea.style.display = "none";
  if (previewArea) previewArea.style.display = "none";

  function scrollToBottom() {
    if (!chatArea) return;
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function addBubble(role, text) {
    if (!chatArea) return null;
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    chatArea.appendChild(bubble);
    scrollToBottom();
    return bubble;
  }

  function addImageBubble(files) {
    if (!chatArea) return;

    const bubble = document.createElement("div");
    bubble.className = "bubble user";

    files.forEach((file) => {
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
    scrollToBottom();
  }

  function addGeneratedImageBubble(base64) {
    if (!chatArea || !base64) return;

    const bubble = document.createElement("div");
    bubble.className = "bubble ai";

    const img = document.createElement("img");
    img.src = `data:image/png;base64,${base64}`;
    img.style.display = "block";
    img.style.maxWidth = "220px";
    img.style.maxHeight = "220px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "12px";

    bubble.appendChild(img);
    chatArea.appendChild(bubble);
    scrollToBottom();
  }

  function addFootprintLoadingBubble() {
    const bubble = addBubble("ai", "🐾");
    if (!bubble) {
      return {
        stop() {}
      };
    }

    bubble.classList.add("loading");

    let count = 1;
    const interval = setInterval(() => {
      count++;
      if (count > 3) count = 1;
      bubble.textContent = "🐾 ".repeat(count).trim();
    }, 400);

    return {
      stop(finalText) {
        clearInterval(interval);
        bubble.textContent = finalText;
        bubble.classList.remove("loading");
      }
    };
  }
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement("canvas");

        let width = img.width;
        let height = img.height;

        // 👇ここが重要（サイズ制限）
        const maxSize = 1200;

        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // 👇JPEGで軽量化
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

        resolve(dataUrl.split(",")[1]);
      };

      img.onerror = reject;
      img.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
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

  function resetAData() {
    aData.purpose = "";
    aData.subject = "";
    aData.imageType = "";
    aData.extra = "";
  }

  function resetBData() {
    bData.request = "";
    bData.target = "";
    bData.finishType = "";
    bData.extra = "";
    bData.summary = "";
    bData.advice = "";
  }

  function resetAllModes() {
    currentMode = "";
    stage = "idle";
    resetPreview();
    resetAData();
    resetBData();
    lastResultImageB64 = "";
    clearActionButtons();
  }

  function hideChoiceRow() {
    if (choiceRow) choiceRow.style.display = "none";
  }

  function showChoiceRow() {
    if (choiceRow) choiceRow.style.display = "flex";
  }

  function showInputOnly() {
    if (inputBox) inputBox.style.display = "flex";
    if (cameraArea) cameraArea.style.display = "none";
  }

  function showInputWithCamera() {
    if (inputBox) inputBox.style.display = "flex";
    if (cameraArea) cameraArea.style.display = "flex";
  }

  function focusInput() {
    if (inputUser) inputUser.focus();
  }

  function clearActionButtons() {
    const oldRow = document.getElementById("resultActionRow");
    if (oldRow) oldRow.remove();
  }

  function showResultActions() {
    clearActionButtons();

    const row = document.createElement("div");
    row.id = "resultActionRow";
    row.className = "btnRow";
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.justifyContent = "center";
    row.style.margin = "12px 0";

    const btnSave = document.createElement("button");
    btnSave.textContent = "保存する";
    btnSave.type = "button";

    const btnBack = document.createElement("button");
    btnBack.textContent = "戻る";
    btnBack.type = "button";

    btnSave.addEventListener("click", function () {
      if (!lastResultImageB64) {
        addBubble("ai", "保存できる画像がまだないよ🐾");
        return;
      }

      const a = document.createElement("a");
      a.href = `data:image/png;base64,${lastResultImageB64}`;
      a.download = "aicomu_result.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

    btnBack.addEventListener("click", function () {
      clearActionButtons();
      resetPreview();
      resetAData();
      resetBData();
      currentMode = "";
      stage = "idle";
      lastResultImageB64 = "";

      if (inputBox) inputBox.style.display = "none";
      if (cameraArea) cameraArea.style.display = "none";
      if (previewArea) previewArea.style.display = "none";
      showChoiceRow();

      addBubble("ai", "A：生成 / B：修正 どっちにする？🐾");
    });

    row.appendChild(btnSave);
    row.appendChild(btnBack);
    chatArea.appendChild(row);
    scrollToBottom();
  }

  function finishImageResult(imageB64, doneStage, doneMessage) {
    if (!imageB64) {
      addBubble("ai", "画像データが見つからなかったよ🐾");
      return;
    }

    lastResultImageB64 = imageB64;
    addGeneratedImageBubble(imageB64);
    stage = doneStage;

    if (inputBox) inputBox.style.display = "none";
    if (cameraArea) cameraArea.style.display = "none";
    if (previewArea) previewArea.style.display = "none";

    addBubble("ai", doneMessage || "できたよ🐾");
    addBubble("ai", "保存する？それとも戻る？🐾");
    showResultActions();
  }

  async function requestSummaryA() {
    const loading = addFootprintLoadingBubble();

    try {
      const res = await fetch("/api/generate_summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeInput.value.trim(),
          purpose: aData.purpose,
          style: aData.subject,
          image_type: aData.imageType
        })
      });

      const data = await res.json();

      if (!data.ok) {
        loading.stop(data.message || "まとめに失敗したよ🐾");
        stage = "a-purpose";
        return;
      }

      loading.stop("こんな感じでまとめたよ🐾");
      addBubble("ai", data.summary || "まとめを作ったよ🐾");
      addBubble("ai", "AIアドバイス🐾\n" + (data.advice || "少し具体的にすると良いよ🐾"));
      addBubble("ai", "もう1つだけ追加したいことがあれば教えてね🐾\nなければ「なし」で大丈夫だよ🐾");

      stage = "a-extra";
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
      stage = "a-purpose";
    } finally {
      if (inputUser) inputUser.value = "";
      focusInput();
    }
  }

  async function generateAImage() {
    if (isGenerating) return;
    isGenerating = true;

    const finalPrompt = [
      aData.purpose,
      aData.subject,
      aData.imageType,
      aData.extra
    ].filter(Boolean).join(" / ");

    const loading = addFootprintLoadingBubble();

    try {
      const res = await fetch("/api/generate_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeInput.value.trim(),
          prompt: finalPrompt
        })
      });

      const data = await res.json();

      if (!data.ok) {
        loading.stop(data.message || "画像生成に失敗したよ🐾");
        return;
      }

      loading.stop(data.message || "お待たせ、画像を生成したよ🐾");
      finishImageResult(data.image_b64, "a-done", "できたよ🐾");
      resetAData();
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
    } finally {
      isGenerating = false;
      if (inputUser) inputUser.value = "";
      focusInput();
    }
  }

  async function requestSummaryB() {
    const loading = addFootprintLoadingBubble();

    try {
      const res = await fetch("/api/generate_summary_b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeInput.value.trim(),
          request: bData.request,
          target: bData.target,
          finishType: bData.finishType,
          extra: bData.extra
        })
      });

      const data = await res.json();

      if (!data.ok) {
        loading.stop(data.message || "まとめ失敗🐾");
        stage = "b-request";
        return;
      }

      bData.summary = data.summary || "";
      bData.advice = data.advice || "";

      loading.stop("まとめたよ🐾");
      addBubble("ai", bData.summary);
      addBubble("ai", "アドバイス🐾\n" + bData.advice);
      addBubble("ai", "この内容でいい？OKなら送信してね🐾");

      stage = "b-confirm";
      if (inputUser) inputUser.value = "修正";
    } catch (e) {
      console.error(e);
      loading.stop("通信エラー🐾");
      stage = "b-request";
    } finally {
      focusInput();
    }
  }

  async function generateBImage() {
    if (isGenerating) return;
    isGenerating = true;

    const loading = addFootprintLoadingBubble();

    try {
      const image_b64 = file1 ? await fileToBase64(file1) : "";
      const image_b64_2 = file2 ? await fileToBase64(file2) : "";

      const res = await fetch("/api/edit_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeInput.value.trim(),
          prompt: bData.summary,
          image_b64: image_b64,
          image_b64_2: image_b64_2
        })
      });

      const data = await res.json();

      if (!data.ok) {
        loading.stop(data.message || "画像修正に失敗したよ🐾");
        return;
      }

      loading.stop(data.message || "お待たせ、画像を修正したよ🐾");
      finishImageResult(data.image_b64, "b-done", "できたよ🐾");
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
    } finally {
      isGenerating = false;
      if (inputUser) inputUser.value = "";
      focusInput();
    }
  }

  if (goAicomu) {
    goAicomu.addEventListener("click", function () {
      if (loadingOverlay) loadingOverlay.classList.remove("hidden");

      setTimeout(function () {
        if (loadingOverlay) loadingOverlay.classList.add("hidden");
        if (pageTop) pageTop.classList.add("hidden");
        if (pageAicomu) pageAicomu.classList.remove("hidden");
        if (codeInput) codeInput.focus();
      }, 700);
    });
  }

  function handleCodeCheck() {
    const code = codeInput ? codeInput.value.trim() : "";
    if (chatArea) chatArea.innerHTML = "";
    clearActionButtons();

    if (!code) {
      addBubble("ai", "コードを入力してね🐾");
      return;
    }

    if (code !== CODE_VALUE) {
      addBubble("ai", "コードが違うよ🐾");
      hideChoiceRow();
      if (inputBox) inputBox.style.display = "none";
      if (cameraArea) cameraArea.style.display = "none";
      if (previewArea) previewArea.style.display = "none";
      resetAllModes();
      return;
    }

    addBubble("ai", "コードOK🐾");
    addBubble("ai", "A：生成 / B：修正 どっち？🐾");

    showChoiceRow();
    if (inputBox) inputBox.style.display = "none";
    if (cameraArea) cameraArea.style.display = "none";
    if (previewArea) previewArea.style.display = "none";

    resetAllModes();
  }

  if (btnCodeOk) {
    btnCodeOk.addEventListener("click", handleCodeCheck);
  }

  if (codeInput) {
    codeInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        handleCodeCheck();
      }
    });
  }

  if (btnYes) {
    btnYes.addEventListener("click", function () {
      currentMode = "A";
      stage = "a-purpose";
      resetAData();
      resetPreview();
      clearActionButtons();

      addBubble("user", "A");
      addBubble("ai", "画像生成だね🐾");
      addBubble("ai", "まず、この画像は何に使う予定？🐾\n例：SNS投稿、アイコン、ホームページ背景、鑑賞用など");

      hideChoiceRow();
      showInputOnly();
      if (inputUser) inputUser.value = "";
      focusInput();
    });
  }

  if (btnNo) {
    btnNo.addEventListener("click", function () {
      currentMode = "B";
      stage = "b-wait-images";
      resetBData();
      resetPreview();
      clearActionButtons();

      addBubble("user", "B");
      addBubble("ai", "画像修正だね🐾");
      addBubble("ai", "画像を1枚または2枚選べるよ🐾\n選んだら送信してね🐾");

      hideChoiceRow();
      showInputWithCamera();
      if (inputUser) inputUser.value = "";
      focusInput();
    });
  }

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

  if (sendBtn) {
    sendBtn.addEventListener("click", async function () {
      const text = inputUser ? inputUser.value.trim() : "";

      if (!currentMode) {
        addBubble("ai", "AかB選んでね🐾");
        return;
      }

      if (currentMode === "A") {
        if (!text && stage !== "a-confirm") {
          addBubble("ai", "入力してね🐾");
          return;
        }

        if (text) {
          addBubble("user", text);
        }

        if (stage === "a-purpose") {
          aData.purpose = text;
          stage = "a-subject";
          if (inputUser) inputUser.value = "";
          addBubble("ai", "次に何を主役にしたい？🐾\n例：かわいい猫、キレイな景色、ポップなロゴ");
          return;
        }

        if (stage === "a-subject") {
          aData.subject = text;
          stage = "a-type";
          if (inputUser) inputUser.value = "";
          addBubble("ai", "最後に、画像の仕上がりはどんな感じにする？🐾\n例：写真風、イラスト風、漫画風");
          return;
        }

        if (stage === "a-type") {
          aData.imageType = text;
          await requestSummaryA();
          return;
        }

        if (stage === "a-extra") {
          aData.extra = text === "なし" ? "" : text;
          stage = "a-confirm";
          if (inputUser) inputUser.value = "生成";
          addBubble("ai", "生成する準備ができたよ🐾");
          addBubble("ai", "このままでよければ、そのまま送信してね🐾");
          return;
        }

        if (stage === "a-confirm") {
          await generateAImage();
          if (inputUser) inputUser.value = "";
          return;
        }

        if (stage === "a-done") {
          return;
        }
      }

      if (currentMode === "B") {
        if (stage === "b-wait-images") {
          if (!file1 && !file2) {
            addBubble("ai", "画像選んでね🐾");
            return;
          }

          const files = [];
          if (file1) files.push(file1);
          if (file2) files.push(file2);

          addImageBubble(files);

          if (previewArea) previewArea.style.display = "none";

          stage = "b-request";
          if (inputUser) inputUser.value = "";

          if (files.length === 2) {
            addBubble("ai", "この2枚でどんなことしたい？🐾\n例：服を入れ替える、人物を合成する");
          } else {
            addBubble("ai", "この画像をどう修正したい？🐾\n例：服を変える、明るくする、雰囲気を変える");
          }
          return;
        }

        if (!text && stage !== "b-confirm") {
          addBubble("ai", "入力してね🐾");
          return;
        }

        if (text) {
          addBubble("user", text);
        }

        if (stage === "b-request") {
          bData.request = text;
          stage = "b-background";
          if (inputUser) inputUser.value = "";
          addBubble("ai", "背景も変える？🐾\n例：海、街、ファンタジー、変えない");
          return;
        }

        if (stage === "b-background") {
          bData.target = text;
          stage = "b-mood";
          if (inputUser) inputUser.value = "";
          addBubble("ai", "どんな雰囲気にしたい？🐾\n例：ナチュラル、おしゃれ、ポップ");
          return;
        }

        if (stage === "b-mood") {
          bData.finishType = text;
          stage = "b-style";
          if (inputUser) inputUser.value = "";
          addBubble("ai", "最後に、仕上がりはどんな感じにする？🐾\n色合いとスタイルを教えてね\n例：カラーで写真風、セピアでイラスト風、モノクロでくっきり");
          return;
        }

        if (stage === "b-style") {
          bData.extra = text;
          if (inputUser) inputUser.value = "";
          await requestSummaryB();
          return;
        }

        if (stage === "b-confirm") {
          await generateBImage();
          if (inputUser) inputUser.value = "";
          return;
        }

        if (stage === "b-done") {
          return;
        }
      }
    });
  }

  if (inputUser) {
    inputUser.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (sendBtn) sendBtn.click();
      }
    });
  }

  addBubble("ai", "ようこそAIコミュへ🐾");
  addBubble("ai", "コードを入力してOKを押してね🐾");
});