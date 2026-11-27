(function () {
  const schema = globalThis.SEPU_SCHEMA;
  const adjust = globalThis.SepuAdjust;
  const present = globalThis.SepuPresent;
  const MAX_EDGE = 1600;

  const recipesEl = document.getElementById("recipes");
  const recipeStatus = document.getElementById("recipe-status");
  const recipeDesc = document.getElementById("recipe-desc");
  const recipeDisclaimer = document.getElementById("recipe-disclaimer");
  const fileInput = document.getElementById("file");
  const pickLabel = document.getElementById("pick-label");
  const swatchButton = document.getElementById("swatch");
  const saveButton = document.getElementById("save");
  const photoMeta = document.getElementById("photo-meta");
  const stage = document.getElementById("stage");
  const frame = document.getElementById("frame");
  const originalCanvas = document.getElementById("original");
  const adjustedCanvas = document.getElementById("adjusted");
  const wipeLabels = stage.querySelector(".wipe-labels");
  const handle = document.getElementById("handle");
  const wipeInput = document.getElementById("wipe");
  const statusEl = document.getElementById("status");
  const saveFallback = document.getElementById("save-fallback");
  const intensityInput = document.getElementById("intensity");
  const intensityOut = document.getElementById("intensity-out");
  const paramsEl = document.getElementById("params");

  const STATUS_LABEL = {
    "starter-demo-unverified": "起始示範，尚未在 iPhone 相簿驗證",
  };

  let recipeId = schema.recipes[0].id;
  let intensity = 100;
  let source = null;
  let sourceLabel = "";
  let adjusted = null;
  let scheduled = false;
  let fallbackUrl = "";

  function currentRecipe() {
    return schema.recipes.find(function (recipe) {
      return recipe.id === recipeId;
    });
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function effectiveValues() {
    return adjust.scaleValues(currentRecipe().values, intensity);
  }

  function renderRecipes() {
    recipesEl.replaceChildren();
    schema.recipes.forEach(function (recipe) {
      const label = document.createElement("label");
      label.className = "recipe" + (recipe.id === recipeId ? " is-selected" : "");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "recipe";
      input.value = recipe.id;
      input.className = "visually-hidden";
      input.checked = recipe.id === recipeId;
      const text = document.createElement("span");
      text.textContent = recipe.nameZhHant;
      label.append(input, text);
      input.addEventListener("change", function () {
        if (!input.checked) return;
        recipeId = recipe.id;
        renderRecipes();
        renderRecipeCopy();
        renderRows();
        scheduleRender(true);
      });
      recipesEl.append(label);
    });
  }

  function renderRecipeCopy() {
    const recipe = currentRecipe();
    recipeStatus.textContent = STATUS_LABEL[recipe.status] || recipe.status;
    recipeDesc.textContent = recipe.description;
    recipeDisclaimer.textContent = recipe.disclaimer;
  }

  function renderRows() {
    const rows = present.buildRows(schema.parameters, currentRecipe().values, intensity);
    paramsEl.replaceChildren();
    rows.forEach(function (row) {
      const li = document.createElement("li");
      li.className = "param";
      li.dataset.code = row.code;
      const labelParts = [row.name, row.englishHint, row.valueText, row.stateLabel].filter(Boolean);
      li.setAttribute("aria-label", labelParts.join("，"));

      const top = document.createElement("div");
      top.className = "param-top";

      const name = document.createElement("span");
      name.className = "param-name";
      name.textContent = row.name;
      if (row.englishHint) {
        const en = document.createElement("span");
        en.className = "param-en";
        en.lang = "en";
        en.textContent = row.englishHint;
        name.append(en);
      }

      const value = document.createElement("span");
      value.className = "param-value";
      const effective = document.createElement("span");
      effective.textContent = row.valueText;
      value.append(effective);
      if (row.baseText) {
        const base = document.createElement("span");
        base.className = "param-base";
        base.textContent = row.baseText;
        value.append(base);
      }

      const state = document.createElement("span");
      state.className = "param-state";
      state.textContent = row.stateLabel;

      top.append(name, value, state);

      const meter = document.createElement("div");
      meter.className = "meter";
      meter.setAttribute("aria-hidden", "true");
      const track = document.createElement("span");
      track.className = "meter-track";
      const zero = document.createElement("span");
      zero.className = "meter-zero";
      const fill = document.createElement("span");
      fill.className = "meter-fill";
      const pct = (row.value + 100) / 2;
      if (row.value > 0) {
        fill.style.left = "50%";
        fill.style.width = pct - 50 + "%";
      } else if (row.value < 0) {
        fill.style.left = pct + "%";
        fill.style.width = 50 - pct + "%";
      }
      const thumb = document.createElement("span");
      thumb.className = "meter-thumb";
      thumb.style.left = pct + "%";
      meter.append(track, zero, fill, thumb);

      li.append(top, meter);
      if (row.why) {
        const why = document.createElement("p");
        why.className = "param-why";
        why.textContent = row.why;
        li.append(why);
      }
      paramsEl.append(li);
    });
  }

  function paint(canvas, image) {
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  }

  function updateChrome() {
    const hasImage = Boolean(source);
    stage.classList.toggle("is-empty", !hasImage);
    saveButton.disabled = !hasImage;
    pickLabel.classList.toggle("primary", !hasImage);
    saveButton.classList.toggle("primary", hasImage);
    handle.hidden = !stage.classList.contains("is-wipe") || !hasImage;
    const recipe = currentRecipe();
    adjustedCanvas.setAttribute(
      "aria-label",
      hasImage ? "近似預覽，" + recipe.nameZhHant + "，強度 " + intensity : "近似預覽",
    );
    intensityOut.textContent = String(intensity);
    intensityInput.setAttribute("aria-valuetext", "套用強度 " + intensity);
  }

  function renderImage() {
    updateChrome();
    if (!source) return;
    const values = effectiveValues();
    adjusted = adjust.adjustImage(source, values);
    paint(originalCanvas, source);
    paint(adjustedCanvas, adjusted);
  }

  function scheduleRender(announce) {
    if (scheduled) {
      stage.dataset.announce = announce ? "1" : stage.dataset.announce || "";
      return;
    }
    scheduled = true;
    stage.dataset.announce = announce ? "1" : "";
    requestAnimationFrame(function () {
      scheduled = false;
      const shouldAnnounce = stage.dataset.announce === "1";
      stage.dataset.announce = "";
      renderImage();
      if (shouldAnnounce) announceResult();
    });
  }

  function announceResult() {
    if (!source) {
      setStatus("選擇一張照片，或先用內建色塊。");
      return;
    }
    const name = currentRecipe().nameZhHant;
    if (intensity === 0) {
      setStatus("強度是 0，近似預覽與原圖相同。");
      return;
    }
    setStatus("已用「" + name + "」更新近似預覽。");
  }

  function setSource(image, label) {
    source = {
      width: image.width,
      height: image.height,
      data: new Uint8ClampedArray(image.data),
    };
    sourceLabel = label;
    photoMeta.textContent = label + " · 工作圖 " + image.width + "×" + image.height;
    clearFallback();
    renderRows();
    scheduleRender(true);
  }

  function loadBitmap(bitmap, label) {
    const long = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_EDGE / long);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (bitmap.close) bitmap.close();
    const image = ctx.getImageData(0, 0, w, h);
    const note = scale < 1 ? "，已縮到長邊 " + MAX_EDGE + " 像素以內" : "";
    setSource(image, label + note);
  }

  function loadImageElement(url) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("decode")); };
      img.src = url;
    });
  }

  async function decodeFile(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (error) {
        try {
          return await createImageBitmap(file);
        } catch (inner) {
          /* fall through to Image() */
        }
      }
    }
    const url = URL.createObjectURL(file);
    try {
      return await loadImageElement(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function loadFile(file) {
    if (!file) return;
    const name = (file.name || "").toLowerCase();
    const typedImage = file.type && file.type.indexOf("image/") === 0;
    const namedImage = /\.(jpe?g|png|gif|webp|bmp|avif|heic|heif)$/.test(name);
    if (file.type && !typedImage && !namedImage) {
      setStatus("這個檔案不是圖片。請改選 JPEG 或 PNG。");
      return;
    }
    setStatus("正在讀取照片…");
    try {
      const bitmap = await decodeFile(file);
      loadBitmap(bitmap, file.name || "照片");
    } catch (error) {
      setStatus("這張圖沒能讀取。請改存成 JPEG 或 PNG 再選一次。");
    }
  }

  function makeSwatch() {
    const w = 960;
    const h = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    g.fillStyle = "#8ec6e6";
    g.fillRect(0, 0, w, 460);
    g.fillStyle = "#fff7df";
    g.beginPath();
    g.arc(760, 150, 78, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(760, 150, 28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#6d9074";
    g.fillRect(0, 420, w, 180);
    g.fillStyle = "#e2b394";
    g.fillRect(360, 520, 240, 300);
    g.fillStyle = "#d7d2ca";
    g.fillRect(330, 800, 300, 150);
    g.fillStyle = "#2c3134";
    g.fillRect(0, 980, w, 220);
    const chips = ["#c42323", "#2c8a49", "#234eae", "#e2c84a", "#b96b96", "#c8bfb2", "#a9bbb4", "#8d8d8d"];
    chips.forEach(function (color, index) {
      g.fillStyle = color;
      g.fillRect(36 + index * 114, 1040, 96, 88);
    });
    for (let i = 0; i < 240; i += 1) {
      const v = Math.round((i / 239) * 255);
      g.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
      g.fillRect(40 + i * 3, 70, 3, 26);
    }
    g.fillStyle = "#111111";
    g.fillRect(48, 640, 90, 90);
    g.fillStyle = "#f2f2f2";
    g.fillRect(138, 640, 70, 90);
    return g.getImageData(0, 0, w, h);
  }

  function clearFallback() {
    if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
    fallbackUrl = "";
    saveFallback.replaceChildren();
  }

  function showFallback(url, name) {
    clearFallback();
    fallbackUrl = url;
    const p = document.createElement("p");
    p.textContent = "如果瀏覽器沒有直接存檔，點下面的連結，或長按圖片儲存。";
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.textContent = "儲存「" + name + "」";
    const img = document.createElement("img");
    img.src = url;
    img.alt = "近似預覽，可長按儲存";
    saveFallback.append(p, link, img);
  }

  async function saveImage() {
    if (!adjusted) return;
    const name = "sepu-" + currentRecipe().nameZhHant + "-近似預覽.png";
    const blob = await new Promise(function (resolve) {
      adjustedCanvas.toBlob(resolve, "image/png");
    });
    if (!blob) {
      setStatus("沒有產生圖片。");
      return;
    }
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "色譜近似預覽" });
        setStatus("已交出圖片。請在系統分享單裡選擇儲存。");
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    showFallback(url, name);
    setStatus("已準備「" + name + "」。這張圖是近似預覽。");
  }

  function setView(mode) {
    const wipe = mode === "wipe";
    stage.classList.toggle("is-side", !wipe);
    stage.classList.toggle("is-wipe", wipe);
    wipeLabels.hidden = !wipe;
    handle.hidden = !wipe || !source;
  }

  function setSplit(value) {
    const next = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    stage.style.setProperty("--split", next + "%");
    wipeInput.value = String(next);
    wipeInput.setAttribute("aria-valuetext", "原圖佔 " + next + "%");
  }

  fileInput.addEventListener("change", function () {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    loadFile(file);
  });

  swatchButton.addEventListener("click", function () {
    setSource(makeSwatch(), "內建色塊，不是照片");
  });

  saveButton.addEventListener("click", function () {
    saveImage();
  });

  intensityInput.addEventListener("input", function () {
    intensity = Number(intensityInput.value);
    updateChrome();
    renderRows();
    scheduleRender(false);
  });

  intensityInput.addEventListener("change", function () {
    announceResult();
  });

  document.querySelectorAll('input[name="view"]').forEach(function (input) {
    input.addEventListener("change", function () {
      if (input.checked) setView(input.value);
    });
  });

  wipeInput.addEventListener("input", function () {
    setSplit(wipeInput.value);
  });

  frame.addEventListener("pointerdown", function (event) {
    if (!stage.classList.contains("is-wipe") || !source) return;
    if (event.target.closest && event.target.closest("figcaption")) return;
    const rect = frame.getBoundingClientRect();
    function move(clientX) {
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setSplit(pct);
    }
    move(event.clientX);
    function onMove(ev) { move(ev.clientX); }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  document.addEventListener("dragover", function (event) {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    stage.classList.add("is-dragover");
  });

  document.addEventListener("dragleave", function () {
    stage.classList.remove("is-dragover");
  });

  document.addEventListener("drop", function (event) {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    stage.classList.remove("is-dragover");
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    loadFile(file);
  });

  renderRecipes();
  renderRecipeCopy();
  renderRows();
  updateChrome();
  setView("side");
  setSplit(50);

  const params = new URLSearchParams(window.location.search);
  if (params.get("recipe")) {
    const found = schema.recipes.find(function (recipe) {
      return recipe.id === params.get("recipe");
    });
    if (found) {
      recipeId = found.id;
      renderRecipes();
      renderRecipeCopy();
      renderRows();
    }
  }
  if (params.get("sample") === "1") {
    setSource(makeSwatch(), "內建色塊，不是照片");
  }
})();
