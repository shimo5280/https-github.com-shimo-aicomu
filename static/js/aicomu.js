document.addEventListener("DOMContentLoaded", function () {
  const inputUser = document.getElementById("inputUser");
  const btnSend = document.getElementById("btnSend");
  const previewImg = document.getElementById("previewImg");

  if (!inputUser || !btnSend || !previewImg) {
    console.error("必要な要素が見つかりません");
    return;
  }

  async function generateImage() {
    const prompt = (inputUser.value || "").trim();

    if (!prompt) {
      alert("入力が空です");
      return;
    }

    btnSend.disabled = true;
    btnSend.textContent = "生成中...";

    try {
      const res = await fetch("/api/generate_image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt: prompt })
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "画像生成に失敗しました");
      }

      previewImg.src = data.image_url;
    } catch (err) {
      console.error(err);
      alert(err.message || "通信エラーが発生しました");
    } finally {
      btnSend.disabled = false;
      btnSend.textContent = "生成";
    }
  }

  btnSend.addEventListener("click", generateImage);
});