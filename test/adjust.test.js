const test = require("node:test");
const assert = require("node:assert/strict");
const adjust = require("../miniprogram/shared/adjust.js");

function pixel(r, g, b) {
  return { width: 1, height: 1, data: new Uint8ClampedArray([r, g, b, 255]) };
}

function read(image, x, y) {
  const i = (y * image.width + x) * 4;
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
}

function zeros() {
  const out = {};
  for (const id of adjust.PARAMETER_IDS) out[id] = 0;
  return out;
}

function withValues(partial) {
  return Object.assign(zeros(), partial);
}

function flat(w, h, r, g, b) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

function byteFromHsl(h, s, l) {
  const rgb = adjust.hslToRgb(h, s, l);
  return rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255));
}

test("parameter ids stay in toolbar order", () => {
  assert.deepEqual(adjust.PARAMETER_IDS, [
    "exposure",
    "brilliance",
    "highlights",
    "shadows",
    "contrast",
    "brightness",
    "blackPoint",
    "saturation",
    "vibrance",
    "warmth",
    "tint",
    "sharpness",
    "definition",
    "noiseReduction",
    "vignette",
  ]);
});

test("brilliance and shadows never change pixels", () => {
  const src = flat(3, 3, 40, 90, 160);
  src.data[0] = 250;
  src.data[1] = 240;
  src.data[2] = 230;
  const out = adjust.adjustImage(src, withValues({ brilliance: 100, shadows: -100 }));
  assert.deepEqual(out.data, src.data);
  assert.equal(adjust.applicationStatus("brilliance", 25).code, "regional");
  assert.equal(adjust.applicationStatus("shadows", 0).applied, false);
});

test("intensity 0 leaves the image unchanged", () => {
  const src = flat(2, 2, 120, 80, 60);
  const scaled = adjust.scaleValues(
    {
      exposure: 5,
      brilliance: 25,
      highlights: -20,
      shadows: 30,
      contrast: -12,
      warmth: 18,
      vibrance: 15,
      saturation: -8,
    },
    0,
  );
  const out = adjust.adjustImage(src, scaled);
  assert.deepEqual(out.data, src.data);
});

test("scaleValues rounds half away from zero and does not mutate the recipe", () => {
  const recipe = { exposure: 5, highlights: -25, warmth: -16, vibrance: 15 };
  const copy = Object.assign({}, recipe);
  const scaled = adjust.scaleValues(recipe, 50);
  assert.equal(scaled.exposure, 3);
  assert.equal(scaled.highlights, -13);
  assert.equal(scaled.warmth, -8);
  assert.equal(scaled.vibrance, 8);
  assert.deepEqual(recipe, copy);
  assert.equal(adjust.scaleValues({ exposure: 150 }, 100).exposure, 100);
  assert.equal(adjust.scaleValues({}, 100).blackPoint, 0);
});

test("exposure, brightness, contrast, black point, and highlights move the expected tones", () => {
  const mid = adjust.adjustPixel(128, 128, 128, withValues({ exposure: 100 }));
  assert.ok(mid[0] > 128);

  const darkExp = adjust.adjustPixel(128, 128, 128, withValues({ exposure: -100 }));
  assert.ok(darkExp[0] < 128);

  const brightMid = adjust.adjustPixel(128, 128, 128, withValues({ brightness: 100 }));
  const brightEnd = adjust.adjustPixel(8, 8, 8, withValues({ brightness: 100 }));
  assert.ok(brightMid[0] - 128 > brightEnd[0] - 8);

  const dark = adjust.adjustPixel(40, 40, 40, withValues({ contrast: 100 }));
  const light = adjust.adjustPixel(200, 200, 200, withValues({ contrast: 100 }));
  assert.ok(dark[0] < 40);
  assert.ok(light[0] > 200);

  const crushed = adjust.adjustPixel(30, 30, 30, withValues({ blackPoint: 100 }));
  assert.equal(crushed[0], 0);
  const lifted = adjust.adjustPixel(10, 10, 10, withValues({ blackPoint: -100 }));
  assert.ok(lifted[0] > 10);

  const hi = adjust.adjustPixel(240, 240, 240, withValues({ highlights: -100 }));
  const lo = adjust.adjustPixel(40, 40, 40, withValues({ highlights: -100 }));
  assert.ok(240 - hi[0] > 40 - lo[0]);
});

test("warmth and tint shift color and keep a gray pixel's channels ordered", () => {
  const warm = adjust.adjustPixel(128, 128, 128, withValues({ warmth: 100 }));
  const cool = adjust.adjustPixel(128, 128, 128, withValues({ warmth: -100 }));
  assert.ok(warm[0] > warm[2]);
  assert.ok(cool[2] > cool[0]);

  const magenta = adjust.adjustPixel(128, 128, 128, withValues({ tint: 100 }));
  const green = adjust.adjustPixel(128, 128, 128, withValues({ tint: -100 }));
  assert.ok(magenta[0] > magenta[1]);
  assert.ok(magenta[2] > magenta[1]);
  assert.ok(green[1] > green[0]);
  assert.ok(green[1] > green[2]);
});

