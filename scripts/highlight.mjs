/* Build-time semantic syntax highlighting for stanleyjacob.dev.
   Tokenizes every <pre><code> block with Shiki (TextMate grammars) and applies a
   semantic scheme over the token stream:
     - per-identifier coloring: each distinct variable name hashes (FNV-1a % 7) to a
       fixed pool color and keeps it everywhere it appears
     - rainbow brackets: ()[]{} colored by nesting depth, cycling 3 colors
     - everything else deliberately muted: modules/attributes/calls in gray tones,
       numbers gray, keywords in one accent color
   Output is baked into the HTML files; no highlighting library ships to the client.
   Classes are resolved by CSS in style.css (see "semantic code blocks" section).
   Idempotent: re-running from any state reproduces the same bytes.
   Optional per-block filename header: add data-file="name.py" to the <pre>.
   Run from the repo root: node scripts/highlight.mjs */

import { createHighlighter } from 'shiki'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SHIKI_LANGS = ['python', 'cpp', 'rust', 'go', 'typescript', 'swift', 'sql', 'http', 'bash', 'javascript', 'json', 'yaml', 'nginx', 'java', 'xml']
const CODE_CLASS_MAP = {
  python: 'python', cpp: 'cpp', c: 'cpp', rust: 'rust', go: 'go', typescript: 'typescript',
  ts: 'typescript', swift: 'swift', sql: 'sql', http: 'http', bash: 'bash', shell: 'bash',
  sh: 'bash', javascript: 'javascript', js: 'javascript', json: 'json', yaml: 'yaml',
  nginx: 'nginx', java: 'java', xml: 'xml',
}
const DATA_LANG_MAP = {
  python: 'python', cpp: 'cpp', rust: 'rust', go: 'go', typescript: 'typescript', swift: 'swift',
  pytorch: 'python', jax: 'python', triton: 'python', cuda: 'cpp',
}

// ---------- text utilities ----------
const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// Single-pass decode (sequential replace passes double-decode inputs like &#38;lt;).
const NAMED_ENTITIES = {
  lt: '<', gt: '>', quot: '"', apos: "'", amp: '&', nbsp: '\u00a0', mdash: '\u2014',
  ndash: '\u2013', hellip: '\u2026', middot: '\u00b7', bull: '\u2022', deg: '\u00b0',
  times: '\u00d7', divide: '\u00f7', minus: '\u2212', plusmn: '\u00b1', le: '\u2264',
  ge: '\u2265', ne: '\u2260', approx: '\u2248', rarr: '\u2192', larr: '\u2190',
  alpha: '\u03b1', beta: '\u03b2', gamma: '\u03b3', delta: '\u03b4', epsilon: '\u03b5',
  theta: '\u03b8', lambda: '\u03bb', mu: '\u03bc', pi: '\u03c0', sigma: '\u03c3',
  phi: '\u03c6', omega: '\u03c9', Sigma: '\u03a3', Delta: '\u0394', int: '\u222b',
  sup2: '\u00b2', sup3: '\u00b3', copy: '\u00a9',
}
function decodeEntities(s) {
  return s.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]{1,31}));/g,
    (m, dec, hex, name) => {
      if (dec) return String.fromCodePoint(+dec)
      if (hex) return String.fromCodePoint(parseInt(hex, 16))
      return name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : m
    })
}
// true when the raw escaped text contains entities the decoder does not know;
// such blocks are left untouched rather than risk changing what the reader sees
function hasUnknownEntities(raw) {
  for (const m of raw.matchAll(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g))
    if (!(m[1] in NAMED_ENTITIES)) return true
  return false
}
function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h
}

