// Draws the app icons from the logo artwork using the preinstalled Chromium.
// Run: node scripts/make-icons.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const feet = (scale) => `
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
    <g fill="#fdeee7">
      <ellipse cx="25" cy="38" rx="7" ry="10" transform="rotate(-12 25 38)"/>
      <circle cx="19.5" cy="24" r="2.6"/><circle cx="24.5" cy="22" r="2.4"/><circle cx="29" cy="23.2" r="2.1"/>
    </g>
    <g fill="#f4d67c">
      <ellipse cx="42" cy="28" rx="5" ry="7.4" transform="rotate(10 42 28)"/>
      <circle cx="38.6" cy="17.6" r="1.9"/><circle cx="42.4" cy="16.4" r="1.8"/><circle cx="45.8" cy="17.6" r="1.6"/>
    </g>
  </g>`;
const svg = (rounded, scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="#7a52a6"/>${feet(scale)}</svg>`;

const out = [
  ["public/icons/icon-192.png", 192, svg(true, 1)],
  ["public/icons/icon-512.png", 512, svg(true, 1)],
  ["public/icons/icon-maskable-512.png", 512, svg(false, 0.78)],
  ["public/icons/apple-touch-icon.png", 180, svg(false, 0.9)],
  ["src/app/icon.png", 64, svg(true, 1)],
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, art] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${art.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.locator("svg").screenshot({ path: file, omitBackground: true });
  console.log("wrote", file);
}
await browser.close();
