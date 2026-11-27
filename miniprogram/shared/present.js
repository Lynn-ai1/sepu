/* Taiwan Traditional Chinese labels for the preview rows.
 * Display names come from the locked schema. This file only adds
 * preview-status words, which are not Photos control names.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SepuPresent = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function adjustApi() {
    if (typeof globalThis !== "undefined" && globalThis.SepuAdjust) return globalThis.SepuAdjust;
    return require("./adjust.js");
  }

  const WHY = {
    brilliance: "區域調整。數字留在配方裡，畫面不計算增豔。",
    shadows: "區域調整。數字留在配方裡，畫面不計算陰影。",
    vibrance: "少動已經很濃的顏色，也少動接近膚色的顏色。",
    sharpness: "沿邊緣做粗略的清晰處理。",
    definition: "用較大範圍的局部對比做粗略處理。",
    noiseReduction: "正值以輕微模糊減少顆粒。",
    vignette: "以圓形遮罩加重或減淡四角。",
  };

  const ENGLISH_HINT_IDS = {
    sharpness: true,
    definition: true,
  };

  function stateLabel(code) {
    if (code === "regional") return "只顯示";
    if (code === "negative-unverified") return "不計算";
    if (code === "zero") return "未調整";
    return "近似";
  }

  function formatSigned(n) {
    if (n > 0) return "+" + n;
    return String(n);
  }

  function buildRows(parameters, baseValues, intensity) {
    const adjust = adjustApi();
    const effective = adjust.scaleValues(baseValues || {}, intensity);
    const rows = parameters.slice().sort(function (a, b) {
      return a.uiOrder - b.uiOrder;
    });
    return rows.map(function (parameter) {
      const value = effective[parameter.id];
      const base = Number(baseValues && baseValues[parameter.id]) || 0;
      const status = adjust.applicationStatus(parameter.id, value);
      let why = WHY[parameter.id] || "";
      if (status.code === "negative-unverified") {
        why = (why ? why + "" : "") + "這個負值不進畫面。";
      }
      const showBase = Math.round(Number(intensity) || 0) !== 100;
      return {
        id: parameter.id,
        name: parameter.nameZhHant,
        englishHint: ENGLISH_HINT_IDS[parameter.id] ? parameter.nameEn : "",
        value: value,
        valueText: formatSigned(value),
        baseText: showBase ? "配方 " + formatSigned(base) : "",
        code: status.code,
        applied: status.applied,
        stateLabel: stateLabel(status.code),
        why: why,
      };
    });
  }

  return {
    WHY,
    stateLabel,
    formatSigned,
    buildRows,
  };
});
