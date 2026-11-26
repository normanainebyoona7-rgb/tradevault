import sharp from "sharp";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const projectRoot = new URL("../../", import.meta.url);
const assetsDir = new URL("../assets/", import.meta.url);
const logoSource = new URL("public/logo.png", projectRoot);

await mkdir(assetsDir, { recursive: true });
await mkdir(new URL("../www/", import.meta.url), { recursive: true });
await copyFile(logoSource, new URL("logo.png", new URL("../www/", import.meta.url)));

const icon = await sharp(await readFile(logoSource))
  .resize(1024, 1024, {
    fit: "contain",
    background: { r: 7, g: 17, b: 31, alpha: 1 },
  })
  .png()
  .toBuffer();

await sharp(icon).toFile(fileURLToPath(new URL("icon.png", assetsDir)));

const logoData = `data:image/png;base64,${icon.toString("base64")}`;
const splash = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
    <defs>
      <radialGradient id="green" cx="18%" cy="8%" r="70%">
        <stop offset="0%" stop-color="#14532d" />
        <stop offset="100%" stop-color="#07111f" />
      </radialGradient>
      <radialGradient id="blue" cx="90%" cy="92%" r="62%">
        <stop offset="0%" stop-color="#172554" />
        <stop offset="100%" stop-color="#07111f" />
      </radialGradient>
    </defs>
    <rect width="2732" height="2732" fill="#07111f" />
    <rect width="2732" height="2732" fill="url(#green)" />
    <rect width="2732" height="2732" fill="url(#blue)" />
    <image href="${logoData}" x="716" y="716" width="1300" height="1300" />
  </svg>
`);

await sharp(splash).png().toFile(fileURLToPath(new URL("splash.png", assetsDir)));

console.log("Prepared TradeVault icon and splash assets.");
