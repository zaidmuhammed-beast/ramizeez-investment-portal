// Renders the installable-app icons (PNG) from src/app/icon.svg. Run: npm run gen:icons
import { readFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("src/app/icon.svg");
const render = (size: number) => sharp(svg, { density: 1200 }).resize(size, size).png().toBuffer();
const BG = "#0a0f24";

for (const size of [192, 512]) {
  await sharp(await render(size)).toFile(`public/icons/icon-${size}.png`);
  // Maskable: full-bleed background with the mark inside the 80% safe zone.
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: await render(Math.round(size * 0.72)), gravity: "center" }])
    .png()
    .toFile(`public/icons/maskable-${size}.png`);
}
await sharp(await render(180)).flatten({ background: BG }).toFile("src/app/apple-icon.png");
console.log("Icons written to public/icons and src/app/apple-icon.png");
