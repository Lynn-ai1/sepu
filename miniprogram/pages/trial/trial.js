const adjust = require("../../shared/adjust.js");
const present = require("../../shared/present.js");
const schema = require("../../shared/schema.js");

const MAX_EDGE = 1600;
const STATUS_LABEL = {
  "starter-demo-unverified": "起始示範，尚未在 iPhone 相簿驗證",
};

function callWx(method, options) {
  return new Promise(function (resolve, reject) {
    const payload = Object.assign({}, options, {
      success: resolve,
      fail: reject,
    });
    wx[method](payload);
  });
}

function paintSwatch(ctx) {
  ctx.fillStyle = "#8ec6e6";
  ctx.fillRect(0, 0, 960, 460);
  ctx.fillStyle = "#fff7df";
  ctx.beginPath();
  ctx.arc(760, 150, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(760, 150, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6d9074";
  ctx.fillRect(0, 420, 960, 180);
  ctx.fillStyle = "#e2b394";
  ctx.fillRect(360, 520, 240, 300);
  ctx.fillStyle = "#d7d2ca";
  ctx.fillRect(330, 800, 300, 150);
  ctx.fillStyle = "#2c3134";
  ctx.fillRect(0, 980, 960, 220);
  const chips = ["#c42323", "#2c8a49", "#234eae", "#e2c84a", "#b96b96", "#c8bfb2", "#a9bbb4", "#8d8d8d"];
  chips.forEach(function (color, index) {
    ctx.fillStyle = color;
    ctx.fillRect(36 + index * 114, 1040, 96, 88);
  });
  for (let i = 0; i < 240; i += 1) {
    const v = Math.round((i / 239) * 255);
    ctx.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
    ctx.fillRect(40 + i * 3, 70, 3, 26);
  }
  ctx.fillStyle = "#111111";
  ctx.fillRect(48, 640, 90, 90);
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(138, 640, 70, 90);
}

Page({
  data: {
    pageHeight: 600,
    sheetHeight: 220,
    picHeight: 180,
    stageWidth: 320,
    recipes: [],
    recipeId: "",
    recipeStatus: "",
    recipeDesc: "",
    recipeDisclaimer: "",
    intensity: 100,
    rows: [],
    view: "side",
    split: 50,
    originalSrc: "",
    adjustedSrc: "",
    meta: "",
    status: "從相簿選一張照片，或先用內建色塊。",
  },

  onLoad: function () {
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const recipe = schema.recipes[0];
    this.setData({
      pageHeight: sys.windowHeight,
      sheetHeight: Math.max(168, Math.floor(sys.windowHeight * 0.34)),
      picHeight: Math.max(140, Math.floor(sys.windowHeight * 0.24)),
      stageWidth: Math.max(200, sys.windowWidth - 32),
      recipes: schema.recipes.map(function (item) {
        return { id: item.id, nameZhHant: item.nameZhHant };
      }),
      recipeId: recipe.id,
    });
    this.applyRecipe(recipe, 100);
  },

  onReady: function () {
    const query = wx.createSelectorQuery();
    query.select("#work").fields({ node: true, size: true }).exec((res) => {
      const node = res && res[0] && res[0].node;
      if (!node) {
        this.setData({ status: "這台基礎庫沒有 Canvas 2D，試色預覽開不起來。" });
        return;
      }
      this.canvas = node;
    });
  },

  currentRecipe: function () {
    const id = this.data.recipeId;
    return schema.recipes.find(function (item) {
      return item.id === id;
    }) || schema.recipes[0];
  },

  applyRecipe: function (recipe, intensity) {
    this.setData({
      recipeId: recipe.id,
      recipeStatus: STATUS_LABEL[recipe.status] || recipe.status,
      recipeDesc: recipe.description,
      recipeDisclaimer: recipe.disclaimer,
      intensity: intensity,
      rows: this.makeRows(recipe, intensity),
    });
  },

  makeRows: function (recipe, intensity) {
    return present.buildRows(schema.parameters, recipe.values, intensity).map(function (row) {
      const pct = (row.value + 100) / 2;
      let fillLeft = "50%";
      let fillWidth = "0%";
      if (row.value > 0) fillWidth = (pct - 50) + "%";
      else if (row.value < 0) {
        fillLeft = pct + "%";
        fillWidth = (50 - pct) + "%";
      }
      return Object.assign({}, row, { fillLeft: fillLeft, fillWidth: fillWidth });
    });
  },

  onRecipe: function (event) {
    const id = event.currentTarget.dataset.id;
    const recipe = schema.recipes.find(function (item) {
      return item.id === id;
    });
    if (!recipe) return;
    this.applyRecipe(recipe, this.data.intensity);
    if (this.source) this.scheduleRender();
  },

  onView: function (event) {
    const view = event.currentTarget.dataset.view;
    this.setData({ view: view });
    if (view === "wipe") this.measureWipe();
  },

  onSplit: function (event) {
    this.setData({ split: Number(event.detail.value) });
  },

  onIntensity: function (event) {
    const intensity = Number(event.detail.value);
    const recipe = this.currentRecipe();
    this.setData({
      intensity: intensity,
      rows: this.makeRows(recipe, intensity),
    });
    if (this.source) this.scheduleRender();
  },

  measureWipe: function () {
    wx.createSelectorQuery().in(this).select(".wipe-frame").boundingClientRect((rect) => {
      if (rect && rect.width) this.setData({ stageWidth: rect.width });
    }).exec();
  },

  choosePhoto: function () {
    const run = () => {
      const picker = wx.chooseMedia || null;
      if (!picker) {
        wx.chooseImage({
          count: 1,
          sizeType: ["original", "compressed"],
          sourceType: ["album"],
          success: (res) => this.loadPath(res.tempFilePaths[0], "相簿照片"),
          fail: (err) => this.onPickFail(err),
        });
        return;
      }
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album"],
        sizeType: ["original", "compressed"],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0];
          if (file) this.loadPath(file.tempFilePath, "相簿照片");
        },
        fail: (err) => this.onPickFail(err),
      });
    };
    this.ensurePrivacy().then(run).catch(() => {
      this.setData({ status: "需要同意隱私指引，才能從相簿選照片。" });
    });
  },

  onPickFail: function (err) {
    const msg = (err && err.errMsg) || "";
    if (msg.indexOf("cancel") !== -1) return;
    this.setData({ status: "沒能打開相簿。可以先用內建色塊。" });
  },

  useSwatch: function () {
    if (!this.canvas) {
      this.setData({ status: "畫面還沒準備好，請再按一次內建色塊。" });
      return;
    }
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");
    canvas.width = 960;
    canvas.height = 1200;
    paintSwatch(ctx);
    const image = ctx.getImageData(0, 0, 960, 1200);
    this.setSource(image, "內建色塊，不是照片");
  },

  loadPath: function (path, label) {
    if (!this.canvas) {
      this.setData({ status: "畫面還沒準備好，請再選一次。" });
      return;
    }
    this.setData({ status: "正在讀取照片…" });
    callWx("getImageInfo", { src: path }).then((info) => {
      const long = Math.max(info.width, info.height);
      const scale = Math.min(1, MAX_EDGE / long);
      const w = Math.max(1, Math.round(info.width * scale));
      const h = Math.max(1, Math.round(info.height * scale));
      const canvas = this.canvas;
      const ctx = canvas.getContext("2d");
      const img = canvas.createImage();
      img.onload = () => {
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        const image = ctx.getImageData(0, 0, w, h);
        const note = scale < 1 ? "，已縮到長邊 " + MAX_EDGE + " 像素以內" : "";
        this.setSource(image, label + note);
      };
      img.onerror = () => {
        this.setData({ status: "這張圖沒能讀取。請改存成 JPEG 或 PNG 再選一次。" });
      };
      img.src = path;
    }).catch(() => {
      this.setData({ status: "這張圖沒能讀取。請改存成 JPEG 或 PNG 再選一次。" });
    });
  },

  setSource: function (image, label) {
    this.source = {
      width: image.width,
      height: image.height,
      data: new Uint8ClampedArray(image.data),
    };
    this.setData({
      meta: label + " · 工作圖 " + image.width + "×" + image.height,
    });
    this.renderPair();
  },

  scheduleRender: function () {
    const wait = this.renderTimer;
    if (wait) clearTimeout(wait);
    this.renderTimer = setTimeout(() => {
      this.renderTimer = 0;
      this.renderPair();
    }, 60);
  },

  renderPair: function () {
    if (!this.canvas || !this.source) return;
    const token = (this.renderToken || 0) + 1;
    this.renderToken = token;
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");
    const w = this.source.width;
    const h = this.source.height;
    canvas.width = w;
    canvas.height = h;
    const recipe = this.currentRecipe();
    const values = adjust.scaleValues(recipe.values, this.data.intensity);
    const adjusted = adjust.adjustImage(this.source, values);
    const frame = ctx.getImageData(0, 0, w, h);
    const exportFile = function () {
      return callWx("canvasToTempFilePath", {
        canvas: canvas,
        x: 0,
        y: 0,
        width: w,
        height: h,
        destWidth: w,
        destHeight: h,
        fileType: "png",
      });
    };
    frame.data.set(this.source.data);
    ctx.putImageData(frame, 0, 0);
    exportFile().then((originalFile) => {
      if (token !== this.renderToken) return null;
      frame.data.set(adjusted.data);
      ctx.putImageData(frame, 0, 0);
      return exportFile().then(function (adjustedFile) {
        return { originalFile: originalFile, adjustedFile: adjustedFile };
      });
    }).then((files) => {
      if (!files || token !== this.renderToken) return;
      const intensity = this.data.intensity;
      let status = "已用「" + recipe.nameZhHant + "」更新近似預覽。";
      if (intensity === 0) status = "強度是 0，近似預覽與原圖相同。";
      this.setData({
        originalSrc: files.originalFile.tempFilePath,
        adjustedSrc: files.adjustedFile.tempFilePath,
        status: status,
      });
      if (this.data.view === "wipe") this.measureWipe();
    }).catch(() => {
      if (token !== this.renderToken) return;
      this.setData({ status: "沒能產生預覽圖。" });
    });
  },

  ensurePrivacy: function () {
    return new Promise(function (resolve, reject) {
      if (!wx.getPrivacySetting || !wx.requirePrivacyAuthorize) {
        resolve();
        return;
      }
      wx.getPrivacySetting({
        success: function (res) {
          if (!res.needAuthorization) {
            resolve();
            return;
          }
          wx.requirePrivacyAuthorize({ success: resolve, fail: reject });
        },
        fail: function () { resolve(); },
      });
    });
  },

  saveImage: function () {
    const path = this.data.adjustedSrc;
    if (!path) return;
    this.ensurePrivacy().then(() => this.ensureAlbumWrite()).then(() => {
      return callWx("saveImageToPhotosAlbum", { filePath: path });
    }).then(() => {
      this.setData({ status: "已存到相簿。這張圖是近似預覽。" });
    }).catch((err) => {
      const msg = (err && err.errMsg) || "";
      if (msg.indexOf("cancel") !== -1 || msg.indexOf("auth deny") !== -1) {
        wx.showModal({
          title: "需要相簿權限",
          content: "請允許保存到相簿，才能把近似預覽存回手機。照片不會上傳。",
          confirmText: "前往設定",
          success: function (res) {
            if (res.confirm) wx.openSetting();
          },
        });
        return;
      }
      this.setData({ status: "沒能存進相簿。" });
    });
  },

  ensureAlbumWrite: function () {
    return callWx("getSetting", {}).then((res) => {
      const granted = res.authSetting && res.authSetting["scope.writePhotosAlbum"];
      if (granted) return null;
      return callWx("authorize", { scope: "scope.writePhotosAlbum" });
    });
  },
});
