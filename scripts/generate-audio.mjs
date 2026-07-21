#!/usr/bin/env node
/*
 * Generate a high-quality narration MP3 for an article using ElevenLabs.
 * The site works WITHOUT this (reader.js falls back to the browser voice for free).
 * Run this only when you want the upgraded narration on a page.
 *
 * Usage:
 *   export ELEVENLABS_API_KEY=sk_...           # your key
 *   export ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # optional, this is the default
 *   node scripts/generate-audio.mjs systems/robinhood/index.html
 *
 * It writes listen.mp3 next to the html file. reader.js already points at
 * data-audio="listen.mp3", so once the file exists the page uses it automatically.
 *
 * Requires Node 18+ (built-in fetch).
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

function fail(msg) { console.error("error: " + msg); process.exit(1); }

const htmlPath = process.argv[2];
if (!htmlPath) fail("pass the path to an article, e.g. node scripts/generate-audio.mjs systems/robinhood/index.html");
if (!API_KEY) fail("set ELEVENLABS_API_KEY in your environment first");

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&mdash;": ", ", "&ndash;": ", " };

function decode(s) {
  return s.replace(/&[a-z#0-9]+;/gi, (m) => (ENTITIES[m] != null ? ENTITIES[m] : " "));
}

function extractText(html) {
  const parts = [];
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let article = html.match(/<article[^>]*class="[^"]*prose[^"]*"[^>]*>([\s\S]*?)<\/article>/i);
  let body = article ? article[1] : html;
  // drop things we should never read aloud
  body = body
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<code[\s\S]*?<\/code>/gi, (m) => " " + m.replace(/<[^>]+>/g, "") + " ");
  // turn block boundaries into paragraph breaks so chunking is clean
  body = body.replace(/<\/(p|h1|h2|h3|h4|li|blockquote|figcaption)>/gi, "\n\n");
  const text = decode(body.replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const lead = h1 ? decode(h1[1].replace(/<[^>]+>/g, "")).trim() + ".\n\n" : "";
  return lead + text;
}

function chunk(text, max = 2400) {
  const blocks = text.split(/\n\n+/);
  const chunks = [];
  let cur = "";
  for (const b of blocks) {
    if ((cur + "\n\n" + b).length > max && cur) { chunks.push(cur.trim()); cur = ""; }
    if (b.length > max) {
      // split an oversized block on sentence boundaries
      const sentences = b.match(/[^.!?]+[.!?]+|\S+$/g) || [b];
      for (const s of sentences) {
        if ((cur + " " + s).length > max && cur) { chunks.push(cur.trim()); cur = ""; }
        cur += (cur ? " " : "") + s;
      }
    } else {
      cur += (cur ? "\n\n" : "") + b;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

async function tts(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.0 },
    }),
  });
  if (!res.ok) fail(`ElevenLabs returned ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

const html = await readFile(htmlPath, "utf8");
const text = extractText(html);
const chunks = chunk(text);
console.log(`extracted ${text.length} chars in ${chunks.length} chunk(s), synthesizing...`);

const buffers = [];
for (let i = 0; i < chunks.length; i++) {
  process.stdout.write(`  chunk ${i + 1}/${chunks.length}\r`);
  buffers.push(await tts(chunks[i]));
}
const out = join(dirname(htmlPath), "listen.mp3");
await writeFile(out, Buffer.concat(buffers));
console.log(`\nwrote ${out} (${(Buffer.concat(buffers).length / 1024).toFixed(0)} KB)`);
