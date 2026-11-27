import sharp from "sharp";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const projectRoot = new URL("../../", import.meta.url);
const assetsDir = new URL("../assets/", import.meta.url);
const webDir = new URL("../www/", import.meta.url);
const logoSource = new URL("public/brand-mark.svg", projectRoot);

await mkdir(assetsDir, { recursive: true });
await mkdir(webDir, { recursive: true });
await copyFile(logoSource, new URL("brand-mark.svg", webDir));
await rm(new URL("logo.png", webDir), { force: true });

const logoBuffer = await readFile(logoSource);
const webIconDir = new URL("assets/icons/", webDir);
await mkdir(webIconDir, { recursive: true });
const iconSizes = [48, 72, 96, 128, 192, 256, 512];
await Promise.all(
  iconSizes.map((size) =>
    sharp(logoBuffer, { density: 1152 })
      .resize(size, size, {
        fit: "contain",
        background: { r: 7, g: 17, b: 31, alpha: 1 },
      })
      .webp({ quality: 90 })
      .toFile(fileURLToPath(new URL(`icon-${size}.webp`, webIconDir)))
  )
);
await writeFile(
  fileURLToPath(new URL("manifest.json", webDir)),
  JSON.stringify(
    {
      icons: iconSizes.map((size) => ({
        src: `assets/icons/icon-${size}.webp`,
        type: "image/webp",
        sizes: `${size}x${size}`,
        purpose: "any maskable",
      })),
    },
    null,
    2
  ) + "\n"
);

const icon = await sharp(logoBuffer, { density: 1152 })
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
    </defs>
    <rect width="2732" height="2732" fill="#07111f" />
    <rect width="2732" height="2732" fill="url(#green)" />
    <image href="${logoData}" x="716" y="716" width="1300" height="1300" />
  </svg>
`);

await sharp(splash).png().toFile(fileURLToPath(new URL("splash.png", assetsDir)));

console.log("Prepared TradeVault icon and splash assets.");
