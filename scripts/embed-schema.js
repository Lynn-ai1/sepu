const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "schema", "v1-recipe-schema.json");
const targetPath = path.join(root, "preview", "schema.js");
const data = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const body = JSON.stringify(data, null, 2).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const output = `/* Generated from schema/v1-recipe-schema.json by scripts/embed-schema.js.
 * Do not edit by hand. Recipe numbers and display names stay with that file.
 */
(function (root, factory) {
  const schema = factory();
  if (typeof module === "object" && module.exports) module.exports = schema;
  root.SEPU_SCHEMA = schema;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return ${body};
});
`;
fs.writeFileSync(targetPath, output);
console.log("wrote", targetPath);
