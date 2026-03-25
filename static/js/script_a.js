document.addEventListener("DOMContentLoaded", function () {
  const btnB = document.getElementById("btnNo"); // ←今Bに使ってるやつ
  const cameraArea = document.getElementById("cameraArea");

  const imageInput1 = document.getElementById("imageInput1");
  const imageInput2 = document.getElementById("imageInput2");

  const previewArea = document.getElementById("previewArea");

  let file1 = null;
  let file2 = null;

  // 最初は非表示
  cameraArea.style.display = "none";
  previewArea.style.display = "none";

  // 🔥 プレビュー表示関数（これが核心）
  function updatePreview() {
    previewArea.innerHTML = ""; // 一旦クリア

    if (!file1 && !file2) {
      previewArea.style.display = "none";
      return;
    }

    previewArea.style.display = "block";

    [file1, file2].forEach((file) => {
      if (!file) return;

      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);

      // 小さめ（確認用）
      img.style.width = "90px";
      img.style.height = "90px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      img.style.margin = "4px";

      previewArea.appendChild(img);
    });
  }

  // B押したらカメラ表示
  btnB.onclick = function () {
    cameraArea.style.display = "flex";

    // リセット
    file1 = null;
    file2 = null;
    imageInput1.value = "";
    imageInput2.value = "";
    previewArea.innerHTML = "";
    previewArea.style.display = "none";
  };

  // 画像①
  imageInput1.addEventListener("change", function () {
    file1 = imageInput1.files[0] || null;
    console.log("image1", file1);
    updatePreview();
  });

  // 画像②
  imageInput2.addEventListener("change", function () {
    file2 = imageInput2.files[0] || null;
    console.log("image2", file2);
    updatePreview();
  });
});