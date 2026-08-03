/* Min-heap heapify visualizer. Mirrors the shape of viz/binary-search.js:
   bottom-up build-heap (sift-down) shown on both the array and the binary
   tree it encodes (index i has children 2i+1 and 2i+2). */
(function () {
  "use strict";
  function build(input) {
    var a = input.arr.slice();
    var n = a.length;
    var frames = [];
    var firstLeaf = n >> 1;
    frames.push({ a: a.slice(), sift: -1, cur: -1, kids: [], pick: -1, swap: null, doneFrom: firstLeaf,
      note: "Build a min-heap from [" + a.join(", ") + "]. Index i has children 2i+1 and 2i+2, so leaves a[" +
        firstLeaf + "..." + (n - 1) + "] are already heaps. Sift down nodes " + (firstLeaf - 1) + " down to 0." });
    for (var i = firstLeaf - 1; i >= 0; i--) {
      frames.push({ a: a.slice(), sift: i, cur: i, kids: [], pick: -1, swap: null, doneFrom: i + 1,
        note: "Sift down node " + i + " (value " + a[i] + "). Both subtrees below it are already min-heaps." });
      var cur = i;
      while (true) {
        var l = 2 * cur + 1, r = 2 * cur + 2;
        if (l >= n) break; // reached a leaf; the swap frame already said we are done
        var kids = r < n ? [l, r] : [l];
        var m = l;
        if (r < n && a[r] < a[l]) m = r;
        var kt = r < n
          ? "children a[" + l + "] = " + a[l] + " and a[" + r + "] = " + a[r]
          : "its only child a[" + l + "] = " + a[l];
        if (a[cur] <= a[m]) {
          frames.push({ a: a.slice(), sift: i, cur: cur, kids: kids, pick: -1, swap: null, ok: true, doneFrom: i + 1,
            note: "Compare a[" + cur + "] = " + a[cur] + " with " + kt +
              ": the parent is already the smallest, so the heap property holds. Stop." });
          break;
        }
        frames.push({ a: a.slice(), sift: i, cur: cur, kids: kids, pick: m, swap: null, doneFrom: i + 1,
          note: "Compare a[" + cur + "] = " + a[cur] + " with " + kt + ": smaller child a[" + m + "] = " + a[m] +
            " < " + a[cur] + ", so swap them." });
        var vc = a[cur];
        a[cur] = a[m]; a[m] = vc;
        var leafNow = 2 * m + 1 >= n;
        frames.push({ a: a.slice(), sift: i, cur: m, kids: [], pick: -1, swap: [cur, m], doneFrom: i + 1,
          note: "Swap indexes " + cur + " and " + m + ": value " + vc + " sinks to index " + m +
            (leafNow ? " — a leaf, so node " + i + " is settled." : "; keep sifting from index " + m + ".") });
        cur = m;
      }
    }
    frames.push({ a: a.slice(), sift: -1, cur: -1, kids: [], pick: -1, swap: null, doneFrom: 0, done: true,
      note: "Every parent is <= its children: [" + a.join(", ") + "] is a valid min-heap." });
    return frames;
  }

  function levelOf(i) {
    var d = 0, t = i + 1;
    while (t > 1) { t >>= 1; d++; }
    return d;
  }

  function draw(ctx, f, view) {
    var a = f.a, n = a.length, w = view.w, h = view.h, c = view.colors;
    var pad = 14;
    var kids = f.kids || [];

    // ----- layout: tree on top, array row at the bottom -----
    var cw = Math.min(56, (w - pad * 2) / n);
    var ch = Math.min(40, cw * 0.85, h * 0.16);
    var ax0 = (w - cw * n) / 2;
    var arrY = h - pad - 14 - ch;                 // top of the array cells
    var treeTop = pad + 8;
    var treeBottom = arrY - 26;                   // gap for the pointer labels
    var levels = 0;
    while ((1 << levels) - 1 < n) levels++;
    var levelH = (treeBottom - treeTop) / levels;
    var r = Math.max(10, Math.min(26, levelH * 0.36, (w / (1 << (levels - 1))) * 0.3));

    function pos(i) {
      var d = levelOf(i);
      var p = i - ((1 << d) - 1);
      return {
        x: pad + (w - pad * 2) * ((p + 0.5) / (1 << d)),
        y: treeTop + (d + 0.5) * levelH,
      };
    }

    // shared highlight rules so tree nodes and array cells match
    function styleOf(i) {
      var s = { fill: c.card, stroke: c.line, lw: 1, txt: c.text };
      if (f.done || i >= f.doneFrom) { s.fill = withAlpha(c.good, 0.1); s.stroke = withAlpha(c.good, 0.55); }
      if (kids.indexOf(i) >= 0) { s.fill = withAlpha(c.warn, 0.18); s.stroke = c.warn; s.lw = 2; }
      if (i === f.pick) { s.fill = withAlpha(c.warn, 0.3); s.lw = 2.5; }
      if (i === f.cur) {
        s.fill = withAlpha(f.ok ? c.good : c.accent, 0.24);
        s.stroke = f.ok ? c.good : c.accent;
        s.lw = 2;
      }
      if (f.swap && (i === f.swap[0] || i === f.swap[1])) {
        s.fill = withAlpha(c.accent, 0.26); s.stroke = c.accent; s.lw = 2;
      }
      return s;
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // hints
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillStyle = c.muted;
    ctx.textAlign = "left";
    ctx.fillText("min-heap: parent <= children", pad, pad);
    ctx.textAlign = "right";
    ctx.fillText("children of i: 2i+1, 2i+2", w - pad, pad);
    ctx.textAlign = "center";

    // ----- tree edges -----
    for (var i = 1; i < n; i++) {
      var par = (i - 1) >> 1;
      var pp = pos(par), pc = pos(i);
      var isSwapEdge = f.swap &&
        ((par === f.swap[0] && i === f.swap[1]) || (par === f.swap[1] && i === f.swap[0]));
      var isCmpEdge = par === f.cur && kids.indexOf(i) >= 0;
      ctx.beginPath();
      ctx.moveTo(pp.x, pp.y);
      ctx.lineTo(pc.x, pc.y);
      ctx.strokeStyle = isSwapEdge ? c.accent : isCmpEdge ? c.warn : c.line;
      ctx.lineWidth = isSwapEdge || isCmpEdge ? 2 : 1;
      ctx.stroke();
    }

    // dashed ring around the root of the current sift pass
    if (f.sift >= 0) {
      var ps = pos(f.sift);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.arc(ps.x, ps.y, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(c.accent, 0.6);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ----- tree nodes (value centered, index tucked at the bottom) -----
    for (i = 0; i < n; i++) {
      var p = pos(i), s = styleOf(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = s.fill; ctx.fill();
      ctx.strokeStyle = s.stroke; ctx.lineWidth = s.lw; ctx.stroke();
      ctx.fillStyle = s.txt;
      ctx.font = "600 " + Math.max(10, Math.round(r * 0.72)) + "px -apple-system, system-ui, sans-serif";
      ctx.fillText(String(a[i]), p.x, p.y - r * 0.14);
      ctx.fillStyle = c.muted;
      ctx.font = Math.max(8, Math.round(r * 0.42)) + "px ui-monospace, monospace";
      ctx.fillText(String(i), p.x, p.y + r * 0.5);
    }

    // double-headed arrow over a swap
    if (f.swap) {
      var pa = pos(f.swap[0]), pb = pos(f.swap[1]);
      var dx = pb.x - pa.x, dy = pb.y - pa.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len;
      var x1 = pa.x + ux * (r + 3), y1 = pa.y + uy * (r + 3);
      var x2 = pb.x - ux * (r + 3), y2 = pb.y - uy * (r + 3);
      ctx.strokeStyle = c.accent;
      ctx.fillStyle = c.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      head(ctx, x1, y1, ux, uy);
      head(ctx, x2, y2, -ux, -uy);
    }

    // ----- array row -----
    for (i = 0; i < n; i++) {
      var x = ax0 + i * cw;
      var st = styleOf(i);
      rr(ctx, x + 2, arrY, cw - 4, ch, 6);
      ctx.fillStyle = st.fill; ctx.fill();
      ctx.strokeStyle = st.stroke; ctx.lineWidth = st.lw; ctx.stroke();
      ctx.fillStyle = st.txt;
      ctx.font = "600 " + Math.max(10, Math.round(ch * 0.42)) + "px -apple-system, system-ui, sans-serif";
      ctx.fillText(String(a[i]), x + cw / 2, arrY + ch / 2 + 1);
      ctx.fillStyle = c.muted;
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillText(String(i), x + cw / 2, arrY + ch + 8);
    }

    // pointer labels above the array cells
    function ptr(i, label, col) {
      if (i == null || i < 0 || i >= n) return;
      var px = ax0 + i * cw + cw / 2;
      ctx.fillStyle = col;
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.fillText(label, px, arrY - 15);
      ctx.beginPath();
      ctx.moveTo(px, arrY - 3);
      ctx.lineTo(px - 4, arrY - 8);
      ctx.lineTo(px + 4, arrY - 8);
      ctx.closePath();
      ctx.fill();
    }
    if (f.swap) {
      ptr(f.swap[0], "swap", c.accent);
      ptr(f.swap[1], "swap", c.accent);
    } else if (f.cur >= 0) {
      ptr(f.cur, "i", f.ok ? c.good : c.accent);
      if (kids.length > 0) ptr(kids[0], "l", c.warn);
      if (kids.length > 1) ptr(kids[1], "r", c.warn);
    }
  }

  function head(ctx, x, y, ux, uy) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ux * 8 - uy * 4, y + uy * 8 + ux * 4);
    ctx.lineTo(x + ux * 8 + uy * 4, y + uy * 8 - ux * 4);
    ctx.closePath();
    ctx.fill();
  }
  function withAlpha(hex, a) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex.trim());
    if (!m) return hex;
    return "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + "," + a + ")";
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function init() {
    var el = document.getElementById("algviz-heap");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Build a min-heap (heapify)",
      aspect: 16 / 8,
      cases: [
        { name: "arr = [5, 3, 8, 1, 9, 2]", input: { arr: [5, 3, 8, 1, 9, 2] } },
        { name: "arr = [9, 7, 5, 3, 1] — reverse sorted", input: { arr: [9, 7, 5, 3, 1] } },
        { name: "arr = [4, 10, 3, 5, 1]", input: { arr: [4, 10, 3, 5, 1] } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
