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