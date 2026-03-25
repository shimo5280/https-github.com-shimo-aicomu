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

  const aData = {
    purpose: "",
    subject: "",
    imageType: "",
    extra: ""
  };

  const bData = {
    request: "",
    finishType: "",
    keepPart: "",
    extra: ""
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
    return bubble;
  }

  function addImageBubble(files) {
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
    const bubble = document.createElement("div");
    bubble.className = "bubble ai loading";
    bubble.textContent = "🐾";
    chatArea.appendChild(bubble);
    scrollToBottom();

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
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.split(",")[1] || "");
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
    bData.finishType = "";
    bData.keepPart = "";
    bData.extra = "";
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
      inputUser.value = "";
      inputUser.focus();
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

      if (data.image_b64) {
        addGeneratedImageBubble(data.image_b64);
      } else {
        addBubble("ai", "画像データが見つからなかったよ🐾");
      }

      resetAData();
      stage = "a-purpose";
      addBubble("ai", "もう一回やるなら、この画像は何に使う予定？🐾");
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
    } finally {
      isGenerating = false;
      inputUser.value = "";
      inputUser.focus();
    }
  }

  function buildBPrompt() {
    const selectedCount = [file1, file2].filter(Boolean).length;
    const modeText = selectedCount === 2 ? "2枚の画像編集" : "1枚の画像修正";

    return [
      `${modeText}`,
      "",
      "元の画像の内容はできるだけ維持する。",
      "",
      `変更したい内容: ${bData.request}`,
      `仕上がり: ${bData.finishType}`,
      `残したい部分: ${bData.keepPart || "なし"}`,
      `追加: ${bData.extra || "なし"}`,
      "",
      "不要な要素（文字・ロゴ・透かし・余計な装飾）は追加しない。",
      "色味・光・影・質感を自然に補正し、違和感なく馴染ませる。"
    ].join("\n");
  }

  async function generateBImage() {
    if (isGenerating) return;
    isGenerating = true;

    const loading = addFootprintLoadingBubble();

    try {
      const image_b64 = file1 ? await fileToBase64(file1) : "";
      const image_b64_2 = file2 ? await fileToBase64(file2) : "";
      const finalPrompt = buildBPrompt();

      const res = await fetch("/api/edit_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeInput.value.trim(),
          prompt: finalPrompt,
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

      if (data.image_b64) {
        addGeneratedImageBubble(data.image_b64);
      } else {
        addBubble("ai", "画像データが見つからなかったよ🐾");
      }

      resetPreview();
      resetBData();
      stage = "b-wait-images";
      addBubble("ai", "もう一回やるなら、画像を📷1・📷2から選んで送信してね🐾");
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
    } finally {
      isGenerating = false;
      inputUser.value = "";
      inputUser.focus();
    }
  }

  // スタート遷移
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

  // コード確認
  function handleCodeCheck() {
    const code = codeInput.value.trim();
    chatArea.innerHTML = "";

    if (!code) {
      addBubble("ai", "コードを入力してね🐾");
      return;
    }

    if (code !== CODE_VALUE) {
      addBubble("ai", "コードが違うよ🐾");
      choiceRow.style.display = "none";
      inputBox.style.display = "none";
      if (cameraArea) cameraArea.style.display = "none";
      if (previewArea) previewArea.style.display = "none";
      return;
    }

    addBubble("ai", "コードOK🐾");
    addBubble("ai", "A：生成 / B：修正 どっち？🐾");

    choiceRow.style.display = "flex";
    inputBox.style.display = "none";
    if (cameraArea) cameraArea.style.display = "none";
    if (previewArea) previewArea.style.display = "none";

    currentMode = "";
    stage = "idle";
    resetPreview();
    resetAData();
    resetBData();
  }

  btnCodeOk.addEventListener("click", handleCodeCheck);

  codeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleCodeCheck();
  });

  // A
  btnYes.addEventListener("click", function () {
    currentMode = "A";
    stage = "a-purpose";
    resetAData();
    resetPreview();

    addBubble("user", "A");
    addBubble("ai", "画像生成だね🐾");
    addBubble("ai", "まず、この画像は何に使う予定？🐾\n例：SNS投稿、アイコン、ホームページ背景、鑑賞用など");

    inputBox.style.display = "flex";
    if (cameraArea) cameraArea.style.display = "none";
    inputUser.value = "";
    inputUser.focus();
  });

  // B
  btnNo.addEventListener("click", function () {
    currentMode = "B";
    stage = "b-wait-images";
    resetBData();
    resetPreview();

    addBubble("user", "B");
    addBubble("ai", "画像修正だね🐾");
    addBubble("ai", "画像を📷1・📷2から2枚まで選べるよ🐾\n選んだら送信を押してね🐾");

    inputBox.style.display = "flex";
    if (cameraArea) cameraArea.style.display = "flex";
    inputUser.value = "";
    inputUser.focus();
  });

  // 画像選択
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

  // 送信
  sendBtn.addEventListener("click", async function () {
    const text = inputUser.value.trim();

    if (!currentMode) {
      addBubble("ai", "AかB選んでね🐾");
      return;
    }

    // A
    if (currentMode === "A") {
      if (!text) {
        addBubble("ai", "入力してね🐾");
        return;
      }

      addBubble("user", text);

      if (stage === "a-purpose") {
        aData.purpose = text;
        stage = "a-subject";
        inputUser.value = "";
        addBubble("ai", "次に何を主役にしたい？🐾\n例：かわいい猫、キレイな景色、ポップなロゴ");
        return;
      }

      if (stage === "a-subject") {
        aData.subject = text;
        stage = "a-type";
        inputUser.value = "";
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
        inputUser.value = "";
        addBubble("ai", "生成する準備ができたよ🐾");
        addBubble("ai", "このままでよければ、もう一度送信してね🐾");
        inputUser.value = "生成";
        return;
      }

      if (stage === "a-confirm") {
        await generateAImage();
        inputUser.value = "";
        return;
      }
    }

    // B
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

        const selectedCount = [file1, file2].filter(Boolean).length;
        stage = "b-request";

        if (selectedCount === 2) {
          addBubble("ai", "この2枚をどうしたいか教えて🐾\n例：この服をこの人に着せたい、この背景に入れたい、2枚を合成したい");
        } else {
          addBubble("ai", "画像のどこを変えたいか教えて🐾\n例：全体をカラー、障害物を除く、背景を海に など");
        }

        inputUser.value = "";
        return;
      }

      if (!text) {
        addBubble("ai", "入力してね🐾");
        return;
      }

      addBubble("user", text);

      if (stage === "b-request") {
        bData.request = text;
        stage = "b-finish";
        inputUser.value = "";
        addBubble("ai", "仕上がりはどんな感じがいい？🐾\n例：写真風、イラスト風、漫画風、自然な感じ");
        return;
      }

      if (stage === "b-finish") {
        bData.finishType = text;
        stage = "b-keep";
        inputUser.value = "";
        addBubble("ai", "元の画像で残したい部分はある？🐾\n例：顔はそのまま、構図はそのまま、なし");
        return;
      }

      if (stage === "b-keep") {
        bData.keepPart = text === "なし" ? "" : text;
        stage = "b-extra";
        inputUser.value = "";
        addBubble("ai", "最後に追加したいことがあれば教えてね🐾\nなければ「なし」で大丈夫だよ🐾");
        return;
      }

      if (stage === "b-extra") {
        bData.extra = text === "なし" ? "" : text;
        stage = "b-confirm";
        inputUser.value = "";
        addBubble("ai", "こんな感じで進めるよ🐾");
        addBubble(
          "ai",
          `・修正したい内容：${bData.request}\n` +
          `・仕上がり：${bData.finishType}\n` +
          `・残したい部分：${bData.keepPart || "なし"}\n` +
          `・追加：${bData.extra || "なし"}`
        );
        addBubble("ai", "このままでよければ、もう一度送信してね🐾");
        inputUser.value = "修正";
        return;
      }

      if (stage === "b-confirm") {
        await generateBImage();
        inputUser.value = "";
        return;
      }
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