// ---------- import scanning: names that should render as muted library names ----------
function scanImports(src, lang) {
  const set = new Set()
  const add = n => { if (n && /^[A-Za-z_]\w*$/.test(n)) set.add(n) }
  if (lang === 'python') {
    for (const m of src.matchAll(/^[ \t]*import[ \t]+([^\n#;]+)/gm))
      for (const part of m[1].split(',')) {
        const pm = part.trim().match(/^([\w.]+)(?:[ \t]+as[ \t]+(\w+))?$/)
        if (pm) { add(pm[1].split('.')[0]); add(pm[2]) }
      }
    for (const m of src.matchAll(/^[ \t]*from[ \t]+([\w.]+)[ \t]+import[ \t]+([^\n#;]+)/gm)) {
      add(m[1].split('.')[0])
      for (const part of m[2].replace(/[()\\]/g, ' ').split(',')) {
        const pm = part.trim().match(/^(\w+)(?:[ \t]+as[ \t]+(\w+))?$/)
        if (pm) add(pm[2] || pm[1])
      }
    }
  } else if (lang === 'typescript' || lang === 'javascript') {
    for (const m of src.matchAll(/^[ \t]*import[ \t]+(?:type[ \t]+)?([^'"\n]+?)[ \t]+from[ \t]+['"]/gm))
      for (const name of m[1].replace(/[{}*]/g, ' ').split(/[,\s]+/)) if (name !== 'as') add(name)
  } else if (lang === 'go') {
    for (const m of src.matchAll(/^[ \t]*(?:import[ \t]+)?(?:\w+[ \t]+)?"([\w./-]+)"[ \t]*$/gm)) add(m[1].split('/').pop())
    for (const m of src.matchAll(/^[ \t]*import[ \t]+(?:\w+[ \t]+)?"([\w./-]+)"/gm)) add(m[1].split('/').pop())
  } else if (lang === 'rust') {
    for (const m of src.matchAll(/^[ \t]*use[ \t]+([\w:]+)/gm)) add(m[1].split('::')[0])
  } else if (lang === 'swift') {
    for (const m of src.matchAll(/^[ \t]*import[ \t]+(\w+)/gm)) add(m[1])
  }
  return set
}

// ---------- classification ----------
// Segments from Shiki can merge several lexical atoms into one plain token
// ("queue." in Swift, "__restrict__ x" in C++), so scope-classified segments are
// first split into atoms and identifier logic runs on the atom stream.
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const SELF_NAMES = new Set(['self', 'cls', 'this'])
const CUDA_KEYWORDS = new Set(['__global__', '__device__', '__shared__', '__restrict__',
  '__constant__', '__host__', '__forceinline__', '__launch_bounds__'])
// names treated as library modules even when a fragment omits its import lines
const WELL_KNOWN_MODULES = new Set(['np', 'numpy', 'torch', 'nn', 'F', 'jax', 'jnp', 'lax',
  'tl', 'triton', 'optax', 'flax', 'linen', 'math', 'os', 'sys', 're', 'json', 'random',
  'time', 'heapq', 'bisect', 'itertools', 'functools', 'collections', 'typing',
  'dataclasses', 'pd', 'pandas', 'plt', 'scipy', 'sklearn', 'cv2', 'einops', 'gym',
  'std', 'fmt'])

// scope-only classification; returns null when the segment is plain source text
function scopeClass(scopes, text) {
  const has = p => scopes.some(sc => sc.startsWith(p))
  const inc = p => scopes.some(sc => sc.includes(p))
  if (has('comment') || inc('.comment')) return 'c'
  if (inc('constant.character.format.placeholder'))
    return inc('string.interpolated') ? 'd' : 's' // f-string braces join the bracket pass; %s/{} in plain strings stay string-colored
  if (has('constant.character.escape') || inc('storage.type.format') || inc('storage.type.string')) return 's'
  if (scopes.some(sc => sc.startsWith('string')) && !inc('meta.embedded') && !inc('template.expression')) return 's'
  if (has('constant.numeric')) return 'n'
  if (has('constant.language')) return 'k'
  if (inc('variable.language')) return 'k'
  if (has('storage')) return 'k'
  if (has('keyword')) {
    if (inc('keyword.operator') && !/^[A-Za-z_]/.test(text.trim())) return 'd'
    return 'k'
  }
  if (inc('entity.name.function') || inc('support.function') || inc('variable.function')
    || inc('entity.name.type') || inc('support.class') || inc('support.type')
    || inc('entity.name.namespace') || inc('entity.other') || inc('support.module')) return 'm1'
  if (has('punctuation') || inc('.punctuation')) return 'd'
  return null
}

function fnvClass(name) { return 'v' + (fnv1a(name) % 7) }

// languages where -> and :: are member/scope accessors (python's -> is a return annotation)
const ARROW_LANGS = new Set(['cpp', 'rust', 'c'])
const SCOPE_LANGS = new Set(['cpp', 'rust', 'c'])

function renderTokens(segs, importSet, lang) {
  // 1. atomize
  const atoms = [] // {text, cls|null, line}
  let line = 0
  for (const seg of segs) {
    if (seg.text === '\n' && seg.scopes.length === 0) { atoms.push({ text: '\n', cls: 'd', line }); line++; continue }
    const cls = scopeClass(seg.scopes, seg.text)
    if (cls !== null) { atoms.push({ text: seg.text, cls, line }); continue }
    for (const piece of seg.text.split(/([A-Za-z_][A-Za-z0-9_]*)/)) {
      if (!piece) continue
      atoms.push({ text: piece, cls: IDENT_RE.test(piece) ? null : 'd', line })
    }
  }
  const prevAtom = i => { for (let j = i - 1; j >= 0; j--) { const a = atoms[j]; if (a.line !== atoms[i].line) return null; if (a.text.trim() !== '') return a } ; return null }
  const nextAtom = i => { for (let j = i + 1; j < atoms.length; j++) { const a = atoms[j]; if (a.line !== atoms[i].line) return null; if (a.text.trim() !== '') return a } ; return null }

  // 2. classify identifier atoms
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i]
    if (a.cls !== null) continue
    const name = a.text
    if (SELF_NAMES.has(name)) { a.cls = 'k'; continue }
    if ((lang === 'cpp' || lang === 'c') && CUDA_KEYWORDS.has(name)) { a.cls = 'k'; continue }
    const prev = prevAtom(i), next = nextAtom(i)
    const pt = prev ? prev.text.trim() : ''
    const accessor = pt === '.' || (SCOPE_LANGS.has(lang) && pt === '::') || (ARROW_LANGS.has(lang) && pt === '->')
    if (accessor && prev.cls !== 'c' && prev.cls !== 's') { a.cls = 'm2'; continue }
    const nt = next ? next.text.trim() : ''
    if (nt.startsWith('(')) { a.cls = 'm1'; continue }
    if (SCOPE_LANGS.has(lang) && nt.startsWith('::')) { a.cls = 'm1'; continue }
    if (importSet.has(name) || WELL_KNOWN_MODULES.has(name)) { a.cls = 'm1'; continue }
    a.cls = fnvClass(name)
  }

  // 3. consolidate: a name that is ever a definition/call (m1 via scopes or call
  // position) renders m1 everywhere it appears as a plain or pooled atom, so
  // functions, classes, and types keep one color across def, call, and value use.
  // m2 attribute positions keep their own class: obj.weight and a local `weight`
  // are different things.
  const promoted = new Set()
  for (const a of atoms) {
    const t = a.text.trim()
    if (a.cls === 'm1' && IDENT_RE.test(t)) promoted.add(t)
  }
  for (const a of atoms) {
    const t = a.text.trim()
    if (a.cls && a.cls.startsWith('v') && promoted.has(t)) a.cls = 'm1'
  }

  // 4. emit with rainbow-bracket pass over non-string/comment atoms
  const out = []
  const push = (cls, text) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.cls === cls) last.text += text
    else out.push({ cls, text })
  }
  let depth = 0
  for (const a of atoms) {
    if (a.cls === 's' || a.cls === 'c') { push(a.cls, a.text); continue }
    let run = ''
    for (const ch of a.text) {
      if (OPEN.includes(ch)) { push(a.cls, run); run = ''; push('b' + (depth % 3), ch); depth++; continue }
      if (CLOSE.includes(ch)) { push(a.cls, run); run = ''; depth = Math.max(0, depth - 1); push('b' + (depth % 3), ch); continue }
      run += ch
    }
    push(a.cls, run)
  }
  return out.map(({ cls, text }) => cls === 'd' ? escapeHtml(text) : `<span class="${cls}">${escapeHtml(text)}</span>`).join('')
}

// ---------- rendering ----------
const OPEN = '([{', CLOSE = ')]}'

let hl
function highlightSource(src, lang) {
  if (!SHIKI_LANGS.includes(lang)) return escapeHtml(src)
  const lines = hl.codeToTokensBase(src, { lang, theme: 'github-dark', includeExplanation: true })
  const segs = []
  lines.forEach((line, li) => {
    if (li) segs.push({ text: '\n', scopes: [] })
    for (const tok of line) {
      if (tok.explanation && tok.explanation.length)
        for (const e of tok.explanation) segs.push({ text: e.content, scopes: e.scopes.map(s => s.scopeName) })
      else segs.push({ text: tok.content, scopes: [] })
    }
  })
  const rendered = renderTokens(segs, scanImports(src, lang), lang)
  // invariant: highlighting must never change the text itself
  const plain = rendered.replace(/<[^>]+>/g, '')
  if (decodeEntities(plain) !== src) throw new Error('text integrity violated for lang ' + lang)
  return rendered
}

// ---------- page transformation ----------
const COPY_BTN = '<button class="shl-copy" type="button" aria-label="Copy code">Copy</button>'

function normalize(html) {
  // strip artifacts of previous runs so the transform is idempotent
  html = html.replace(/<div class="shl-box">(<button class="shl-copy"[^>]*>[\s\S]*?<\/button>)?(<pre[\s\S]*?<\/pre>)<\/div>/g, '$2')
  html = html.replace(/<button class="shl-copy"[^>]*>[\s\S]*?<\/button>/g, '')
  html = html.replace(/<span class="shl-file">[\s\S]*?<\/span>/g, '')
  return html
}

function langFor(preAttrs, codeAttrs) {
  const cm = /language-([a-zA-Z-]+)/.exec(codeAttrs || '')
  if (cm && CODE_CLASS_MAP[cm[1]]) return CODE_CLASS_MAP[cm[1]]
  if (cm) return null // language-text, language-plaintext, unknown -> plain
  const dm = /data-lang="([a-z]+)"/.exec(preAttrs || '')
  if (dm && DATA_LANG_MAP[dm[1]]) return DATA_LANG_MAP[dm[1]]
  return 'SNIFF' // untagged: infer conservatively from content
}

// Conservative language inference for untagged blocks (OSS chapters, shell
// sessions, config snippets). Only patterns with essentially no false-positive
// risk; anything ambiguous stays plain. Text integrity is enforced downstream
// either way, so a wrong guess can only affect colors, never content.
function sniffLang(src) {
  const s = src.trimStart()
  const lines = src.split('\n')
  if (/^[[{]/.test(s)) { try { JSON.parse(src); return 'json' } catch { /* not json */ } }
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/|\w+:\/\/)|^HTTP\/\d/.test(s)) return 'http'
  if (/^(server|location|upstream|events)\s*\{|^\s*(proxy_pass|listen\s+\d|server_name|try_files)\s/m.test(src)) return 'nginx'
  if (/^sqlite>\s/m.test(src)) return 'sql'
  if (/^\d+\.\d+\.\d+\.\d+:\d+>/m.test(src)) return null // redis-cli transcript: output-dominated
  if (s.startsWith('<') && /<\/\w+>/.test(src)) return 'xml'
  if (/\b(public|private|protected)\s+(class|static|final|void)\b|^import\s+(java|org)\./m.test(src)
    || /\b[A-Z]\w*\s+\w+\s*=\s*new\s+[A-Z]\w*[(<]/.test(src)) return 'java'
  if (/\bdo\b/.test(src) && /\bdone\b/.test(src) && /^for\s+\w+\s+in\s/m.test(src)) return 'bash'
  const pythonish = /^(import|from)\s+\w|^\s*def\s+\w+\s*\(|^\s*class\s+\w+[(:]|^>>> /m
  if (pythonish.test(src)) return 'python'
  // python fragments: assignments to calls, kwarg calls, f-strings, dict/method
  // idioms; all far more specific than anything in the site's shell/output blocks
  const cFragment = (/^\s*\/\//m.test(src) || /;\s*$/m.test(src)) && /[;{}]/.test(src)
  const pyFragment = !cFragment && (/^\s*\w[\w.]*\s*=\s*[\w.]+\(/m.test(src) && !src.includes('$(')
    || /\bf"[^"]*\{/.test(src) || /\blambda\s+\w+\s*:/.test(src)
    || /^\s*(return|yield)\s+\w/m.test(src) || /^\s*for\s+\w+(,\s*\w+)*\s+in\s+.+:\s*$/m.test(src)
    || /^\s*with\s+\w[\w.]*(\(.*\))?\s+as\s+\w+\s*:\s*$/m.test(src)
    || /^\s*print\(/m.test(src) || /\bself\.\w/.test(src)
    || /^\s*\w+\s*=\s*\{/m.test(src)
    || /^\s*\w+\s*=\s*[\w.]+(\s*[-+*/]\s*[\w.]+)+\s*$/m.test(src)
  )
  if (pyFragment) return 'python'
  if (/^[A-Z_][A-Z0-9_]*=\S+\s+\S/.test(s)) return 'bash' // ENVVAR=value cmd ...
  if (/^#include\s*[<"]|^\s*int\s+main\s*\(|__global__|__device__/m.test(src)) return 'cpp'
  if ((/^\s*\/\//m.test(src) || /\w+::\w+/.test(src)) && /(->\w+\(|\w+::\w+|;\s*$)/m.test(src)
    && !/^\s*(\$|#)\s/m.test(src)) return 'cpp'
  if (/^\s*(SELECT|CREATE TABLE|CREATE INDEX|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|EXPLAIN|PRAGMA|ALTER TABLE|BEGIN|VACUUM|WITH RECURSIVE)\b/im.test(src)
    && !/^\s*(\$|#)\s/m.test(src)) return 'sql'
  const shellStart = /^(\$|%|sudo |gcc |g\+\+ |make(\s|$)|cmake |pip3? |uv |npm |npx |node |git |curl |wget |docker |kubectl |kind |helm |brew |apt |apt-get |yum |cargo |go |rustc |python3? |sqlite3 |redis-cli |psql |mkdir |cd |ls |cat |echo |export |source |chmod |tar |unzip |ssh |scp |mv |cp |rm |find |grep |sed |awk |xxd |vllm |trtllm|llama-|torchrun |ray |accelerate |huggingface-cli |\.\/)/
  // first non-empty, non-comment line decides whether this is a shell block
  const firstCmd = lines.find(l => l.trim() && !l.trim().startsWith('#'))
  if (firstCmd) {
    const t = firstCmd.trim()
    if (shellStart.test(t)) return 'bash'
    if (/^[a-z][\w.-]*\s+-{1,2}\w/.test(t)) return 'bash' // any command with flags
    const nonEmpty = lines.filter(l => l.trim())
    if (nonEmpty.length === 1 && /^[a-z][\w.-]*(\s+[\w./:@-]+)+$/.test(t)) return 'bash' // one-line command
  }
  return null
}

function addShlClass(attrs) {
  if (/class="/.test(attrs)) {
    if (/class="[^"]*\bshl\b/.test(attrs)) return attrs
    return attrs.replace(/class="/, 'class="shl ')
  }
  return ' class="shl"' + attrs
}

function transformFile(file) {
  const orig = fs.readFileSync(file, 'utf8')
  let html = normalize(orig)
  let count = 0

  html = html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g, (whole, preAttrs, inner) => {
    if (/class="[^"]*\bflow\b/.test(preAttrs)) return whole // ASCII diagrams stay as they are
    const cm = /^\s*<code\b([^>]*)>([\s\S]*)<\/code>\s*$/.exec(inner)
    if (!cm) return whole
    const [, codeAttrs, codeInner] = cm
    const stripped = codeInner.replace(/<\/?span[^>]*>/g, '')
    if (/<\/?[a-zA-Z][^>]*>/.test(stripped)) return whole // typeset content (sub/sup/...), not code
    if (hasUnknownEntities(stripped)) return whole // entities the decoder cannot round-trip
    const src = decodeEntities(stripped)
    let lang = langFor(preAttrs, codeAttrs)
    if (lang === 'SNIFF') lang = sniffLang(src)
    const rendered = lang ? highlightSource(src, lang) : escapeHtml(src)
    count++
    const fileAttr = /data-file="([^"]*)"/.exec(preAttrs)
    const header = fileAttr ? `<span class="shl-file">${escapeHtml(fileAttr[1])}</span>` : ''
    const pre = `<pre${addShlClass(preAttrs)}>${header}<code${codeAttrs}>${rendered}</code></pre>`
    const standalone = !/class="[^"]*\blang\b/.test(preAttrs)
    return standalone ? `<div class="shl-box">${COPY_BTN}${pre}</div>` : pre
  })

  // no runtime highlighting library anywhere: remove highlight.js and its init hook
  // even on pages whose only <code> is inline (they loaded it pointlessly before)
  html = html.replace(/\n?[ \t]*<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/highlight\.js\/[^"]*"[^>]*\/>/g, '')
  html = html.replace(/\n?[ \t]*<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/highlight\.js\/[^"]*"[^>]*><\/script>/g, '')
  html = html.replace(/\n?[ \t]*<script>(?:(?!<\/script>)[\s\S])*hljs(?:(?!<\/script>)[\s\S])*<\/script>/g, '')
  if (count) {
    // one copy button per tabs group, right-aligned in the language row
    html = html.replace(/(<div class="lang-row">)([\s\S]*?)(<\/div>)/g, (m, a, b, c) =>
      b.includes('shl-copy') ? m : a + b + COPY_BTN + c)
    if (!html.includes('/code-copy.js')) {
      const before = html
      html = html.replace('  </body>', '    <script defer src="/code-copy.js"></script>\n  </body>')
      if (html === before) html = html.replace('</body>', '<script defer src="/code-copy.js"></script>\n</body>')
    }
  }
  if (html !== orig) fs.writeFileSync(file, html)
  return count
}

function* htmlFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* htmlFiles(p)
    else if (e.name.endsWith('.html')) yield p
  }
}

hl = await createHighlighter({ themes: ['github-dark'], langs: SHIKI_LANGS })
let files = 0, blocks = 0
for (const f of htmlFiles(ROOT)) {
  const n = transformFile(f)
  if (n) files++
  blocks += n
}
console.log(`highlighted ${blocks} code blocks across ${files} files`)
