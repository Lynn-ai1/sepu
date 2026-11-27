const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "schema", "v1-recipe-schema.json"), "utf8"));
const embedded = require("../miniprogram/shared/schema.js");
const present = require("../miniprogram/shared/present.js");
const adjust = require("../miniprogram/shared/adjust.js");

const TAIWAN_NAMES = [
  "曝光",
  "增豔",
  "亮部",
  "陰影",
  "對比",
  "亮度",
  "黑點",
  "飽和度",
  "自然飽和度",
  "色溫",
  "色調",
  "清晰度",
  "畫質",
  "雜點消除",
  "暈邊",
];

test("embedded schema matches the locked json file", () => {
  assert.deepEqual(embedded, source);
});

test("starter demo numbers and names stay locked", () => {
  assert.equal(source.recipes.length, 2);
  assert.equal(source.recipes[0].id, "warm-skin");
  assert.equal(source.recipes[0].nameZhHant, "暖色育膚");
  assert.equal(source.recipes[0].status, "starter-demo-unverified");
  assert.deepEqual(source.recipes[0].values, {
    exposure: 5,
    brilliance: 25,
    highlights: -20,
    shadows: 30,
    contrast: -12,
    brightness: 8,
    blackPoint: 0,
    saturation: -8,
    vibrance: 15,
    warmth: 18,
    tint: 6,
    sharpness: 0,
    definition: 5,
    noiseReduction: 0,
    vignette: 0,
  });

  assert.equal(source.recipes[1].id, "cool-portrait");
  assert.equal(source.recipes[1].nameZhHant, "清冷人像");
  assert.equal(source.recipes[1].status, "starter-demo-unverified");
  assert.deepEqual(source.recipes[1].values, {
    exposure: 0,
    brilliance: 20,
    highlights: -25,
    shadows: 22,
    contrast: -8,
    brightness: 6,
    blackPoint: 5,
    saturation: -12,
    vibrance: -10,
    warmth: -16,
    tint: 8,
    sharpness: 5,
    definition: 8,
    noiseReduction: 0,
    vignette: 10,
  });
});

test("Taiwan display names stay in toolbar order", () => {
  const names = source.parameters
    .slice()
    .sort((a, b) => a.uiOrder - b.uiOrder)
    .map((parameter) => parameter.nameZhHant);
  assert.deepEqual(names, TAIWAN_NAMES);
  assert.equal(source.parameters.find((parameter) => parameter.id === "sharpness").nameEn, "Sharpness");
  assert.equal(source.parameters.find((parameter) => parameter.id === "definition").nameEn, "Definition");
  assert.equal(source.parameters.find((parameter) => parameter.id === "brilliance").nameZhHans, "鲜明度");
  assert.equal(source.parameters.find((parameter) => parameter.id === "shadows").nameZhHans, "阴影");
});

test("row model uses Taiwan names and does not present regional adjustments as applied", () => {
  const rows = present.buildRows(source.parameters, source.recipes[0].values, 100);
  assert.deepEqual(
    rows.map((row) => row.name),
    TAIWAN_NAMES,
  );
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.equal(byId.brilliance.stateLabel, "只顯示");
  assert.equal(byId.brilliance.applied, false);
  assert.equal(byId.brilliance.valueText, "+25");
  assert.match(byId.brilliance.why, /不計算增豔/);
  assert.equal(byId.shadows.applied, false);
  assert.match(byId.shadows.why, /不計算陰影/);
  assert.equal(byId.exposure.stateLabel, "近似");
  assert.equal(byId.exposure.value, 5);
  assert.equal(byId.vibrance.stateLabel, "近似");
  assert.match(byId.vibrance.why, /膚色/);
  assert.equal(byId.sharpness.stateLabel, "未調整");
  assert.equal(byId.sharpness.englishHint, "Sharpness");
  assert.equal(byId.definition.englishHint, "Definition");
  assert.equal(byId.exposure.englishHint, "");
  assert.equal(byId.blackPoint.valueText, "0");

  const half = present.buildRows(source.parameters, source.recipes[0].values, 50);
  const halfExposure = half.find((row) => row.id === "exposure");
  assert.equal(halfExposure.value, 3);
  assert.equal(halfExposure.baseText, "配方 +5");

  const negative = present.buildRows(source.parameters, { sharpness: -20, noiseReduction: -5 }, 100);
  assert.equal(negative.find((row) => row.id === "sharpness").stateLabel, "不計算");
  assert.match(negative.find((row) => row.id === "sharpness").why, /不進畫面/);
});

test("starter recipes change a picture and differ from each other", () => {
  const data = new Uint8ClampedArray(5 * 5 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 190;
    data[i + 1] = 150;
    data[i + 2] = 120;
    data[i + 3] = 255;
  }
  data[0] = 250;
  data[1] = 250;
  data[2] = 245;
  const src = { width: 5, height: 5, data };
  const warm = adjust.adjustImage(src, adjust.scaleValues(source.recipes[0].values, 100));
  const cool = adjust.adjustImage(src, adjust.scaleValues(source.recipes[1].values, 100));
  assert.notDeepEqual(warm.data, src.data);
  assert.notDeepEqual(cool.data, src.data);
  assert.notDeepEqual(warm.data, cool.data);
});
