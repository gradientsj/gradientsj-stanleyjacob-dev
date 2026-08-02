// WCAG AA checker for the soft-redesign palette. Reads style.css, asserts the
// new tokens exist, then checks every text/background pair the design uses,
// compositing tinted chip backgrounds over each surface they can sit on.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");

const TOKENS = {
  bg: "#FAF6F0", bgSoft: "#F2EDE4", bgCard: "#FCF9F4", bgCardHover: "#F5EEE1",
  text: "#2B2621", muted: "#6F675C", muted2: "#6C655A", chipText: "#625B51",
  accent: "#AF3A03", accentPress: "#9A3403",
  tealText: "#35624A", sageText: "#43684A", goldText: "#8A5A0F",
  plumText: "#8F3F71", terraText: "#9A3403",
};
const TINTS = {
  teal: "#427B58", sage: "#689D6A", gold: "#B57614",
  plum: "#8F3F71", terra: "#AF3A03",
};

let failures = 0;
for (const [name, hex] of Object.entries(TOKENS)) {
  if (!css.toUpperCase().includes(hex)) {
    console.error(`MISSING token ${name} ${hex} in style.css`);
    failures++;
  }
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg, base, alpha) => {
  const f = rgb(fg), b = rgb(base);
  return "#" + f.map((c, i) => Math.round(alpha * c + (1 - alpha) * b[i])
    .toString(16).padStart(2, "0")).join("");
};

const surfaces = [TOKENS.bg, TOKENS.bgSoft, TOKENS.bgCard, TOKENS.bgCardHover];
const pairs = [];
for (const s of surfaces) {
  pairs.push(["text", TOKENS.text, s], ["muted", TOKENS.muted, s],
    ["accent", TOKENS.accent, s], ["accentPress", TOKENS.accentPress, s]);
}
for (const s of surfaces) pairs.push(["muted2/meta", TOKENS.muted2, s]);
// default (un-hued) .tag chip: chip-text on the 9% neutral tint over every surface
for (const s of surfaces) pairs.push(["neutral-chip", TOKENS.chipText, over("#6F675C", s, 0.09)]);
// hue text on its own 9% chip tint composited over every surface
for (const [hue, tint] of Object.entries(TINTS)) {
  const text = TOKENS[hue + "Text"];
  for (const s of surfaces) pairs.push([`${hue}-chip`, text, over(tint, s, 0.09)]);
}
// feedback states (quiz): text-safe on 12% tint over card bg; white on solid text-safe
pairs.push(["quiz-ok", TOKENS.sageText, over(TINTS.sage, TOKENS.bgCard, 0.12)]);
pairs.push(["quiz-no", TOKENS.terraText, over(TINTS.terra, TOKENS.bgCard, 0.08)]);
for (const k of ["tealText", "sageText", "goldText", "plumText", "terraText"]) {
  pairs.push([`white-on-${k}`, "#FFFFFF", TOKENS[k]]);
}
// primary button label on its tint at rest and hover, on both page surfaces
for (const a of [0.08, 0.14]) for (const s of [TOKENS.bg, TOKENS.bgSoft]) {
  pairs.push([`btn@${a}`, TOKENS.accentPress, over(TINTS.terra, s, a)]);
}

for (const [name, fg, bgc] of pairs) {
  const r = ratio(fg, bgc);
  if (r < 4.5) {
    console.error(`FAIL ${name}: ${fg} on ${bgc} = ${r.toFixed(2)}:1`);
    failures++;
  }
}
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log(`OK: ${pairs.length} pairs pass WCAG AA 4.5:1`);
