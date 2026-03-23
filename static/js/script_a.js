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

  if (
    !chatArea || !choiceRow || !inputBox || !inputUser ||
    !sendBtn || !codeInput || !btnCodeOk
  ) {
    console.error("必要な要素が見つかりません");
    return;
  }

  let stage = "idle";
  let isGenerating = false;
  let basePrompt = "";
  let aiAdvice = "";
  let lastImageBase64 = "";

  const aData = {
    subject: "",    // 主役
    purpose: "",    // 使用目的
    background: "", // 背景・雰囲気
    colorTone: "",  // 色合い
    extra: ""       // 追加
  };

  inputBox.style.display = "none";
  choiceRow.style.display = "none";

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

  function addGeneratedImageBubble(base64) {
    const bubble = document.createElement("div");
    bubble.className = "bubble ai";

    const img = document.createElement("img");
    img.src = `data:image/png;base64,${base64}`;
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

  function resetAFlow() {
    stage = "idle";
    isGenerating = false;
    basePrompt = "";
    aiAdvice = "";
    aData.subject = "";
    aData.purpose = "";
    aData.background = "";
    aData.colorTone = "";
    aData.extra = "";
  }

  function resetToStart() {
    chatArea.innerHTML = "";
    resetAFlow();
    inputBox.style.display = "none";
    choiceRow.style.display = "none";
    addBubble("ai", "ようこそAIコミュへ🐾");
    addBubble("ai", "コードを入力してOKを押してね🐾");
    codeInput.value = "";
    codeInput.focus();
  }

  function saveCurrentImage() {
    if (!lastImageBase64) {
      addBubble("ai", "保存できる画像がまだないよ🐾");
      return;
    }

    const a = document.createElement("a");
    a.href = `data:image/png;base64,${lastImageBase64}`;
    a.download = "aicomu-image.png";
    a.click();

    addBubble("ai", "保存したよ🐾 今日はここまでだよ。また明日試してみてね🐾");
  }

  function setResultButtons() {
    choiceRow.style.display = "flex";

    btnYes.textContent = "保存";
    btnYes.disabled = false;
    btnYes.style.opacity = "1";
    btnYes.onclick = saveCurrentImage;

    btnNo.textContent = "戻る";
    btnNo.disabled = false;
    btnNo.style.opacity = "1";
    btnNo.onclick = resetToStart;
  }

  async function requestSummary() {
    const loading = addFootprintLoadingBubble();

    try {
      const res = await fetch("/api/generate_summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeInput.value.trim(),
          purpose: aData.purpose,
          style: aData.subject,
          image_type: `${aData.background} / ${aData.colorTone}`
        })
      });

      const data = await res.json();

      if (!data.ok) {
        loading.stop(data.message || "まとめに失敗したよ🐾");
        stage = "ask-subject";
        return;
      }

      basePrompt = [
        aData.subject,
        aData.purpose,
        aData.background,
        aData.colorTone
      ].filter(Boolean).join("\n");

      aiAdvice = data.advice || "";

      loading.stop("こんな感じでまとめたよ🐾");
      addBubble("ai", data.summary || "まとめを作ったよ🐾");
      addBubble("ai", "AIアドバイス🐾\n" + (aiAdvice || "少し具体的にすると良さそうだよ🐾"));
      addBubble("ai", "最後に追加したいことがあれば教えてね🐾\nなければ「なし」で大丈夫だよ🐾");

      stage = "ask-extra";
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
      stage = "ask-subject";
    } finally {
      inputUser.value = "";
      inputUser.focus();
    }
  }

  async function generateImage() {
    if (isGenerating) return;
    isGenerating = true;

    const finalPrompt = [
      basePrompt,
      aiAdvice,
      aData.extra,
      "ロゴなし",
      "文字なし",
      "マークなし"
    ].filter(Boolean).join("\n");

    console.log("finalPrompt =", finalPrompt);

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
        lastImageBase64 = data.image_b64;
        addGeneratedImageBubble(data.image_b64);
        setResultButtons();
      } else {
        addBubble("ai", "画像データが見つからなかったよ🐾");
      }

      inputBox.style.display = "none";
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
    } finally {
      isGenerating = false;
      inputUser.value = "";
      inputUser.focus();
    }
  }

  function handleCodeCheck() {
    const code = codeInput.value.trim();
    chatArea.innerHTML = "";

    if (!code) {
      inputBox.style.display = "none";
      choiceRow.style.display = "none";
      addBubble("ai", "コードを入力してね🐾");
      return;
    }

    addBubble("ai", "コードを確認したよ🐾");
    addBubble("ai", "A は画像の生成だよ🐾 A を押して始めてね🐾");

    choiceRow.style.display = "flex";
    inputBox.style.display = "none";

    btnYes.textContent = "A";
    btnYes.disabled = false;
    btnYes.style.opacity = "1";
    btnYes.onclick = function () {
      resetAFlow();
      stage = "ask-subject";

      addBubble("user", "A");
      addBubble("ai", "画像生成だね🐾");
      addBubble("ai", "まず、何を主役にしたい？🐾\n例：人物、犬、猫、虹、建物、花 など\nなるべく具体的に教えてね");
      inputBox.style.display = "flex";
      inputUser.value = "";
      inputUser.focus();
    };

    btnNo.textContent = "B";
    btnNo.disabled = true;
    btnNo.style.opacity = "0.5";
    btnNo.onclick = null;
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

  sendBtn.addEventListener("click", async function () {
    const text = inputUser.value.trim();

    if (!stage || stage === "idle") {
      addBubble("ai", "先に A を押して始めてね🐾");
      return;
    }

    if (!text) {
      addBubble("ai", "入力してね🐾");
      return;
    }

    addBubble("user", text);

    if (stage === "ask-subject") {
      aData.subject = text;
      stage = "ask-purpose";
      inputUser.value = "";
      addBubble("ai", "次に、どこで使う画像にしたい？🐾\n例：SNS、アイコン、ホームページ背景、鑑賞用 など");
      inputUser.focus();
      return;
    }

    if (stage === "ask-purpose") {
      aData.purpose = text;
      stage = "ask-background";
      inputUser.value = "";
      addBubble("ai", "次に、どんな背景や場所のイメージにしたい？🐾\n例：青空広がる草原、月明かりが見える海、花畑が広がる丘 など");
      inputUser.focus();
      return;
    }

    if (stage === "ask-background") {
      aData.background = text;
      stage = "ask-color";
      inputUser.value = "";
      addBubble("ai", "最後に、色合いはどんな感じがいい？🐾\n例：カラー、パステル、セピア、モノクロ など");

      inputUser.focus();
      return;
    }

    if (stage === "ask-color") {
      aData.colorTone = text;
      await requestSummary();
      return;
    }

    if (stage === "ask-extra") {
      aData.extra = text === "なし" ? "" : text;
      stage = "confirm";
      inputUser.value = "";
      addBubble("ai", "こんな感じでまとめたよ🐾\n追加したいことがあれば教えてね。\nなければ『なし』で大丈夫だよ🐾");
      addBubble("ai", "生成する準備ができたよ🐾\nこのままでよければ、もう一度送信してね🐾"); 
      inputUser.value = "生成";
      inputUser.focus();
      return;
    }

    if (stage === "confirm") {
      await generateImage();
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