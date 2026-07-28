// Generates the app's icon set (icon-192, icon-512, icon-maskable-512,
// apple-touch-icon) from a single hand-authored SVG — a glossy 3D-shaded
// version of the splash screen's rainbow orb, with a graduation-cap emblem
// tying it to "learning" rather than the previous generic checkmark.
//
// No AI image model involved (this sandbox has no Gemini/image-gen API key
// configured) — the "3D" look comes entirely from layered SVG gradients:
// a radial base for sphere volume, a blurred highlight for gloss, and a
// soft drop shadow, the same trick used for glossy app-icon renders
// everywhere before AI image generation existed.
//
// Usage: node scripts/icon/generate.mjs

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../../public");

// Rainbow hues match .siri-orb in globals.css (the splash screen's orb) —
// keeps the icon visually the same "brand object" as the in-app orb, just
// rendered as a static glossy sphere instead of an animated conic gradient.
const HUES = ["#ff8a5c", "#ff5f9e", "#b06bff", "#5a8dff", "#64d8ff", "#7dffb2"];

// bg=true fills the full canvas with the app's dark background (required
// for the maskable variant, since the OS applies its own shape mask and
// transparency inside that mask reads as broken) and shrinks the artwork
// to stay inside the maskable "safe zone" (centered 80% of the canvas).
function iconSvg({ size, bg }) {
  const cx = size / 2;
  const cy = size / 2;
  const sphereR = bg ? size * 0.3 : size * 0.36;
  const capW = sphereR * 1.5;
  const capH = capW * 0.34;
  const capY = cy - sphereR * 0.12;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="sphereBase" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="${HUES[4]}" />
      <stop offset="28%" stop-color="${HUES[3]}" />
      <stop offset="55%" stop-color="${HUES[2]}" />
      <stop offset="78%" stop-color="${HUES[1]}" />
      <stop offset="100%" stop-color="${HUES[0]}" />
    </radialGradient>
    <radialGradient id="sphereShade" cx="68%" cy="72%" r="65%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0" />
      <stop offset="60%" stop-color="#000000" stop-opacity="0" />
      <stop offset="100%" stop-color="#1a0630" stop-opacity="0.38" />
    </radialGradient>
    <radialGradient id="gloss" cx="32%" cy="24%" r="30%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85" />
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="capTop" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e7e6f2" />
    </linearGradient>
    <linearGradient id="capBase" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f4f3fb" />
      <stop offset="100%" stop-color="#c9c7db" />
    </linearGradient>
    <radialGradient id="tuft" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#ffe9a8" />
      <stop offset="100%" stop-color="#f5b93f" />
    </radialGradient>
    <filter id="softBlur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${size * 0.02}" />
    </filter>
    <filter id="shadowBlur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${size * 0.035}" />
    </filter>
  </defs>

  ${bg ? `<rect width="${size}" height="${size}" fill="#0b0b14" />` : ""}

  <!-- ambient dark backdrop glow so the sphere doesn't float on nothing,
       matching the splash screen's dark gradient field -->
  ${!bg ? `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#0b0b14" />` : ""}

  <!-- soft ground shadow beneath the sphere -->
  <ellipse cx="${cx}" cy="${cy + sphereR * 0.92}" rx="${sphereR * 0.85}" ry="${sphereR * 0.22}" fill="#000000" opacity="0.35" filter="url(#shadowBlur)" />

  <!-- the sphere itself -->
  <circle cx="${cx}" cy="${cy}" r="${sphereR}" fill="url(#sphereBase)" />
  <circle cx="${cx}" cy="${cy}" r="${sphereR}" fill="url(#sphereShade)" />
  <circle cx="${cx}" cy="${cy}" r="${sphereR}" fill="url(#gloss)" />

  <!-- graduation cap emblem: board + dome + tassel, each with its own
       light/dark edge for embossed relief -->
  <g>
    <ellipse cx="${cx}" cy="${capY + capH * 0.62}" rx="${capW * 0.34}" ry="${capH * 0.5}" fill="url(#capBase)" />
    <polygon
      points="${cx},${capY - capH * 0.62} ${cx + capW / 2},${capY} ${cx},${capY + capH * 0.62} ${cx - capW / 2},${capY}"
      fill="url(#capTop)"
    />
    <polygon
      points="${cx},${capY - capH * 0.62} ${cx + capW / 2},${capY} ${cx},${capY + capH * 0.1}"
      fill="#ffffff"
      opacity="0.55"
    />
    <path
      d="M ${cx + capW * 0.06} ${capY + capH * 0.08} C ${cx + capW * 0.2} ${capY + capH * 0.55}, ${cx + capW * 0.12} ${capY + capH * 1.15}, ${cx + capW * 0.02} ${capY + capH * 1.35}"
      stroke="url(#tuft)"
      stroke-width="${size * 0.014}"
      fill="none"
      stroke-linecap="round"
    />
    <circle cx="${cx + capW * 0.02}" cy="${capY + capH * 1.4}" r="${size * 0.028}" fill="url(#tuft)" />
  </g>
</svg>`;
}

async function renderPng(size, bg, outPath) {
  const svg = Buffer.from(iconSvg({ size, bg }));
  await sharp(svg).resize(size, size).png().toFile(outPath);
  console.log(`  ✓ ${outPath} (${size}x${size}${bg ? ", maskable" : ""})`);
}

async function main() {
  console.log("Generating app icon set...");
  await renderPng(192, false, resolve(publicDir, "icon-192.png"));
  await renderPng(512, false, resolve(publicDir, "icon-512.png"));
  await renderPng(512, true, resolve(publicDir, "icon-maskable-512.png"));
  await renderPng(180, false, resolve(publicDir, "apple-touch-icon.png"));

  // Also drop the raw SVG source next to the script for easy re-editing.
  writeFileSync(resolve(__dirname, "icon-source.svg"), iconSvg({ size: 512, bg: false }));
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
