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
  const previewImg = document.getElementById("previewImg");
  const inputUser = document.getElementById("inputUser");
  const sendBtn = document.getElementById("sendBtn");

  const CODE_VALUE = "AICOMU2026";

  let currentMode = "";
  let currentActionRow = null;

  let file1 = null;
  let file2 = null;

  // A: 画像生成
  let generateStage = "idle";
  let generateData = {
    purpose: "",
    style: "",
    imageType: "",
    extra: ""
  };

  // B: 画像修正
  let editStage = "idle";
  let editData = {
    imageCountType: "",
    editRequest: "",
    finishType: "",
    keepPart: "",
    extra: ""
  };

  inputBox.style.display = "none";
  choiceRow.style.display = "none";

  // 画像選択済み表示
  const selectedInfo = document.createElement("div");
  selectedInfo.id = "selectedInfo";
  selectedInfo.style.display = "none";
  selectedInfo.style.fontSize = "12px";
  selectedInfo.style.color = "#555";
  selectedInfo.style.marginBottom = "6px";
  selectedInfo.style.padding = "4px 8px";
  selectedInfo.style.background = "rgba(0,0,0,0.05)";
  selectedInfo.style.borderRadius = "6px";

  inputBox.insertBefore(selectedInfo, inputUser);

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

  function addImageBubble(role, files, text = "") {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;

    if (files && files.length) {
      files.forEach((file) => {
        if (!file) return;

        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.display = "block";
        img.style.maxWidth = "180px";
        img.style.maxHeight = "180px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "10px";
        img.style.marginBottom = "6px";
        bubble.appendChild(img);
      });
    }

    if (text) {
      const textDiv = document.createElement("div");
      textDiv.textContent = text;
      bubble.appendChild(textDiv);
    }

    chatArea.appendChild(bubble);
    scrollToBottom();
    return bubble;
  }

  function addGeneratedImageBubble(base64) {
    const bubble = document.createElement("div");
    bubble.className = "bubble ai";

    const img = document.createElement("img");
    img.src = "data:image/png;base64," + base64;
    img.style.display = "block";
    img.style.maxWidth = "260px";
    img.style.maxHeight = "260px";
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

  function clearActionButtons() {
    if (currentActionRow && currentActionRow.parentNode) {
      currentActionRow.parentNode.removeChild(currentActionRow);
    }
    currentActionRow = null;
  }

  function setInputsEnabled(enabled) {
    sendBtn.disabled = !enabled;
    inputUser.disabled = !enabled;
  }

  function resetGenerateFlow() {
    generateStage = "idle";
    generateData.purpose = "";
    generateData.style = "";
    generateData.imageType = "";
    generateData.extra = "";
    clearActionButtons();
  }

  function resetEditFlow() {
    editStage = "idle";
    editData.imageCountType = "";
    editData.editRequest = "";
    editData.finishType = "";
    editData.keepPart = "";
    editData.extra = "";
    clearActionButtons();
  }

  function clearPreview() {
    file1 = null;
    file2 = null;

    imageInput1.value = "";
    imageInput2.value = "";

    if (previewImg) {
      previewImg.src = "";
      previewImg.style.display = "none";
    }

    selectedInfo.style.display = "none";
    selectedInfo.textContent = "";
  }

  function refreshPreview() {
    const messages = [];

    if (file1) {
      messages.push("①枚目 選択済み");
    }

    if (file2) {
      messages.push("②枚目 選択済み");
    }

    if (messages.length === 0) {
      selectedInfo.style.display = "none";
      selectedInfo.textContent = "";
      return;
    }

    selectedInfo.style.display = "block";
    selectedInfo.textContent = "📷 " + messages.join(" / ");
  }

  function addActionButtons(primaryText, onPrimary, onCancel) {
    clearActionButtons();

    const row = document.createElement("div");
    row.className = "bubble ai";
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.alignItems = "center";

    const primaryBtn = document.createElement("button");
    primaryBtn.type = "button";
    primaryBtn.textContent = primaryText;

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "キャンセル";

    primaryBtn.addEventListener("click", async function () {
      primaryBtn.disabled = true;
      cancelBtn.disabled = true;
      await onPrimary();
    });

    cancelBtn.addEventListener("click", function () {
      clearActionButtons();
      if (onCancel) onCancel();
    });

    row.appendChild(primaryBtn);
    row.appendChild(cancelBtn);

    chatArea.appendChild(row);
    currentActionRow = row;
    scrollToBottom();
  }

  function base64ToBlob(base64, mimeType = "image/png") {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    const sliceSize = 1024;

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: mimeType });
  }

  function downloadBase64Image(base64, filename = "aicomu_image.png") {
    try {
      const blob = base64ToBlob(base64, "image/png");
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);

      return true;
    } catch (error) {
      console.error("保存エラー:", error);
      return false;
    }
  }

  function addSaveButtons(base64) {
    clearActionButtons();

    const row = document.createElement("div");
    row.className = "bubble ai";
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.alignItems = "center";

    const yesBtn = document.createElement("button");
    yesBtn.type = "button";
    yesBtn.textContent = "保存する";

    const noBtn = document.createElement("button");
    noBtn.type = "button";
    noBtn.textContent = "保存しない";

    yesBtn.addEventListener("click", function () {
      const ok = downloadBase64Image(base64);
      clearActionButtons();

      if (ok) {
        addBubble("ai", "保存したよ🐾");
      } else {
        addBubble("ai", "保存に失敗したよ🐾");
      }
    });

    noBtn.addEventListener("click", function () {
      clearActionButtons();
      addBubble("ai", "保存はしないでそのままにしておくね🐾");
    });

    row.appendChild(yesBtn);
    row.appendChild(noBtn);

    chatArea.appendChild(row);
    currentActionRow = row;
    scrollToBottom();
  }

  async function handleGenerateFinal() {
    const loading = addFootprintLoadingBubble();

    try {
      const res = await fetch("/api/generate_image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: codeInput.value.trim(),
          purpose: generateData.purpose,
          style: generateData.style,
          image_type: generateData.imageType,
          extra: generateData.extra
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("server error:", text);
        throw new Error("サーバーエラー");
      }

      const data = await res.json();

      if (data.ok) {
        loading.stop(data.message || "お待たせ、画像を生成したよ🐾");

        if (data.image_b64) {
          addGeneratedImageBubble(data.image_b64);
          addSaveButtons(data.image_b64);
        } else {
          addBubble("ai", "画像データが見つからなかったよ🐾");
        }

        resetGenerateFlow();
      } else {
        loading.stop(data.message || "送信に失敗したよ🐾");
      }
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
    }

    inputUser.value = "";
    setInputsEnabled(true);
    inputUser.focus();
  }

  async function handleEditFinal() {
    const loading = addFootprintLoadingBubble();

    try {
      const formData = new FormData();
      formData.append("code", codeInput.value.trim());
      formData.append("image_count_type", editData.imageCountType);
      formData.append("edit_request", editData.editRequest);
      formData.append("finish_type", editData.finishType);
      formData.append("keep_part", editData.keepPart);
      formData.append("extra", editData.extra);

      if (file1) formData.append("image1", file1);
      if (file2) formData.append("image2", file2);

      const res = await fetch("/api/edit_image", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("server error:", text);
        throw new Error("サーバーエラー");
      }

      const data = await res.json();

      if (data.ok) {
        loading.stop(data.message || "お待たせ、画像を修正したよ🐾");

        if (data.image_b64) {
          addGeneratedImageBubble(data.image_b64);
          addSaveButtons(data.image_b64);
        } else {
          addBubble("ai", "画像データが見つからなかったよ🐾");
        }

        clearPreview();
        resetEditFlow();
      } else {
        loading.stop(data.message || "送信に失敗したよ🐾");
      }
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
    }

    inputUser.value = "";
    setInputsEnabled(true);
    inputUser.focus();
  }

  goAicomu.addEventListener("click", function () {
    if (loadingOverlay) loadingOverlay.classList.remove("hidden");

    setTimeout(function () {
      if (loadingOverlay) loadingOverlay.classList.add("hidden");
      pageTop.classList.add("hidden");
      pageAicomu.classList.remove("hidden");
      codeInput.focus();
    }, 700);
  });

  function handleCodeCheck() {
    const code = codeInput.value.trim();
    chatArea.innerHTML = "";
    clearActionButtons();

    if (code !== CODE_VALUE) {
      choiceRow.style.display = "none";
      inputBox.style.display = "none";
      addBubble("ai", "コードが違うよ。もう一度入力してね🐾");
      return;
    }

    btnYes.textContent = "A";
    btnNo.textContent = "B";

    addBubble("ai", "コードを確認したよ🐾");
    addBubble("ai", "A は画像の生成、B は画像の修正だよ！どちらか選んでね🐾🐾");

    choiceRow.style.display = "flex";
    inputBox.style.display = "none";
    inputUser.value = "";
    currentMode = "";
    resetGenerateFlow();
    resetEditFlow();
    clearPreview();
  }

  btnCodeOk.addEventListener("click", handleCodeCheck);

  codeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleCodeCheck();
  });

  // A 開始
  btnYes.addEventListener("click", function () {
    currentMode = "generate";
    resetEditFlow();
    resetGenerateFlow();
    generateStage = "ask-purpose";

    addBubble("user", "A");
    addBubble("ai", "画像生成だね🐾");
    addBubble("ai", "まず、この画像は何に使う予定？\n例：SNS投稿、アイコン、ホームページ背景、鑑賞用など🐾");

    inputBox.style.display = "flex";
    cameraArea.style.display = "none";
    clearPreview();
    inputUser.value = "";
    inputUser.focus();
  });

  // B 開始
  btnNo.addEventListener("click", function () {
    currentMode = "edit";
    resetGenerateFlow();
    resetEditFlow();
    editStage = "wait-images";

    addBubble("user", "B");
    addBubble("ai", "画像修正だね🐾");
    addBubble("ai", "まずは修正したい画像を1枚か2枚選んで、送信ボタンを押してね🐾");

    inputBox.style.display = "flex";
    cameraArea.style.display = "flex";
    clearPreview();
    inputUser.value = "";
    inputUser.focus();
  });

  imageInput1.addEventListener("change", function () {
    file1 = imageInput1.files[0] || null;
    refreshPreview();
  });

  imageInput2.addEventListener("change", function () {
    file2 = imageInput2.files[0] || null;
    refreshPreview();
  });

  sendBtn.addEventListener("click", async function () {
    const text = inputUser.value.trim();

    if (!currentMode) {
      addBubble("ai", "先に A か B を選んでね🐾");
      return;
    }

    clearActionButtons();
    setInputsEnabled(false);

    // A = 画像生成
    if (currentMode === "generate") {
      if (!text) {
        addBubble("ai", "内容を入力してね🐾");
        setInputsEnabled(true);
        return;
      }

      addBubble("user", text);

      if (generateStage === "ask-purpose") {
        generateData.purpose = text;
        generateStage = "ask-style";

        addBubble(
          "ai",
          "次に、どんな系統や雰囲気がいい？\n例：かわいい系、シンプル系、ピンク系、ポップ系など🐾"
        );

        inputUser.value = "";
        setInputsEnabled(true);
        inputUser.focus();
        return;
      }

      if (generateStage === "ask-style") {
        generateData.style = text;
        generateStage = "ask-image-type";

        addBubble(
          "ai",
          "最後に、画像の仕上がりはどんな感じにする？\n例：写真風、イラスト風、漫画風🐾"
        );

        inputUser.value = "";
        setInputsEnabled(true);
        inputUser.focus();
        return;
      }

      if (generateStage === "ask-image-type") {
        generateData.imageType = text;
        generateStage = "ask-extra";

        const loading = addFootprintLoadingBubble();

        try {
          const res = await fetch("/api/generate_summary", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              code: codeInput.value.trim(),
              purpose: generateData.purpose,
              style: generateData.style,
              image_type: generateData.imageType,
              extra: ""
            })
          });

          if (!res.ok) {
            const text = await res.text();
            console.error("server error:", text);
            throw new Error("サーバーエラー");
          }

          const data = await res.json();

          if (data.ok) {
            loading.stop(data.message);
            addBubble("ai", "AIのアドバイスも参考にしながら、もう1つだけ追加したいことがあれば教えてね🐾\nなければ「なし」で大丈夫だよ🐾");
          } else {
            loading.stop(data.message || "送信に失敗したよ🐾");
          }
        } catch (error) {
          console.error(error);
          loading.stop("通信エラーが起きたよ🐾");
        }

        inputUser.value = "";
        setInputsEnabled(true);
        inputUser.focus();
        return;
      }

      if (generateStage === "ask-extra") {
        generateData.extra = text === "なし" ? "" : text;
        generateStage = "confirm";

        addActionButtons(
          "生成する",
          handleGenerateFinal,
          function () {
            addBubble("ai", "キャンセルしたよ🐾 もう一回最初から考えたい時は送ってね🐾");
            resetGenerateFlow();
            generateStage = "ask-purpose";
            addBubble("ai", "まず、この画像は何に使う予定？\n例：SNS投稿、アイコン、ホームページ背景、鑑賞用など🐾");
            setInputsEnabled(true);
            inputUser.focus();
          }
        );

        inputUser.value = "";
        setInputsEnabled(true);
        inputUser.focus();
        return;
      }
    }

    // B = 画像修正
    if (currentMode === "edit") {
      if (editStage === "wait-images") {
        if (!file1 && !file2) {
          addBubble("ai", "画像を1枚か2枚選んでね🐾");
          setInputsEnabled(true);
          return;
        }

        const files = [];
        if (file1) files.push(file1);
        if (file2) files.push(file2);

        addImageBubble("user", files, "");

        editData.imageCountType = file2 ? "2枚" : "1枚";
        editStage = "ask-request";

        addBubble(
          "ai",
          "画像をどのように修正したい？🐾\n1枚の場合：障害物を取り除きたい、カラーにしたい、背景を変えたい、明るさや色味を変えたい など\n2枚の場合：この服をこの人に着せたい、この背景に入れたい、この画像どうしを組み合わせたい など\nざっくりでも大丈夫だよ🐾"
        );

        inputUser.value = "";
        setInputsEnabled(true);
        inputUser.focus();
        return;
      }

      if (editStage === "ask-request") {
        if (!text) {
          addBubble("ai", "どう修正したいか教えてね🐾");
          setInputsEnabled(true);
          return;
        }

        addBubble("user", text);
        editData.editRequest = text;
        editStage = "ask-finish";

        addBubble(
          "ai",
          "仕上がりはどんな感じがいい？🐾\n例：写真風 / イラスト風 / 漫画風 / そのまま自然な感じ"
        );

        inputUser.value = "";
        setInputsEnabled(true);
        inputUser.focus();
        return;
      }

      if (editStage === "ask-finish") {
        if (!text) {
          addBubble("ai", "仕上がりの感じを教えてね🐾");
          setInputsEnabled(true);
          return;
        }

        addBubble("user", text);
        editData.finishType = text;
        editStage = "ask-keep-part";

        addBubble(
          "ai",
          "元の画像で残したい部分はある？🐾\n例：顔はそのまま / 人物はそのまま / ポーズはそのまま / 構図はそのまま / なし"
        );

        inputUser.value = "";
        setInputsEnabled(true);
        inputUser.focus();
        return;
      }

      if (editStage === "ask-keep-part") {
        if (!text) {
          addBubble("ai", "残したい部分がなければ『なし』で大丈夫だよ🐾");
          setInputsEnabled(true);
          return;
        }

        addBubble("user", text);
        editData.keepPart = text === "なし" ? "" : text;
        editStage = "ask-extra";

        const loading = addFootprintLoadingBubble();

        try {
          const formData = new FormData();
          formData.append("code", codeInput.value.trim());
          formData.append("image_count_type", editData.imageCountType);
          formData.append("edit_request", editData.editRequest);
          formData.append("finish_type", editData.finishType);
          formData.append("keep_part", editData.keepPart);
          formData.append("extra", "");

          if (file1) formData.append("image1", file1);
          if (file2) formData.append("image2", file2);

          const res = await fetch("/api/edit_summary", {
            method: "POST",
            body: formData
          });

          if (!res.ok) {
            const text = await res.text();
            console.error("server error:", text);
            throw new Error("サーバーエラー");
          }

          const data = await res.json();

          if (data.ok) {
            loading.stop(data.message);
            addBubble(
              "ai",
              "AIのアドバイスも参考にしながら、もう1つだけ追加したいことがあれば教えてね🐾\nなければ「なし」で大丈夫だよ🐾"
            );
          } else {
            loading.stop(data.message || "送信に失敗したよ🐾");
          }
        } catch (error) {
          console.error(error);
          loading.stop("通信エラーが起きたよ🐾");
        }

        inputUser.value = "";
        setInputsEnabled(true);
        inputUser.focus();
        return;
      }

      if (editStage === "ask-extra") {
        if (!text) {
          addBubble("ai", "追加したいことがなければ『なし』で大丈夫だよ🐾");
          setInputsEnabled(true);
          return;
        }

        addBubble("user", text);
        editData.extra = text === "なし" ? "" : text;
        editStage = "confirm";

        addActionButtons(
          "修正する",
          handleEditFinal,
          function () {
            addBubble("ai", "キャンセルしたよ🐾 もう一回修正内容を変えたい時は送ってね🐾");
            resetEditFlow();
            editStage = "wait-images";
            clearPreview();
            addBubble("ai", "もう一回、画像を1枚か2枚選んで送ってね🐾");
            setInputsEnabled(true);
            inputUser.focus();
          }
        );

        inputUser.value = "";
        setInputsEnabled(true);
        inputUser.focus();
        return;
      }
    }

    setInputsEnabled(true);
  });

  inputUser.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      sendBtn.click();
    }
  });

  addBubble("ai", "ようこそAIコミュへ🐾");
  addBubble("ai", "コードを入力してOKを押してね🐾");
});