test("saturation -100 approaches gray and vibrance is not the same curve", () => {
  const color = byteFromHsl(150, 0.55, 0.45);
  const grayish = adjust.adjustPixel(color[0], color[1], color[2], withValues({ saturation: -100 }));
  assert.ok(Math.abs(grayish[0] - grayish[1]) <= 1);
  assert.ok(Math.abs(grayish[1] - grayish[2]) <= 1);

  const skin = byteFromHsl(28, 0.45, 0.7);
  const muted = byteFromHsl(150, 0.22, 0.55);
  const hot = byteFromHsl(0, 0.92, 0.45);
  const mutedRed = byteFromHsl(0, 0.2, 0.5);

  function delta(rgb, values) {
    const out = adjust.adjustPixel(rgb[0], rgb[1], rgb[2], values);
    return adjust.saturationOf(out[0], out[1], out[2]) - adjust.saturationOf(rgb[0], rgb[1], rgb[2]);
  }

  const vibSkin = delta(skin, withValues({ vibrance: 100 }));
  const vibMuted = delta(muted, withValues({ vibrance: 100 }));
  const satSkin = delta(skin, withValues({ saturation: 100 }));
  const satMuted = delta(muted, withValues({ saturation: 100 }));
  const vibHot = delta(hot, withValues({ vibrance: 100 }));
  const vibMutedRed = delta(mutedRed, withValues({ vibrance: 100 }));

  assert.ok(vibMuted > vibSkin);
  assert.ok(satSkin > 0.05);
  assert.ok(satMuted > 0.05);
  assert.ok(vibMuted / Math.max(vibSkin, 0.001) > satMuted / satSkin);
  assert.ok(vibMutedRed > vibHot);

  const vibOut = adjust.adjustPixel(muted[0], muted[1], muted[2], withValues({ vibrance: 80 }));
  const satOut = adjust.adjustPixel(muted[0], muted[1], muted[2], withValues({ saturation: 80 }));
  assert.notDeepEqual(vibOut, satOut);
});

test("the two starter warmth directions move a skin pixel opposite ways", () => {
  const skin = byteFromHsl(28, 0.4, 0.72);
  const warm = adjust.adjustPixel(skin[0], skin[1], skin[2], withValues({ warmth: 18, tint: 6 }));
  const cool = adjust.adjustPixel(skin[0], skin[1], skin[2], withValues({ warmth: -16, tint: 8 }));
  const baseRatio = skin[0] / skin[2];
  assert.ok(warm[0] / warm[2] > baseRatio);
  assert.ok(cool[0] / cool[2] < baseRatio);
});

test("negative sharpness, definition, and noise reduction are not applied", () => {
  const src = flat(6, 6, 80, 90, 100);
  for (let x = 0; x < 6; x += 1) {
    src.data[(2 * 6 + x) * 4] = 200;
    src.data[(2 * 6 + x) * 4 + 1] = 200;
    src.data[(2 * 6 + x) * 4 + 2] = 200;
  }
  for (const id of ["sharpness", "definition", "noiseReduction"]) {
    const out = adjust.adjustImage(src, withValues({ [id]: -40 }));
    assert.equal(adjust.applicationStatus(id, -40).code, "negative-unverified");
    assert.deepEqual(out.data, src.data);
  }
});

test("positive sharpness increases an edge and noise reduction lowers variance", () => {
  const src = flat(8, 8, 30, 30, 30);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 4; x < 8; x += 1) {
      const i = (y * 8 + x) * 4;
      src.data[i] = 210;
      src.data[i + 1] = 210;
      src.data[i + 2] = 210;
    }
  }
  const sharp = adjust.adjustImage(src, withValues({ sharpness: 100 }));
  const before = src.data[(0 * 8 + 4) * 4] - src.data[(0 * 8 + 3) * 4];
  const after = sharp.data[(0 * 8 + 4) * 4] - sharp.data[(0 * 8 + 3) * 4];
  assert.ok(after > before);

  let seed = 42;
  const noisy = flat(12, 12, 0, 0, 0);
  for (let i = 0; i < noisy.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = 70 + (seed % 120);
    noisy.data[i] = n;
    noisy.data[i + 1] = n;
    noisy.data[i + 2] = n;
  }
  function variance(image) {
    let sum = 0;
    let sum2 = 0;
    const count = image.width * image.height;
    for (let i = 0; i < image.data.length; i += 4) {
      sum += image.data[i];
      sum2 += image.data[i] * image.data[i];
    }
    const mean = sum / count;
    return sum2 / count - mean * mean;
  }
  const denoised = adjust.adjustImage(noisy, withValues({ noiseReduction: 100 }));
  assert.ok(variance(denoised) < variance(noisy));
});

test("vignette darkens corners when positive and lightens them when negative", () => {
  const src = flat(21, 21, 140, 140, 140);
  const dark = adjust.adjustImage(src, withValues({ vignette: 100 }));
  const light = adjust.adjustImage(src, withValues({ vignette: -100 }));
  const center = read(dark, 10, 10)[0];
  const corner = read(dark, 0, 0)[0];
  assert.ok(center > corner);
  assert.ok(read(light, 0, 0)[0] > read(light, 10, 10)[0]);
  assert.equal(center, 140);
});
