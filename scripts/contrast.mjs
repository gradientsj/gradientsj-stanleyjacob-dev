// WCAG AA checker for the soft-redesign palette, run against BOTH themes.
// Reads style.css, asserts the light tokens exist in :root and the dark
// tokens exist in the :root[data-theme="dark"] block, then checks every
// text/background pair the design uses in each theme, compositing tinted
// chip backgrounds over each surface they can sit on.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");

const LIGHT_TOKENS = {
  bg: "#FAF6F0", bgSoft: "#F2EDE4", bgCard: "#FCF9F4", bgCardHover: "#F5EEE1",
  text: "#2B2621", muted: "#6F675C", muted2: "#6C655A", chipText: "#625B51",
  line: "#E5DECF", lineSoft: "#EDE7DA",
  accent: "#AF3A03", accentPress: "#9A3403",
  tealText: "#35624A", sageText: "#43684A", goldText: "#8A5A0F",
  plumText: "#8F3F71", terraText: "#9A3403",
};
const DARK_TOKENS = {
  bg: "#211B14", bgSoft: "#2A231A", bgCard: "#272019", bgCardHover: "#2F2820",
  text: "#EDE6DA", muted: "#B5AA9A", muted2: "#A79C8B", chipText: "#C4B8A6",
  line: "#3B3327", lineSoft: "#332B21",
  accent: "#E8814B", accentPress: "#F0925D",
  tealText: "#7FB89A", sageText: "#93BE8F", goldText: "#D9A84E",
  plumText: "#CE8DB4", terraText: "#E8814B",
};
// hue RGB triplets are shared by both themes (only the alpha tints are used)
const TINTS = {
  teal: "#427B58", sage: "#689D6A", gold: "#B57614",
  plum: "#8F3F71", terra: "#AF3A03",
};

// the block a theme's tokens must be declared in
const darkBlockMatch = css.match(/:root\[data-theme="dark"\]\s*\{[^}]*\}/);
const scopes = {
  light: css,
  dark: darkBlockMatch ? darkBlockMatch[0] : "",
};

let failures = 0;
function assertTokens(themeName, tokens) {
  const scope = scopes[themeName].toUpperCase();
  for (const [name, hex] of Object.entries(tokens)) {
    if (!scope.includes(hex.toUpperCase())) {
      console.error(`MISSING ${themeName} token ${name} ${hex} in style.css`);
      failures++;
    }
  }
}
assertTokens("light", LIGHT_TOKENS);
assertTokens("dark", DARK_TOKENS);

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

// onSolidFg: the label color used on solid hue-text chips (quiz keys). In
// light mode that is white; in dark mode the solids are the light hue-text
// values, so the label flips to the page ink (see the dark adaptation block).
function checkTheme(themeName, TOKENS, onSolidFg) {
  const surfaces = [TOKENS.bg, TOKENS.bgSoft, TOKENS.bgCard, TOKENS.bgCardHover];
  const pairs = [];
  for (const s of surfaces) {
    pairs.push(["text", TOKENS.text, s], ["muted", TOKENS.muted, s],
      ["accent", TOKENS.accent, s], ["accentPress", TOKENS.accentPress, s]);
  }
  for (const s of surfaces) pairs.push(["muted2/meta", TOKENS.muted2, s]);
  // default (un-hued) .tag chip: chip-text on the 9% neutral tint over every
  // surface (the fallback tint triplet 111,103,92 is shared by both themes)
  for (const s of surfaces) pairs.push(["neutral-chip", TOKENS.chipText, over("#6F675C", s, 0.09)]);
  // hue text on its own 9% chip tint composited over every surface
  for (const [hue, tint] of Object.entries(TINTS)) {
    const text = TOKENS[hue + "Text"];
    for (const s of surfaces) pairs.push([`${hue}-chip`, text, over(tint, s, 0.09)]);
  }
  // feedback states (quiz): text-safe on 12% tint over card bg; label on solid text-safe
  pairs.push(["quiz-ok", TOKENS.sageText, over(TINTS.sage, TOKENS.bgCard, 0.12)]);
  pairs.push(["quiz-no", TOKENS.terraText, over(TINTS.terra, TOKENS.bgCard, 0.08)]);
  for (const k of ["tealText", "sageText", "goldText", "plumText", "terraText"]) {
    pairs.push([`solid-${k}`, onSolidFg, TOKENS[k]]);
  }
  // primary button label on its tint at rest and hover, on both page surfaces
  for (const a of [0.08, 0.14]) for (const s of [TOKENS.bg, TOKENS.bgSoft]) {
    pairs.push([`btn@${a}`, TOKENS.accentPress, over(TINTS.terra, s, a)]);
  }

  let ok = 0;
  for (const [name, fg, bgc] of pairs) {
    const r = ratio(fg, bgc);
    if (r < 4.5) {
      console.error(`FAIL [${themeName}] ${name}: ${fg} on ${bgc} = ${r.toFixed(2)}:1`);
      failures++;
    } else ok++;
  }
  console.log(`${themeName}: ${ok}/${pairs.length} pairs pass WCAG AA 4.5:1`);
}

checkTheme("light", LIGHT_TOKENS, "#FFFFFF");
checkTheme("dark", DARK_TOKENS, DARK_TOKENS.bg);

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log("OK: both themes pass");
