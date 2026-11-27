/* Approximate photo adjustments for the 色譜 preview.
 *
 * This is not iPhone Photos Adjust. Apple has not published slider math.
 * Coefficients below are choices of this preview.
 *
 * Brilliance and Shadows are regional in Photos. This file never changes
 * pixels for those two ids.
 * Vibrance is a separate curve from Saturation: muted colors move more,
 * already-saturated colors move less, and hues near skin orange move less.
 * Negative Sharpness, Definition, and Noise Reduction are not applied:
 * public screenshots have not shown what those negative values look like.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SepuAdjust = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PARAMETER_IDS = [
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
  ];

  const REGIONAL_IDS = ["brilliance", "shadows"];
  const NEGATIVE_UNVERIFIED_IDS = ["sharpness", "definition", "noiseReduction"];

  function clamp01(n) {
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  function clampByte(n) {
    if (n < 0) return 0;
    if (n > 255) return 255;
    return Math.round(n);
  }

  function clampRange(n) {
    if (n < -100) return -100;
    if (n > 100) return 100;
    return n;
  }

  function roundHalfAwayFromZero(n) {
    if (!Number.isFinite(n)) return 0;
    const sign = n < 0 ? -1 : 1;
    return sign * Math.round(Math.abs(n));
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function luma(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const LINEAR = new Float64Array(256);
  for (let i = 0; i < 256; i += 1) {
    const c = i / 255;
    LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }

  function linearToSrgb(c) {
    const x = c <= 0 ? 0 : c;
    const s = x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
    return clamp01(s);
  }

  function applicationStatus(id, value) {
    const v = Number.isFinite(value) ? value : 0;
    if (REGIONAL_IDS.indexOf(id) !== -1) {
      return { applied: false, code: "regional" };
    }
    if (NEGATIVE_UNVERIFIED_IDS.indexOf(id) !== -1 && v < 0) {
      return { applied: false, code: "negative-unverified" };
    }
    if (v === 0) return { applied: false, code: "zero" };
    if (id === "vibrance") return { applied: true, code: "vibrance" };
    return { applied: true, code: "approximate" };
  }

  function scaleValues(recipeValues, intensity) {
    const pct = clampRange(roundHalfAwayFromZero(Number(intensity) || 0));
    const safePct = Math.max(0, Math.min(100, pct));
    const out = {};
    for (let i = 0; i < PARAMETER_IDS.length; i += 1) {
      const id = PARAMETER_IDS[i];
      const raw = recipeValues && Number.isFinite(Number(recipeValues[id])) ? Number(recipeValues[id]) : 0;
      out[id] = clampRange(roundHalfAwayFromZero((raw * safePct) / 100));
    }
    return out;
  }

  function normalizeValues(values) {
    return scaleValues(values || {}, 100);
  }

  function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: (h / 6) * 360, s, l };
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = (((h % 360) + 360) % 360) / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;
    if (hp < 1) {
      r = c;
      g = x;
    } else if (hp < 2) {
      r = x;
      g = c;
    } else if (hp < 3) {
      g = c;
      b = x;
    } else if (hp < 4) {
      g = x;
      b = c;
    } else if (hp < 5) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    const m = l - c / 2;
    return [r + m, g + m, b + m];
  }

  function applySaturation(r, g, b, amount) {
    if (amount === 0) return [r, g, b];
    const hsl = rgbToHsl(r, g, b);
    let s = hsl.s;
    if (amount > 0) s = s + (1 - s) * amount * 0.9;
    else s = s * (1 + amount);
    return hslToRgb(hsl.h, clamp01(s), hsl.l);
  }

  function applyVibrance(r, g, b, amount) {
    if (amount === 0) return [r, g, b];
    const hsl = rgbToHsl(r, g, b);
    if (hsl.s < 0.04) return [r, g, b];
    let skin = 0;
    if (hsl.h >= 8 && hsl.h <= 55) {
      skin = 1 - Math.abs(hsl.h - 28) / 24;
      if (skin < 0) skin = 0;
    }
    const skinMask = skin * smoothstep(0.12, 0.4, hsl.s);
    let s = hsl.s;
    if (amount > 0) {
      const muted = 1 - s;
      const gain = amount * muted * (1 - skinMask);
      s = s + gain * (0.25 + 0.75 * muted);
    } else {
      const drop = -amount * (0.25 + 0.75 * s) * (1 - skinMask * 0.85);
      s = s * (1 - drop);
    }
    return hslToRgb(hsl.h, clamp01(s), hsl.l);
  }

  function restoreLuma(r, g, b, y) {
    const y2 = luma(r, g, b);
    if (y2 <= 1e-6) return [clamp01(r), clamp01(g), clamp01(b)];
    const scale = y / y2;
    return [clamp01(r * scale), clamp01(g * scale), clamp01(b * scale)];
  }

  function adjustPixel(r8, g8, b8, values) {
    const v = values || {};
    let r = LINEAR[r8];
    let g = LINEAR[g8];
    let b = LINEAR[b8];

    const exposure = v.exposure || 0;
    if (exposure !== 0) {
      const gain = 2 ** ((exposure / 100) * 1.6);
      r *= gain;
      g *= gain;
      b *= gain;
    }

    r = linearToSrgb(r);
    g = linearToSrgb(g);
    b = linearToSrgb(b);

    const highlights = v.highlights || 0;
    if (highlights !== 0) {
      const y = luma(r, g, b);
      const weight = smoothstep(0.55, 1, y);
      if (weight > 0) {
        if (highlights < 0) {
          const factor = 1 + (highlights / 100) * 0.75 * weight;
          r *= factor;
          g *= factor;
          b *= factor;
        } else {
          const lift = (highlights / 100) * 0.65 * weight;
          r += (1 - r) * lift;
          g += (1 - g) * lift;
          b += (1 - b) * lift;
        }
      }
    }

    const brightness = v.brightness || 0;
    if (brightness !== 0) {
      const y = luma(r, g, b);
      const bell = 4 * y * (1 - y);
      const delta = (brightness / 100) * 0.4 * bell;
      if (y <= 1e-6) {
        if (brightness > 0) {
          r = delta;
          g = delta;
          b = delta;
        }
      } else {
        const scale = Math.max(0, (y + delta) / y);
        r *= scale;
        g *= scale;
        b *= scale;
      }
    }

    const contrast = v.contrast || 0;
    if (contrast !== 0) {
      const f = 1 + (contrast / 100) * 0.9;
      r = (r - 0.5) * f + 0.5;
      g = (g - 0.5) * f + 0.5;
      b = (b - 0.5) * f + 0.5;
    }

    const blackPoint = v.blackPoint || 0;
    if (blackPoint > 0) {
      const toe = (blackPoint / 100) * 0.35;
      const denom = 1 - toe;
      r = (r - toe) / denom;
      g = (g - toe) / denom;
      b = (b - toe) / denom;
    } else if (blackPoint < 0) {
      const lift = (-blackPoint / 100) * 0.28;
      r = r * (1 - lift) + lift;
      g = g * (1 - lift) + lift;
      b = b * (1 - lift) + lift;
    }

    r = clamp01(r);
    g = clamp01(g);
    b = clamp01(b);

    const warmth = v.warmth || 0;
    const tint = v.tint || 0;
    if (warmth !== 0 || tint !== 0) {
      const y = luma(r, g, b);
      const w = warmth / 100;
      const t = tint / 100;
      r = Math.max(0, r * (1 + 0.45 * w + 0.16 * t));
      g = Math.max(0, g * (1 + 0.08 * w - 0.18 * t));
      b = Math.max(0, b * (1 - 0.45 * w + 0.16 * t));
      const restored = restoreLuma(r, g, b, y);
      r = restored[0];
      g = restored[1];
      b = restored[2];
    }

    const saturation = v.saturation || 0;
    if (saturation !== 0) {
      const next = applySaturation(r, g, b, saturation / 100);
      r = next[0];
      g = next[1];
      b = next[2];
    }

    const vibrance = v.vibrance || 0;
    if (vibrance !== 0 && applicationStatus("vibrance", vibrance).applied) {
      const next = applyVibrance(r, g, b, vibrance / 100);
      r = next[0];
      g = next[1];
      b = next[2];
    }

    return [clampByte(r * 255), clampByte(g * 255), clampByte(b * 255)];
  }

  function boxBlur(src, w, h, radius) {
    const horiz = new Uint8ClampedArray(src.length);
    const out = new Uint8ClampedArray(src.length);
    const div = radius * 2 + 1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const xx = Math.min(w - 1, Math.max(0, x + k));
          const i = (y * w + xx) * 4;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
        }
        const o = (y * w + x) * 4;
        horiz[o] = r / div;
        horiz[o + 1] = g / div;
        horiz[o + 2] = b / div;
        horiz[o + 3] = src[o + 3];
      }
    }
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const yy = Math.min(h - 1, Math.max(0, y + k));
          const i = (yy * w + x) * 4;
          r += horiz[i];
          g += horiz[i + 1];
          b += horiz[i + 2];
        }
        const o = (y * w + x) * 4;
        out[o] = r / div;
        out[o + 1] = g / div;
        out[o + 2] = b / div;
        out[o + 3] = src[o + 3];
      }
    }
    return out;
  }

  function blendBlur(src, w, h, value) {
    const radius = Math.abs(value) >= 50 ? 2 : 1;
    const blurred = boxBlur(src, w, h, radius);
    const t = (Math.abs(value) / 100) * 0.85;
    const out = new Uint8ClampedArray(src.length);
    for (let i = 0; i < src.length; i += 4) {
      out[i] = clampByte(src[i] * (1 - t) + blurred[i] * t);
      out[i + 1] = clampByte(src[i + 1] * (1 - t) + blurred[i + 1] * t);
      out[i + 2] = clampByte(src[i + 2] * (1 - t) + blurred[i + 2] * t);
      out[i + 3] = src[i + 3];
    }
    return out;
  }

  function unsharp(src, w, h, radius, amount) {
    const blurred = boxBlur(src, w, h, radius);
    const out = new Uint8ClampedArray(src.length);
    for (let i = 0; i < src.length; i += 4) {
      for (let c = 0; c < 3; c += 1) {
        out[i + c] = clampByte(src[i + c] + amount * (src[i + c] - blurred[i + c]));
      }
      out[i + 3] = src[i + 3];
    }
    return out;
  }

  function applyVignette(src, w, h, value) {
    const out = new Uint8ClampedArray(src.length);
    const amount = value / 100;
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const scale = Math.sqrt(cx * cx + cy * cy) || 1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const dx = (x - cx) / scale;
        const dy = (y - cy) / scale;
        const falloff = smoothstep(0.4, 1, Math.sqrt(dx * dx + dy * dy));
        const i = (y * w + x) * 4;
        if (amount > 0) {
          const f = 1 - amount * 0.8 * falloff;
          out[i] = clampByte(src[i] * f);
          out[i + 1] = clampByte(src[i + 1] * f);
          out[i + 2] = clampByte(src[i + 2] * f);
        } else {
          const lift = -amount * falloff;
          out[i] = clampByte(src[i] + (255 - src[i]) * lift);
          out[i + 1] = clampByte(src[i + 1] + (255 - src[i + 1]) * lift);
          out[i + 2] = clampByte(src[i + 2] + (255 - src[i + 2]) * lift);
        }
        out[i + 3] = src[i + 3];
      }
    }
    return out;
  }

  function adjustImage(image, values) {
    const w = image.width;
    const h = image.height;
    const src = image.data;
    const v = normalizeValues(values);
    const out = new Uint8ClampedArray(src.length);
    for (let i = 0; i < src.length; i += 4) {
      out[i + 3] = src[i + 3];
      if (src[i + 3] === 0) continue;
      const px = adjustPixel(src[i], src[i + 1], src[i + 2], v);
      out[i] = px[0];
      out[i + 1] = px[1];
      out[i + 2] = px[2];
    }
    let current = out;
    if (applicationStatus("noiseReduction", v.noiseReduction).applied) {
      current = blendBlur(current, w, h, v.noiseReduction);
    }
    if (applicationStatus("sharpness", v.sharpness).applied) {
      current = unsharp(current, w, h, 1, (v.sharpness / 100) * 1.4);
    }
    if (applicationStatus("definition", v.definition).applied) {
      const radius = Math.max(2, Math.min(4, Math.round(Math.min(w, h) / 80)));
      current = unsharp(current, w, h, radius, (v.definition / 100) * 1.1);
    }
    if (applicationStatus("vignette", v.vignette).applied) {
      current = applyVignette(current, w, h, v.vignette);
    }
    return { width: w, height: h, data: current };
  }

  function saturationOf(r8, g8, b8) {
    return rgbToHsl(r8 / 255, g8 / 255, b8 / 255).s;
  }

  return {
    PARAMETER_IDS,
    REGIONAL_IDS,
    NEGATIVE_UNVERIFIED_IDS,
    applicationStatus,
    scaleValues,
    normalizeValues,
    adjustPixel,
    adjustImage,
    hslToRgb,
    rgbToHsl,
    saturationOf,
    roundHalfAwayFromZero,
  };
});
