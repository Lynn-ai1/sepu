/* Local favorites and WeChat share-card payload for schemaVersion 1.0.
 * Stores the 15 slider integers. Does not touch photos or accounts.
 * Share path is kept within 128 characters, the onShareAppMessage limit.
 */
const adjust = require("./adjust.js");

const SCHEMA_VERSION = "1.0";
const STORAGE_KEY = "sepu.favorites.v1";
const SHARE_PAGE = "/pages/trial/trial";
const MAX_SHARE_PATH = 128;
const MAX_FAVORITES = 30;
const FALLBACK_NAME = "試色配方";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function sanitizeName(name) {
  return String(name || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 24);
}

function normalizeValues(input) {
  if (!input || typeof input !== "object") return null;
  const out = {};
  for (let i = 0; i < adjust.PARAMETER_IDS.length; i += 1) {
    const id = adjust.PARAMETER_IDS[i];
    const raw = input[id];
    if (raw == null || raw === "") {
      out[id] = 0;
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || Math.abs(n - Math.round(n)) > 1e-6) return null;
    const rounded = Math.round(n);
    if (rounded < -100 || rounded > 100) return null;
    out[id] = rounded;
  }
  return out;
}

function bytesToBase64Url(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += ALPHABET[(triple >> 18) & 63];
    out += ALPHABET[(triple >> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHABET[(triple >> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHABET[triple & 63];
  }
  return out;
}

function base64UrlToBytes(text) {
  if (typeof text !== "string" || !text || text.length % 4 === 1) return null;
  const bytes = [];
  for (let i = 0; i < text.length; i += 4) {
    const c0 = ALPHABET.indexOf(text.charAt(i));
    const c1 = ALPHABET.indexOf(text.charAt(i + 1));
    const c2 = i + 2 < text.length ? ALPHABET.indexOf(text.charAt(i + 2)) : -2;
    const c3 = i + 3 < text.length ? ALPHABET.indexOf(text.charAt(i + 3)) : -2;
    if (c0 < 0 || c1 < 0 || c2 === -1 || c3 === -1) return null;
    const n = (c0 << 18) | (c1 << 12) | ((c2 < 0 ? 0 : c2) << 6) | (c3 < 0 ? 0 : c3);
    bytes.push((n >> 16) & 255);
    if (c2 >= 0) bytes.push((n >> 8) & 255);
    if (c3 >= 0) bytes.push(n & 255);
  }
  return new Uint8Array(bytes);
}

function encodeUtf8(text) {
  return new TextEncoder().encode(text);
}

function decodeUtf8(bytes) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.indexOf("\uFFFD") !== -1) return null;
    return text;
  } catch (error) {
    return null;
  }
}

function pack(values, name) {
  const nameBytes = name ? encodeUtf8(name) : new Uint8Array(0);
  const bytes = new Uint8Array(16 + nameBytes.length);
  bytes[0] = 1;
  for (let i = 0; i < adjust.PARAMETER_IDS.length; i += 1) {
    bytes[i + 1] = values[adjust.PARAMETER_IDS[i]] + 100;
  }
  bytes.set(nameBytes, 16);
  return bytes;
}

function encodeShare(recipe) {
  const values = normalizeValues(recipe && recipe.values);
  if (!values) return null;
  let name = sanitizeName(recipe && recipe.name) || FALLBACK_NAME;
  const prefix = SHARE_PAGE + "?d=";
  let token = bytesToBase64Url(pack(values, name));
  while ((prefix + token).length > MAX_SHARE_PATH) {
    const chars = Array.from(name);
    if (!chars.length) return null;
    name = chars.slice(0, -1).join("");
    token = bytesToBase64Url(pack(values, name));
  }
  return {
    token: token,
    path: prefix + token,
    name: name || FALLBACK_NAME,
    values: values,
  };
}

