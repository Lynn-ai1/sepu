const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("mini program reuses the shared adjust module and keeps a placeholder appid", () => {
  const config = JSON.parse(read("project.config.json"));
  assert.equal(config.appid, "touristappid");
  assert.equal(config.miniprogramRoot, "miniprogram/");
  assert.equal(config.compileType, "miniprogram");
  const page = read("miniprogram/pages/trial/trial.js");
  assert.match(page, /require\("\.\.\/\.\.\/shared\/adjust\.js"\)/);
  assert.match(page, /require\("\.\.\/\.\.\/shared\/present\.js"\)/);
  assert.match(page, /require\("\.\.\/\.\.\/shared\/schema\.js"\)/);
  assert.equal(page.includes("function applyVibrance"), false);
  const app = JSON.parse(read("miniprogram/app.json"));
  assert.equal(app.pages[0], "pages/trial/trial");
  assert.match(app.permission["scope.writePhotosAlbum"].desc, /相簿/);
});

test("mini program copy keeps the non-parity disclaimer and album boundary", () => {
  const wxml = read("miniprogram/pages/trial/trial.wxml");
  const readme = read("miniprogram/README.md");
  assert.match(wxml, /與 iPhone「照片」的「調整」不同/);
  assert.match(wxml, /增豔和陰影是區域調整/);
  assert.match(wxml, /沒有用飽和度滑桿代替/);
  assert.match(wxml, /從相簿選照片/);
  assert.match(wxml, /存到相簿/);
  assert.match(readme, /touristappid/);
  assert.match(readme, /project\.config\.json/);
  assert.match(readme, /saveImageToPhotosAlbum/);
  assert.match(readme, /chooseMedia/);
  assert.equal(/wx[0-9a-f]{16}/.test(readme), false);
  assert.equal(/wx[0-9a-f]{16}/.test(read("project.config.json")), false);
});
