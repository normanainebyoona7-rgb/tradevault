const path = require("node:path");
const shared = require("../../tailwind.config.js");

module.exports = {
  ...shared,
  content: [
    path.join(__dirname, "src/**/*.{ts,tsx}"),
    path.join(__dirname, "../../src/components/charts/**/*.tsx"),
    path.join(__dirname, "../../src/lib/**/*.ts"),
  ],
};
