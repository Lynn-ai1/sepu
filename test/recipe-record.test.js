const test = require("node:test");
const assert = require("node:assert/strict");
const records = require("../miniprogram/shared/recipe-record.js");
const schema = require("../miniprogram/shared/schema.js");

function allZero() {
  const values = {};
  for (const parameter of schema.parameters) values[parameter.id] = 0;
  return values;
}

test("local favorites store the 15 slider values and can be renamed or deleted", () => {
  const storage = records.memoryStorage();
  const starter = schema.recipes[0];
  const before = JSON.parse(JSON.stringify(starter.values));
  const saved = records.addFavorite(storage, {
    name: "  夜拍柔膚  ",
    values: Object.assign(allZero(), starter.values, { warmth: 33, shadows: -40 }),
  });
  assert.equal(saved.ok, true);
  assert.deepEqual(starter.values, before);
  assert.equal(saved.item.schemaVersion, "1.0");
  assert.equal(saved.item.values.warmth, 33);
  assert.equal(saved.item.values.shadows, -40);
  assert.equal(saved.item.values.exposure, starter.values.exposure);
  assert.equal(Object.keys(saved.item.values).length, 15);

  const loaded = records.listFavorites(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, "夜拍柔膚");
  assert.deepEqual(loaded[0].values, saved.item.values);

  const renamed = records.renameFavorite(storage, saved.item.id, "清透");
  assert.equal(renamed.ok, true);
  assert.equal(records.listFavorites(storage)[0].name, "清透");
  assert.deepEqual(records.listFavorites(storage)[0].values, saved.item.values);

  assert.equal(records.deleteFavorite(storage, saved.item.id).ok, true);
  assert.deepEqual(records.listFavorites(storage), []);
  assert.equal(records.addFavorite(storage, { name: "   ", values: allZero() }).ok, false);
});

test("share payload round-trips a non-demo recipe and rejects unreadable cards", () => {
  const values = Object.assign(allZero(), {
    exposure: 5,
    brilliance: 25,
    highlights: -20,
    shadows: 30,
    contrast: -12,
    vibrance: -10,
    warmth: 100,
    tint: -100,
    vignette: 7,
  });
  const encoded = records.encodeShare({ name: "朋友的配方", values: values });
  assert.ok(encoded);
  assert.ok(encoded.path.length <= records.MAX_SHARE_PATH);
  assert.ok(encoded.path.startsWith("/pages/trial/trial?d="));
  const decoded = records.decodeShareToken(encoded.token);
  assert.equal(decoded.schemaVersion, "1.0");
  assert.equal(decoded.name, "朋友的配方");
  assert.deepEqual(decoded.values, values);

  const message = records.buildShareMessage({ name: "朋友的配方", values: values });
  assert.equal(message.path, encoded.path);
  assert.match(message.title, /朋友的配方/);

  assert.equal(records.decodeShareToken(""), null);
  assert.equal(records.decodeShareToken("!!!!"), null);
  assert.equal(records.decodeShareToken(encoded.token.slice(0, 8)), null);
  assert.equal(records.encodeShare({ name: "壞掉", values: { exposure: 1.5 } }), null);

  const longName = "很長的配方名稱".repeat(20);
  const shortened = records.encodeShare({ name: longName, values: values });
  assert.ok(shortened.path.length <= records.MAX_SHARE_PATH);
  const shortenedDecoded = records.decodeShareToken(shortened.token);
  assert.deepEqual(shortenedDecoded.values, values);
  assert.ok(longName.startsWith(shortenedDecoded.name));
  assert.ok(shortenedDecoded.name.length < longName.length);
});

test("a broken favorite book is ignored", () => {
  const storage = records.memoryStorage({
    [records.STORAGE_KEY]: { schemaVersion: "9", items: [{ id: "x", name: "舊", values: allZero() }] },
  });
  assert.deepEqual(records.listFavorites(storage), []);
});
