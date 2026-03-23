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

  if (!chatArea || !choiceRow || !inputBox || !inputUser || !sendBtn || !codeInput || !btnCodeOk) {
    console.error("必要な要素が見つかりません");
    return;
  }

  let stage = "idle";
  let isGenerating = false;
  let basePrompt = "";
  let aiAdvice = "";

  const aData = {
    purpose: "",
    style: "",
    imageType: "",
    extra: ""
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
    aData.purpose = "";
    aData.style = "";
    aData.imageType = "";
    aData.extra = "";
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
          style: aData.style,
          image_type: aData.imageType
        })
      });

      const data = await res.json();

      if (!data.ok) {
        loading.stop(data.message || "まとめに失敗したよ🐾");
        stage = "ask-purpose";
        return;
      }

      basePrompt = [
        aData.purpose,
        aData.style,
        aData.imageType
      ].filter(Boolean).join("\n");

      aiAdvice = data.advice || "";

      loading.stop("こんな感じでまとめたよ🐾");
      addBubble("ai", data.summary || "まとめを作ったよ🐾");
      addBubble("ai", "AIアドバイス🐾\n" + (aiAdvice || "雰囲気を少し具体的にすると良いよ🐾"));
      addBubble("ai", "もう1つだけ追加したいことがあれば教えてね🐾\nなければ「なし」で大丈夫だよ🐾");

      stage = "ask-extra";
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
      stage = "ask-purpose";
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
        addGeneratedImageBubble(data.image_b64);
      } else {
        addBubble("ai", "画像データが見つからなかったよ🐾");
      }

      resetAFlow();
      stage = "ask-purpose";
      addBubble("ai", "もう一回やるなら、まずこの画像は何に使う予定？🐾");
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

    if (btnYes) btnYes.textContent = "A";
    if (btnNo) {
      btnNo.textContent = "B";
      btnNo.disabled = true;
      btnNo.style.opacity = "0.5";
    }

    resetAFlow();
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

  if (btnYes) {
    btnYes.addEventListener("click", function () {
      resetAFlow();
      stage = "ask-purpose";

      addBubble("user", "A");
      addBubble("ai", "画像生成だね🐾");
      addBubble("ai", "まず、この画像は何に使う予定？🐾\n例：SNS投稿、アイコン、ホームページ背景、鑑賞用など");

      inputBox.style.display = "flex";
      inputUser.value = "";
      inputUser.focus();
    });
  }

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

    if (stage === "ask-purpose") {
      aData.purpose = text;
      stage = "ask-style";
      inputUser.value = "";
      addBubble("ai", "次に何を主役にしたい？🐾\n（形容詞）＋（主役）で入れてね\n例：かわいい猫、キレイな景色、ポップなロゴ");
      inputUser.focus();
      return;
    }

    if (stage === "ask-style") {
      aData.style = text;
      stage = "ask-image-type";
      inputUser.value = "";
      addBubble("ai", "最後に、画像の仕上がりはどんな感じにする？🐾\n例：写真風、イラスト風、漫画風");
      inputUser.focus();
      return;
    }

    if (stage === "ask-image-type") {
      aData.imageType = text;
      await requestSummary();
      return;
    }

    if (stage === "ask-extra") {
      aData.extra = text === "なし" ? "" : text;
      stage = "confirm";
      inputUser.value = "";
      addBubble("ai", "生成する準備ができたよ🐾");
      addBubble("ai", "生成する時は、もう一度送信ボタンを押してね🐾");
      inputUser.value = "生成";
      inputUser.focus();
      return;
    }

    if (stage === "confirm") {
      await generateImage();
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