/* Palette definition + verification for the semantic code-highlighting component.
   Checks, per the spec:
     1. every identifier-pool color >= 4.5:1 WCAG contrast against the block background
     2. no identifier pair relies on red-vs-green alone: under protanopia and
        deuteranopia simulation (Machado et al. 2009, severity 1.0), every pair must
        stay distinguishable (CIEDE2000 >= 12, or Lightness gap >= 10).
   If a spec color fails, a minimal lightness-only adjustment is searched (hue and
   saturation preserved) and reported. Run: node scripts/palette.mjs */

export const SPEC = {
  bg: '#282a36',
  fg: '#abb2bf',
  kw: '#bd93f9',
  mut1: '#7f8ca3',
  mut2: '#6c7086',
  brackets: ['#61afef', '#c678dd', '#e5c07b'],
  pool: ['#e5c07b', '#98c379', '#d19a66', '#56b6c2', '#61afef', '#e06c75', '#ff79c6'],
}

// ---------- color math ----------
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
const rgb2hex = c => '#' + c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')
const lin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
const delin = c => c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055

const relLum = h => { const [r, g, b] = hex2rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export const wcag = (a, b) => { const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

// linear RGB -> XYZ (sRGB D65) -> Lab
function rgb2lab(h) {
  const [r, g, b] = hex2rgb(h).map(lin)
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
  const Z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b
  const [xn, yn, zn] = [0.95047, 1.0, 1.08883]
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116
  const [fx, fy, fz] = [f(X / xn), f(Y / yn), f(Z / zn)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

// CIEDE2000 (Sharma et al. 2005 formulation)
export function dE00(lab1, lab2) {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2)
  const h = (a, b) => { if (a === 0 && b === 0) return 0; let d = Math.atan2(b, a) * 180 / Math.PI; return d < 0 ? d + 360 : d }
  const h1p = h(a1p, b1), h2p = h(a2p, b2)
  const dLp = L2 - L1, dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360)
  const Lmp = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2
  let hmp = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hmp += h1p + h2p < 360 ? 360 : -360
    hmp /= 2
  } else hmp = h1p + h2p
  const T = 1 - 0.17 * Math.cos((hmp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * hmp * Math.PI / 180)
    + 0.32 * Math.cos((3 * hmp + 6) * Math.PI / 180) - 0.20 * Math.cos((4 * hmp - 63) * Math.PI / 180)
  const dTheta = 30 * Math.exp(-(((hmp - 275) / 25) ** 2))
  const RC = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7))
  const SL = 1 + 0.015 * (Lmp - 50) ** 2 / Math.sqrt(20 + (Lmp - 50) ** 2)
  const SC = 1 + 0.045 * Cmp, SH = 1 + 0.015 * Cmp * T
  const RT = -Math.sin(2 * dTheta * Math.PI / 180) * RC
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH))
}

// self-test against Sharma et al. reference pair
const st = dE00([50, 2.6772, -79.7751], [50, 0, -82.7485])
if (Math.abs(st - 2.0425) > 0.001) throw new Error('CIEDE2000 self-test failed: ' + st)

// Machado et al. 2009 severity-1.0 matrices, applied in linear RGB
const SIM = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
}
function simulate(h, kind) {
  const v = hex2rgb(h).map(lin)
  const M = SIM[kind]
  return rgb2hex(M.map(row => delin(Math.max(0, Math.min(1, row[0] * v[0] + row[1] * v[1] + row[2] * v[2])))))
}

// HSL lightness-only adjustment (preserves hue + saturation)
function hex2hsl(h) {
  const [r, g, b] = hex2rgb(h)
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  let hh
  if (mx === r) hh = ((g - b) / d + (g < b ? 6 : 0))
  else if (mx === g) hh = (b - r) / d + 2
  else hh = (r - g) / d + 4
  return [hh * 60, s, l]
}
function hsl2hex([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2
  let rgb
  if (h < 60) rgb = [c, x, 0]; else if (h < 120) rgb = [x, c, 0]; else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]; else if (h < 300) rgb = [x, 0, c]; else rgb = [c, 0, x]
  return rgb2hex(rgb.map(v => v + m))
}
const adjustL = (h, dl) => { const t = hex2hsl(h); return hsl2hex([t[0], t[1], Math.min(0.95, Math.max(0.05, t[2] + dl))]) }

// ---------- constraint evaluation ----------
function pairOk(a, b) {
  for (const kind of ['protanopia', 'deuteranopia']) {
    const la = rgb2lab(simulate(a, kind)), lb = rgb2lab(simulate(b, kind))
    if (dE00(la, lb) < 12 && Math.abs(la[0] - lb[0]) < 10) return { ok: false, kind, de: dE00(la, lb), dl: Math.abs(la[0] - lb[0]) }
  }
  return { ok: true }
}
function poolOk(pool, bg) {
  for (const c of pool) if (wcag(c, bg) < 4.5) return false
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++)
    if (!pairOk(pool[i], pool[j]).ok) return false
  return true
}

