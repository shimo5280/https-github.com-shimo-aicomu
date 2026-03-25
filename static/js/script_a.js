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

  // B用（存在すれば使う）
  const cameraArea = document.getElementById("cameraArea");
  const imageInput1 = document.getElementById("imageInput1");
  const previewImg = document.getElementById("previewImg");

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
  let bImageBase64 = "";

  const aData = {
    subject: "",
    purpose: "",
    background: "",
    colorTone: "",
    extra: ""
  };

  const bData = {
    goal: "",
    editPoint: "",
    mood: "",
    keep: "",
    strength: ""
  };

  inputBox.style.display = "none";
  choiceRow.style.display = "none";
  if (cameraArea) cameraArea.style.display = "none";

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

  function clearExtraChoiceButtons() {
    const extras = choiceRow.querySelectorAll(".dynamic-choice-btn");
    extras.forEach(btn => btn.remove());
  }

  function showTwoChoiceButtons(leftText, leftHandler, rightText, rightHandler, rightDisabled = false) {
    clearExtraChoiceButtons();
    choiceRow.style.display = "flex";

    btnYes.textContent = leftText;
    btnYes.disabled = false;
    btnYes.style.opacity = "1";
    btnYes.onclick = leftHandler;

    btnNo.textContent = rightText;
    btnNo.disabled = rightDisabled;
    btnNo.style.opacity = rightDisabled ? "0.5" : "1";
    btnNo.onclick = rightDisabled ? null : rightHandler;
  }

  function showThreeChoiceButtons(aText, aHandler, bText, bHandler, cText, cHandler) {
    clearExtraChoiceButtons();
    choiceRow.style.display = "flex";

    btnYes.textContent = aText;
    btnYes.disabled = false;
    btnYes.style.opacity = "1";
    btnYes.onclick = aHandler;

    btnNo.textContent = bText;
    btnNo.disabled = false;
    btnNo.style.opacity = "1";
    btnNo.onclick = bHandler;

    const btnC = document.createElement("button");
    btnC.className = "dynamic-choice-btn";
    btnC.textContent = cText;
    btnC.onclick = cHandler;
    choiceRow.appendChild(btnC);
  }

  function resetAFlow() {
    basePrompt = "";
    aiAdvice = "";
    aData.subject = "";
    aData.purpose = "";
    aData.background = "";
    aData.colorTone = "";
    aData.extra = "";
  }

  function resetBFlow() {
    bData.goal = "";
    bData.editPoint = "";
    bData.mood = "";
    bData.keep = "";
    bData.strength = "";
    bImageBase64 = "";
    if (previewImg) previewImg.src = "";
    if (cameraArea) cameraArea.style.display = "none";
  }

  function resetAllFlow() {
    stage = "idle";
    isGenerating = false;
    basePrompt = "";
    aiAdvice = "";
    lastImageBase64 = "";
    resetAFlow();
    resetBFlow();
  }

  function resetToStart() {
    chatArea.innerHTML = "";
    resetAllFlow();
    inputBox.style.display = "none";
    choiceRow.style.display = "none";
    if (cameraArea) cameraArea.style.display = "none";
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
    showTwoChoiceButtons(
      "保存",
      saveCurrentImage,
      "戻る",
      resetToStart,
      false
    );
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function () {
        const result = reader.result || "";
        const base64 = String(result).split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  if (imageInput1) {
    imageInput1.addEventListener("change", async function (e) {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        bImageBase64 = await fileToBase64(file);
        if (previewImg) {
          previewImg.src = `data:${file.type};base64,${bImageBase64}`;
        }
        addBubble("ai", "画像を受け取ったよ🐾");
      } catch (error) {
        console.error(error);
        addBubble("ai", "画像の読み込みに失敗したよ🐾");
      }
    });
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

    console.log("A finalPrompt =", finalPrompt);

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

  function buildBAdvice() {
    const mood = bData.mood || "";
    const goal = bData.goal || "";

    if (mood.includes("ふんわり") || mood.includes("パステル")) {
      return "やわらかい雰囲気を活かして、自然に整える方向が合いそうだよ🐾";
    }

    if (mood.includes("未来") || mood.includes("ネオン") || goal.includes("大きく変え")) {
      return "世界観をしっかり出した方が雰囲気がまとまりそうだよ🐾";
    }

    return "元の良さを残しつつ、気になるところだけ整えるのが良さそうだよ🐾";
  }

  function showBSummary() {
    aiAdvice = buildBAdvice();

    addBubble(
      "ai",
      "こんな感じかな🐾\n" +
      `・${bData.goal || "自然に整えたい"}\n` +
      `・${bData.editPoint || "気になる部分を修正したい"}\n` +
      `・雰囲気は ${bData.mood || "自然な感じ"}\n` +
      `・ここはそのまま ${bData.keep || "元の良さを残す"}`
    );

    addBubble("ai", "AIアドバイス🐾\n" + aiAdvice);
    addBubble("ai", "3パターン出すね🐾 近いものを選んでね");

    inputBox.style.display = "none";

    showThreeChoiceButtons(
      "A：自然に整える",
      function () {
        selectBStrength("light");
      },
      "B：雰囲気をしっかり変える",
      function () {
        selectBStrength("middle");
      },
      "C：大胆に変える",
      function () {
        selectBStrength("strong");
      }
    );

    stage = "b-select-strength";
  }

  function selectBStrength(strength) {
    bData.strength = strength;

    let strengthLabel = "自然に整える";
    let recommend = "おすすめはAだよ🐾 元の写真の良さを残しやすいよ";

    if (strength === "middle") {
      strengthLabel = "雰囲気をしっかり変える";
      recommend = "おすすめはBだよ🐾 雰囲気を変えつつ自然さも残しやすいよ";
    }

    if (strength === "strong") {
      strengthLabel = "大胆に変える";
      recommend = "おすすめはCだよ🐾 印象を大きく変えたい時に向いてるよ";
    }

    addBubble("user", strengthLabel);
    addBubble("ai", recommend);
    addBubble("ai", "この内容で修正するね🐾");

    generateEditedImage();
  }

  function buildBFinalPrompt() {
    let strengthText = "自然に少しだけ整える";
    if (bData.strength === "middle") strengthText = "雰囲気をしっかり変える";
    if (bData.strength === "strong") strengthText = "大胆に印象を変える";

    return [
      "以下の内容で画像を修正してください。",
      "",
      `【やりたいこと】\n${bData.goal}`,
      "",
      `【修正したいところ】\n${bData.editPoint}`,
      "",
      `【雰囲気・色合い】\n${bData.mood}`,
      "",
      `【残したい部分】\n${bData.keep}`,
      "",
      `【仕上がりの強さ】\n${strengthText}`,
      "",
      aiAdvice,
      "",
      "ロゴなし",
      "文字なし",
      "マークなし"
    ].join("\n");
  }

  async function generateEditedImage() {
    if (isGenerating) return;
    isGenerating = true;

    if (!bImageBase64) {
      addBubble("ai", "先に修正したい画像を選んでね🐾");
      if (cameraArea) cameraArea.style.display = "block";
      inputBox.style.display = "none";
      choiceRow.style.display = "none";
      stage = "b-wait-image";
      isGenerating = false;
      return;
    }

    const finalPrompt = buildBFinalPrompt();
    console.log("B finalPrompt =", finalPrompt);

    const loading = addFootprintLoadingBubble();

    try {
      const res = await fetch("/api/edit_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeInput.value.trim(),
          prompt: finalPrompt,
          image_b64: bImageBase64
        })
      });

      const data = await res.json();

      if (!data.ok) {
        loading.stop(data.message || "画像修正に失敗したよ🐾");
        return;
      }

      loading.stop(data.message || "お待たせ、画像を修正したよ🐾");

      if (data.image_b64) {
        lastImageBase64 = data.image_b64;
        addGeneratedImageBubble(data.image_b64);
        setResultButtons();
      } else {
        addBubble("ai", "画像データが見つからなかったよ🐾");
      }

      inputBox.style.display = "none";
      if (cameraArea) cameraArea.style.display = "none";
    } catch (error) {
      console.error(error);
      loading.stop("通信エラーが起きたよ🐾");
    } finally {
      isGenerating = false;
      inputUser.value = "";
      inputUser.focus();
    }
  }

  function startAFlow() {
    resetAFlow();
    stage = "ask-subject";

    addBubble("user", "A");
    addBubble("ai", "画像生成だね🐾");
    addBubble("ai", "まず、何を主役にしたい？🐾\n例：人物、犬、猫、虹、建物、花 など\nなるべく具体的に教えてね");

    inputBox.style.display = "flex";
    if (cameraArea) cameraArea.style.display = "none";
    inputUser.value = "";
    inputUser.focus();
  }

  function startBFlow() {
    resetBFlow();
    stage = "b-ask-goal";

    addBubble("user", "B");
    addBubble("ai", "画像修正だね🐾");
    addBubble("ai", "いい感じに整えるために、いくつか教えてね🐾");

    if (cameraArea) {
      cameraArea.style.display = "block";
      addBubble("ai", "先に修正したい画像を選んでね🐾");
    } else {
      addBubble("ai", "※画像選択エリアがまだない場合は、あとでHTML側に追加してね🐾");
    }

    addBubble("ai", "どんな仕上がりにしたい？🐾");
    inputBox.style.display = "flex";
    inputUser.value = "";
    inputUser.focus();
  }

  function handleCodeCheck() {
    const code = codeInput.value.trim();
    chatArea.innerHTML = "";

    if (!code) {
      inputBox.style.display = "none";
      choiceRow.style.display = "none";
      if (cameraArea) cameraArea.style.display = "none";
      addBubble("ai", "コードを入力してね🐾");
      return;
    }

    addBubble("ai", "コードを確認したよ🐾");
    addBubble("ai", "A は画像生成、B は画像修正だよ🐾\n選んで始めてね🐾");

    inputBox.style.display = "none";
    if (cameraArea) cameraArea.style.display = "none";

    showTwoChoiceButtons(
      "A",
      startAFlow,
      "B",
      startBFlow,
      false
    );
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
      addBubble("ai", "先に A か B を押して始めてね🐾");
      return;
    }

    if (!text) {
      addBubble("ai", "入力してね🐾");
      return;
    }

    addBubble("user", text);

    // =========================
    // Aフロー
    // =========================
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
      return;
    }

    // =========================
    // Bフロー
    // =========================
    if (stage === "b-ask-goal") {
      bData.goal = text;
      stage = "b-ask-edit";
      inputUser.value = "";
      addBubble("ai", "どこをどう変えたい？🐾");
      inputUser.focus();
      return;
    }

    if (stage === "b-ask-edit") {
      bData.editPoint = text;
      stage = "b-ask-mood";
      inputUser.value = "";
      addBubble("ai", "どんな雰囲気にする？🐾\n例：ふんわり、パステル、夕焼けっぽい、未来感 など");
      inputUser.focus();
      return;
    }

    if (stage === "b-ask-mood") {
      bData.mood = text;
      stage = "b-ask-keep";
      inputUser.value = "";
      addBubble("ai", "ここはそのままにしたい、ってところある？🐾");
      inputUser.focus();
      return;
    }

    if (stage === "b-ask-keep") {
      bData.keep = text;
      inputUser.value = "";
      showBSummary();
      return;
    }

    if (stage === "b-wait-image") {
      inputUser.value = "";
      addBubble("ai", "画像を選んだら、もう一度A・B・Cのどれで修正するか選んでね🐾");
      inputUser.focus();
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