function decodeShareToken(token) {
  if (token == null || token === "") return null;
  const text = String(token);
  const bytes = base64UrlToBytes(text);
  if (!bytes || bytes.length < 16 || bytes[0] !== 1) return null;
  const values = {};
  for (let i = 0; i < adjust.PARAMETER_IDS.length; i += 1) {
    const stored = bytes[i + 1];
    if (stored > 200) return null;
    values[adjust.PARAMETER_IDS[i]] = stored - 100;
  }
  let name = FALLBACK_NAME;
  if (bytes.length > 16) {
    const decoded = decodeUtf8(bytes.subarray(16));
    if (decoded == null) return null;
    name = sanitizeName(decoded) || FALLBACK_NAME;
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    name: name,
    values: values,
  };
}

function buildShareMessage(recipe) {
  const encoded = encodeShare(recipe);
  if (!encoded) {
    return { title: "色譜試色", path: SHARE_PAGE };
  }
  const titleName = encoded.name.slice(0, 12);
  return {
    title: "色譜試色 · " + titleName,
    path: encoded.path,
  };
}

function emptyBook() {
  return { schemaVersion: SCHEMA_VERSION, items: [] };
}

function readBook(storage) {
  let raw;
  try {
    raw = storage.get(STORAGE_KEY);
  } catch (error) {
    return emptyBook();
  }
  if (!raw || raw.schemaVersion !== SCHEMA_VERSION || !Array.isArray(raw.items)) return emptyBook();
  const items = [];
  for (let i = 0; i < raw.items.length && items.length < MAX_FAVORITES; i += 1) {
    const item = raw.items[i];
    const values = normalizeValues(item && item.values);
    const name = sanitizeName(item && item.name);
    if (!item || typeof item.id !== "string" || !item.id || !values || !name) continue;
    items.push({
      id: item.id,
      name: name,
      schemaVersion: SCHEMA_VERSION,
      values: values,
    });
  }
  return { schemaVersion: SCHEMA_VERSION, items: items };
}

function writeBook(storage, items) {
  storage.set(STORAGE_KEY, { schemaVersion: SCHEMA_VERSION, items: items });
}

function listFavorites(storage) {
  return readBook(storage).items.map(function (item) {
    return {
      id: item.id,
      name: item.name,
      schemaVersion: item.schemaVersion,
      values: Object.assign({}, item.values),
    };
  });
}

function addFavorite(storage, input) {
  const values = normalizeValues(input && input.values);
  const name = sanitizeName(input && input.name);
  if (!values) return { ok: false, reason: "invalid" };
  if (!name) return { ok: false, reason: "name" };
  const items = readBook(storage).items;
  const record = {
    id: input.id || ("fav-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36)),
    name: name,
    schemaVersion: SCHEMA_VERSION,
    values: values,
  };
  items.unshift(record);
  writeBook(storage, items.slice(0, MAX_FAVORITES));
  return { ok: true, item: { id: record.id, name: record.name, schemaVersion: record.schemaVersion, values: Object.assign({}, record.values) } };
}

function renameFavorite(storage, id, name) {
  const clean = sanitizeName(name);
  if (!clean) return { ok: false, reason: "name" };
  const items = readBook(storage).items;
  const index = items.findIndex(function (item) { return item.id === id; });
  if (index < 0) return { ok: false, reason: "missing" };
  items[index].name = clean;
  writeBook(storage, items);
  return { ok: true, item: items[index] };
}

function deleteFavorite(storage, id) {
  const items = readBook(storage).items;
  const next = items.filter(function (item) { return item.id !== id; });
  if (next.length === items.length) return { ok: false, reason: "missing" };
  writeBook(storage, next);
  return { ok: true };
}

function memoryStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    get: function (key) { return data[key]; },
    set: function (key, value) { data[key] = value; },
  };
}

module.exports = {
  SCHEMA_VERSION,
  STORAGE_KEY,
  SHARE_PAGE,
  MAX_SHARE_PATH,
  normalizeValues,
  encodeShare,
  decodeShareToken,
  buildShareMessage,
  listFavorites,
  addFavorite,
  renameFavorite,
  deleteFavorite,
  memoryStorage,
};
