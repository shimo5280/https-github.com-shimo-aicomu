document.addEventListener("DOMContentLoaded", function () {
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
    keep: "",
    target: "",
    finishType: "",
    extra: "",
    englishPrompt: ""
  };

  function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    if (!base64) return;

    const bubble = document.createElement("div");
    bubble.className = "bubble ai";

    const img = document.createElement("img");
    img.src = `data:image/png;base64,${base64}`;
    img.style.display = "block";
    img.style.maxWidth = "240px";
    img.style.borderRadius = "12px";

    bubble.appendChild(img);
    chatArea.appendChild(bubble);
    scrollToBottom();
  }

  function addFootprintLoadingBubble() {
    const bubble = addBubble("ai", "🐾");
    let count = 1;

    const interval = setInterval(() => {
      count++;
      if (count > 3) count = 1;
      bubble.textContent = "🐾 ".repeat(count).trim();
    }, 350);

    return {
      stop(finalText) {
        clearInterval(interval);
        bubble.textContent = finalText;
      }
    };
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve("");
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.split(",")[1] || "");
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function syncFilesFromInputs() {
    file1 = imageInput1 && imageInput1.files && imageInput1.files[0]
      ? imageInput1.files[0]
      : file1;

    file2 = imageInput2 && imageInput2.files && imageInput2.files[0]
      ? imageInput2.files[0]
      : file2;
  }

  function resetPreview() {
    file1 = null;
    file2 = null;

    if (imageInput1) imageInput1.value = "";
    if (imageInput2) imageInput2.value = "";

    previewArea.innerHTML = "";
    previewArea.classList.add("hidden");
  }

  function updatePreview() {
    previewArea.innerHTML = "";

    if (!file1 && !file2) {
      previewArea.classList.add("hidden");
      return;
    }

    previewArea.classList.remove("hidden");

    [file1, file2].forEach((file) => {
      if (!file) return;
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
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
    bData.keep = "";
    bData.target = "";
    bData.finishType = "";
    bData.extra = "";
    bData.englishPrompt = "";
  }

  function showChoiceRow() {
    choiceRow.classList.remove("hidden");
  }

  function hideChoiceRow() {
    choiceRow.classList.add("hidden");
  }

  function showInputOnly() {
    inputBox.classList.remove("hidden");
    cameraArea.classList.add("hidden");
  }

  function showInputWithCamera() {
    inputBox.classList.remove("hidden");
    cameraArea.classList.remove("hidden");
  }

  function hideInputAndCamera() {
    inputBox.classList.add("hidden");
    cameraArea.classList.add("hidden");
    previewArea.classList.add("hidden");
  }

  function focusInput() {
    inputUser.focus();
  }

  function clearActionButtons() {
    const oldRow = document.getElementById("resultActionRow");
    if (oldRow) oldRow.remove();
  }

  function showResultActions(mode) {
    clearActionButtons();

    const row = document.createElement("div");
    row.id = "resultActionRow";
    row.className = "row";

    const btnSave = document.createElement("button");
    btnSave.textContent = "保存する";

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

      if (mode === "B") {
        btnSave.disabled = true;
        btnSave.textContent = "保存したよ";
        stage = "b-done";
        addBubble("ai", "保存が終わったよ🐾");
      }
    });

    row.appendChild(btnSave);

    if (mode === "A") {
      const btnBack = document.createElement("button");
      btnBack.textContent = "戻る";

      btnBack.addEventListener("click", function () {
        clearActionButtons();
        resetPreview();
        resetAData();
        resetBData();
        currentMode = "";
        stage = "idle";
        lastResultImageB64 = "";
        hideInputAndCamera();
        showChoiceRow();
        addBubble("ai", "A：生成 / B：修正 どっちにする？🐾");
      });

      row.appendChild(btnBack);
    }

    chatArea.appendChild(row);
    scrollToBottom();
  }

  async function requestSummaryA() {
    const loading = addFootprintLoadingBubble();

    try {
      const res = await fetch("/api/generate_summary_a", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeInput.value.trim(),
          purpose: aData.purpose,
          subject: aData.subject,
          image_type: aData.imageType,
          extra: aData.extra
        })
      });

      const data = await res.json();

      if (!data.ok) {
        loading.stop(data.message || "Aのまとめに失敗したよ🐾");
        return false;
      }

      loading.stop("こんな感じでまとめたよ🐾");
      addBubble("ai", data.summary || "まとめを作ったよ🐾");
      addBubble("ai", "AIアドバイス🐾\n" + (data.advice || "少し具体的にするといいよ🐾"));
      return true;
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
      return false;
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
          keep: bData.keep,
          background: bData.target,
          mood: bData.finishType,
          finish: bData.extra
        })
      });

      const data = await res.json();

      if (!data.ok) {
        loading.stop(data.message || "Bのまとめに失敗したよ🐾");
        return false;
      }

      bData.englishPrompt = data.english_prompt || "";

      loading.stop("こんな感じでまとめたよ🐾");
      addBubble("ai", data.summary || "まとめを作ったよ🐾");
      addBubble("ai", "AIアドバイス🐾\n" + (data.advice || "自然さを優先するといいよ🐾"));

      // デバッグ用
      if (bData.englishPrompt) {
        addBubble("ai", "英語プロンプト🐾\n" + bData.englishPrompt);
      }

      return true;
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
      return false;
    }
  }

  async function generateAImage() {
    if (isGenerating) return;
    isGenerating = true;

    const loading = addFootprintLoadingBubble();

    try {
      const finalPrompt = [
        aData.purpose,
        aData.subject,
        aData.imageType,
        aData.extra
      ].filter(Boolean).join(" / ");

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
      lastResultImageB64 = data.image_b64 || "";
      addGeneratedImageBubble(lastResultImageB64);
      stage = "a-done";
      hideInputAndCamera();
      addBubble("ai", "保存する？それとも戻る？🐾");
      showResultActions("A");
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
    } finally {
      isGenerating = false;
    }
  }

  async function generateBImage() {
    if (isGenerating) return;
    isGenerating = true;

    const loading = addFootprintLoadingBubble();

    try {
      syncFilesFromInputs();

      if (!file1 && !file2) {
        loading.stop("画像がまだ入ってないよ🐾");
        addBubble("ai", "画像を選んでから送ってね🐾");
        return;
      }

      if (!bData.englishPrompt.trim()) {
        loading.stop("英語プロンプトがまだないよ🐾");
        addBubble("ai", "先に内容確認まで進めてね🐾");
        return;
      }

      const image_b64 = file1 ? await fileToBase64(file1) : "";
      const image_b64_2 = file2 ? await fileToBase64(file2) : "";

      const res = await fetch("/api/edit_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeInput.value.trim(),
          prompt: bData.englishPrompt,
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
      lastResultImageB64 = data.image_b64 || "";
      addGeneratedImageBubble(lastResultImageB64);
      stage = "b-done";
      hideInputAndCamera();
      addBubble("ai", "保存したらBの体験は終了だよ🐾");
      showResultActions("B");
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
    } finally {
      isGenerating = false;
    }
  }

  function handleCodeCheck() {
    const code = codeInput.value.trim();
    chatArea.innerHTML = "";
    clearActionButtons();

    if (!code) {
      addBubble("ai", "コードを入力してね🐾");
      return;
    }

    if (code !== CODE_VALUE) {
      addBubble("ai", "コードが違うよ🐾");
      hideChoiceRow();
      hideInputAndCamera();
      return;
    }

    addBubble("ai", "コードOK🐾");
    addBubble("ai", "A：生成 / B：修正 どっち？🐾");
    showChoiceRow();
    hideInputAndCamera();
    currentMode = "";
    stage = "idle";
    resetAData();
    resetBData();
    resetPreview();
  }

  btnCodeOk.addEventListener("click", handleCodeCheck);

  codeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleCodeCheck();
  });

  btnYes.addEventListener("click", async function () {
    currentMode = "A";
    stage = "a-purpose";
    resetAData();
    resetPreview();
    clearActionButtons();

    addBubble("user", "A");
    hideChoiceRow();
    showInputOnly();
    inputUser.value = "";
    focusInput();

    const loading = addFootprintLoadingBubble();
    await delay(1000);
    loading.stop("画像生成だね🐾");
    addBubble("ai", "まず、この画像は何に使う予定？🐾\n例：SNS投稿、アイコン、ホームページ背景、鑑賞用など");
  });

  btnNo.addEventListener("click", async function () {
    currentMode = "B";
    stage = "b-wait-images";
    resetBData();
    resetPreview();
    clearActionButtons();

    addBubble("user", "B");
    hideChoiceRow();
    showInputWithCamera();
    inputUser.value = "";
    focusInput();

    const loading = addFootprintLoadingBubble();
    await delay(1000);
    loading.stop("画像修正だね🐾");
    addBubble("ai", "画像を1枚または2枚選べるよ🐾\n選んだら送信してね🐾");
  });

  imageInput1.addEventListener("change", function () {
    file1 = imageInput1.files[0] || null;
    updatePreview();
  });

  imageInput2.addEventListener("change", function () {
    file2 = imageInput2.files[0] || null;
    updatePreview();
  });

  sendBtn.addEventListener("click", async function () {
    const text = inputUser.value.trim();

    if (!currentMode) {
      addBubble("ai", "AかB選んでね🐾");
      return;
    }

    // ===== A =====
    if (currentMode === "A") {
      if (!text && stage !== "a-confirm") {
        addBubble("ai", "入力してね🐾");
        return;
      }

      if (text) addBubble("user", text);

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
        stage = "a-extra";
        inputUser.value = "";
        addBubble("ai", "追加したいことがあれば教えてね🐾\nなければ「なし」で大丈夫だよ🐾");
        return;
      }

      if (stage === "a-extra") {
        aData.extra = text === "なし" ? "" : text;
        const ok = await requestSummaryA();
        if (!ok) return;

        stage = "a-confirm";
        inputUser.value = "生成";
        addBubble("ai", "このままでよければ、そのまま送信してね🐾");
        return;
      }

      if (stage === "a-confirm") {
        await generateAImage();
        inputUser.value = "";
      }

      return;
    }

    // ===== B =====
    if (currentMode === "B") {
      if (stage === "b-wait-images") {
        syncFilesFromInputs();

        if (!file1 && !file2) {
          addBubble("ai", "画像選んでね🐾");
          return;
        }

        const files = [];
        if (file1) files.push(file1);
        if (file2) files.push(file2);

        addImageBubble(files);
        previewArea.classList.add("hidden");

        stage = "b-request";
        inputUser.value = "";

        if (files.length === 2) {
          addBubble("ai", "この2枚でどんなことしたい？🐾\n例：服を入れ替える、人物を合成する");
        } else {
          addBubble("ai", "この画像をどう修正したい？🐾\n例：服を変える、明るくする、雰囲気を変える");
        }
        return;
      }

      if (!text) {
        addBubble("ai", "入力してね🐾");
        return;
      }

      addBubble("user", text);

      if (stage === "b-request") {
        bData.request = text;
        stage = "b-keep";
        inputUser.value = "";
        addBubble("ai", "絶対に変えたくない部分を教えてほしいな🐾\n例：顔・髪・背景など\nなければ「なし」で大丈夫だよ🐾");
        return;
      }

      if (stage === "b-keep") {
        bData.keep = text === "なし" ? "" : text;
        stage = "b-background";
        inputUser.value = "";
        addBubble("ai", "背景も変える？🐾\n例：海、街、ファンタジー、変えない");
        return;
      }

      if (stage === "b-background") {
        bData.target = text;
        stage = "b-mood";
        inputUser.value = "";
        addBubble("ai", "どんな雰囲気にしたい？🐾\n例：ナチュラル、おしゃれ、ポップ");
        return;
      }

      if (stage === "b-mood") {
        bData.finishType = text;
        stage = "b-style";
        inputUser.value = "";
        addBubble("ai", "最後に、仕上がりはどんな感じにする？🐾\n例：カラーで写真風、セピアでイラスト風");
        return;
      }

      if (stage === "b-style") {
        bData.extra = text;
        const ok = await requestSummaryB();
        if (!ok) return;

        stage = "b-confirm";
        inputUser.value = "修正";
        addBubble("ai", "このままでよければ、そのまま送信してね🐾");
        return;
      }

      if (stage === "b-confirm") {
        await generateBImage();
        inputUser.value = "";
      }
    }
  });

  inputUser.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendBtn.click();
    }
  });

  addBubble("ai", "ようこそAIコミュへ🐾");
  addBubble("ai", "コードを入力してOKを押してね🐾");
});