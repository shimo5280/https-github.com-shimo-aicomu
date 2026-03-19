document.addEventListener("DOMContentLoaded", () => {
  const pageTop    = document.getElementById("pageTop");
  const pageAicomu = document.getElementById("pageAicomu");

  const goAicomu = document.getElementById("goAicomu"); // トップの「体験へ」
  const btnGo    = document.getElementById("btnGo");    // 体験画面のGO

  function showPage(page) {
    pageTop?.classList.add("hidden");
    pageAicomu?.classList.add("hidden");
    page?.classList.remove("hidden");
  }

  // トップ → 体験へ
  goAicomu?.addEventListener("click", () => showPage(pageAicomu));

  // 体験画面のGO（次の処理へ繋げる）
  btnGo?.addEventListener("click", () => {
    // ここに「チャット開始」「次ステージ」などを置く
    console.log("GO pressed");
  });
});