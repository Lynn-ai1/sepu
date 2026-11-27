const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const ui = [read("preview/index.html"), read("preview/app.js"), read("preview/present.js"), read("README.md")].join("\n");

test("the page and readme keep the non-parity disclaimer", () => {
  const html = read("preview/index.html");
  const readme = read("README.md");
  assert.match(html, /近似算法/);
  assert.match(html, /與 iPhone「照片」的「調整」不同/);
  assert.match(html, /增豔和陰影是區域調整/);
  assert.match(html, /沒有用飽和度滑桿代替/);
  assert.match(html, /preview\/index\.html|選擇照片/);
  assert.match(readme, /preview\/index\.html/);
  assert.match(readme, /近似/);
  assert.match(readme, /不是 iPhone/);
  assert.match(readme, /增豔/);
  assert.match(readme, /陰影/);
  assert.match(readme, /自然飽和度/);
  assert.match(readme, /不會上傳/);
});

test("visible UI copy does not claim Photos parity", () => {
  const banned = ["與相簿一致", "等同 iPhone", "和相簿一樣", "效果相同", "完全還原", "官方算法", "已等同"];
  for (const phrase of banned) {
    assert.equal(ui.includes(phrase), false, phrase);
  }
});

test("the page shell uses Taiwan names rather than simplified button labels", () => {
  const html = read("preview/index.html");
  const app = read("preview/app.js");
  const surface = html + "\n" + app;
  const simplified = ["鲜明度", "高光", "阴影", "饱和度", "色温", "色调", "锐度", "噪点消除", "晕影", "暖色育肤"];
  for (const word of simplified) {
    assert.equal(surface.includes(word), false, word);
  }
  assert.match(html, /lang="zh-Hant"/);
});