export function verifyAndAdjust() {
  const bg = SPEC.bg
  const report = []
  for (const c of SPEC.pool) report.push(`  contrast ${c} vs ${bg}: ${wcag(c, bg).toFixed(2)}:1 ${wcag(c, bg) >= 4.5 ? 'PASS' : 'FAIL'}`)
  for (let i = 0; i < SPEC.pool.length; i++) for (let j = i + 1; j < SPEC.pool.length; j++) {
    const r = pairOk(SPEC.pool[i], SPEC.pool[j])
    if (!r.ok) report.push(`  CVD pair ${SPEC.pool[i]} vs ${SPEC.pool[j]} FAIL under ${r.kind} (dE00 ${r.de.toFixed(1)}, dL* ${r.dl.toFixed(1)})`)
  }

  if (poolOk(SPEC.pool, bg)) return { pool: SPEC.pool.slice(), report, changes: [] }

  // The failing constraints decompose into connected clusters (union of colors that
  // appear together in a failing pair, plus contrast failures as singletons). Solve
  // each cluster independently by brute force over lightness offsets, with the
  // cluster's simulated-Lab values precomputed per candidate step.
  const n = SPEC.pool.length
  const parent = [...Array(n).keys()]
  const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]))
  const union = (a, b) => { parent[find(a)] = find(b) }
  const involved = new Set()
  SPEC.pool.forEach((c, i) => { if (wcag(c, bg) < 4.5) involved.add(i) })
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
    if (!pairOk(SPEC.pool[i], SPEC.pool[j]).ok) { involved.add(i); involved.add(j); union(i, j) }
  const clusters = new Map()
  for (const i of involved) {
    const r = find(i)
    if (!clusters.has(r)) clusters.set(r, [])
    clusters.get(r).push(i)
  }

  const STEPS = []
  for (let s = -16; s <= 16; s++) STEPS.push(s / 100)
  const pool = SPEC.pool.slice()
  const changes = []

  for (const members of clusters.values()) {
    // precompute per member per step: adjusted hex, contrast pass, simulated Labs
    const cand = members.map(pi => STEPS.map(dl => {
      const hx = adjustL(SPEC.pool[pi], dl)
      return {
        dl, hx,
        contrast: wcag(hx, bg) >= 4.5,
        lab: { protanopia: rgb2lab(simulate(hx, 'protanopia')), deuteranopia: rgb2lab(simulate(hx, 'deuteranopia')) },
      }
    }))
    const others = [...Array(n).keys()].filter(i => !members.includes(i))
    const otherLabs = others.map(i => ({
      i,
      lab: { protanopia: rgb2lab(simulate(pool[i], 'protanopia')), deuteranopia: rgb2lab(simulate(pool[i], 'deuteranopia')) },
    }))
    const labOk = (la, lb) => dE00(la, lb) >= 12 || Math.abs(la[0] - lb[0]) >= 10
    let best = null
    const pick = new Array(members.length)
    const rec = (k, cost) => {
      if (best && cost >= best.cost) return
      if (k === members.length) {
        // all intra-cluster pairs + cluster-vs-others must hold under both sims
        for (let a = 0; a < members.length; a++) {
          for (let b = a + 1; b < members.length; b++)
            for (const s of ['protanopia', 'deuteranopia'])
              if (!labOk(pick[a].lab[s], pick[b].lab[s])) return
          for (const o of otherLabs)
            for (const s of ['protanopia', 'deuteranopia'])
              if (!labOk(pick[a].lab[s], o.lab[s])) return
        }
        best = { picks: pick.slice(), cost }
        return
      }
      for (const c of cand[k]) {
        if (!c.contrast) continue
        pick[k] = c
        rec(k + 1, cost + Math.abs(c.dl))
      }
    }
    // order candidate steps by |dl| so cheap solutions are found early for pruning
    cand.forEach(list => list.sort((a, b) => Math.abs(a.dl) - Math.abs(b.dl)))
    rec(0, 0)
    if (!best) throw new Error('no lightness-only fix for cluster [' + members.map(i => SPEC.pool[i]).join(' ') + ']; widen search or allow hue shifts')
    members.forEach((pi, m) => {
      const c = best.picks[m]
      if (c.hx !== SPEC.pool[pi]) changes.push({ index: pi, from: SPEC.pool[pi], to: c.hx, dL: c.dl })
      pool[pi] = c.hx
    })
  }
  if (!poolOk(pool, bg)) throw new Error('cluster-wise solve left a violated constraint; clusters were not independent')
  return { pool, report, changes }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { pool, report, changes } = verifyAndAdjust()
  console.log('spec verification:')
  report.forEach(l => console.log(l))
  if (changes.length) {
    console.log('adjustments applied (lightness only, hue/saturation preserved):')
    for (const c of changes) console.log(`  pool[${c.index}] ${c.from} -> ${c.to} (L ${c.dL > 0 ? '+' : ''}${Math.round(c.dL * 100)}%)`)
  } else console.log('no adjustments needed')
  console.log('final pool:', pool.join(' '))
  console.log('final pool contrast:', pool.map(c => wcag(c, SPEC.bg).toFixed(2)).join(' '))
  let worst = null
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++)
    for (const kind of ['protanopia', 'deuteranopia']) {
      const la = rgb2lab(simulate(pool[i], kind)), lb = rgb2lab(simulate(pool[j], kind))
      const key = { pair: `${pool[i]}/${pool[j]}`, kind, de: dE00(la, lb), dl: Math.abs(la[0] - lb[0]) }
      if (!worst || Math.max(key.de / 12, key.dl / 10) < Math.max(worst.de / 12, worst.dl / 10)) worst = key
    }
  console.log(`tightest CVD pair: ${worst.pair} under ${worst.kind}: dE00 ${worst.de.toFixed(1)}, dL* ${worst.dl.toFixed(1)}`)
}
