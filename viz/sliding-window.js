/* Sliding window visualizer — longest substring without repeating characters.
   Mirrors the shape of viz/binary-search.js (the AlgViz reference). */
(function () {
  "use strict";

  function chars(s, a, b) {
    return b < a ? [] : s.slice(a, b + 1).split("");
  }

  function build(input) {
    var s = input.s;
    var frames = [];
    var l = 0, best = 0, bestL = 0, bestR = -1;
    var win = {}; // char -> index where it sits in the window

    function frame(o) {
      frames.push({
        s: s,
        l: o.l, r: o.r, hi: o.hi, dup: o.dup, removed: o.removed,
        set: chars(s, o.l, o.r),
        best: best, bestL: bestL, bestR: bestR,
        done: !!o.done,
        note: o.note,
      });
    }

    frame({ l: 0, r: -1, hi: -1, dup: -1, removed: -1,
      note: 'Scan s = "' + s + '". Start with an empty window and l = 0; expand r one character at a time.' });

    for (var r = 0; r < s.length; r++) {
      var c = s.charAt(r);
      if (win[c] !== undefined) {
        var dupAt = win[c];
        frame({ l: l, r: r - 1, hi: r, dup: dupAt, removed: -1,
          note: 'r moves to ' + r + ': "' + c + '" is already in the window (at index ' + dupAt + '), so shrink from the left.' });
        while (win[c] !== undefined) {
          var out = s.charAt(l);
          delete win[out];
          l++;
          var cleared = win[c] === undefined;
          frame({ l: l, r: r - 1, hi: r, dup: cleared ? -1 : dupAt, removed: l - 1,
            note: 'Evict "' + out + '" (index ' + (l - 1) + '); l moves to ' + l + '. ' +
              (cleared ? 'The duplicate "' + c + '" is gone.' : '"' + c + '" is still inside — keep shrinking.') });
        }
      }
      win[c] = r;
      var len = r - l + 1;
      var improved = len > best;
      if (improved) { best = len; bestL = l; bestR = r; }
      frame({ l: l, r: r, hi: r, dup: -1, removed: -1,
        note: 'Take "' + c + '" at index ' + r + ': window is "' + s.slice(l, r + 1) + '", length ' + len +
          (improved ? ' — new best.' : '; best stays ' + best + '.') });
    }

    frame({ l: l, r: s.length - 1, hi: -1, dup: -1, removed: -1, done: true,
      note: 'Done. The longest substring without repeating characters is "' + s.slice(bestL, bestR + 1) + '", length ' + best + '.' });
    return frames;
  }

  function draw(ctx, f, view) {
    if (!f || !f.s) return;
    var s = f.s, n = s.length, w = view.w, h = view.h, c = view.colors;
    var pad = 24;
    var cw = Math.min(64, (w - pad * 2) / n);
    var total = cw * n;
    var x0 = (w - total) / 2;
    var cy = h * 0.4;
    var ch = Math.min(56, cw * 0.95, h * 0.3);
    var boxTop = cy - ch / 2, boxBot = cy + ch / 2;

    // soft band behind the whole current window
    if (f.r >= f.l) {
      rr(ctx, x0 + f.l * cw + 1, boxTop - 5, (f.r - f.l + 1) * cw - 2, ch + 10, 9);
      ctx.fillStyle = withAlpha(c.accent, 0.1);
      ctx.fill();
    }

    // the string as boxes
    var mainFont = "600 " + Math.round(Math.max(11, ch * 0.42)) + "px ui-monospace, monospace";
    var idxFont = Math.round(Math.max(9, ch * 0.24)) + "px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var i = 0; i < n; i++) {
      var x = x0 + i * cw;
      var inWin = f.l <= i && i <= f.r;
      var fill = c.bg, stroke = c.line, txt = c.muted, lw = 1, alpha = 0.45;
      if (inWin) { fill = withAlpha(c.accent, 0.18); stroke = withAlpha(c.accent, 0.7); txt = c.text; alpha = 1; }
      if (i === f.dup) { fill = withAlpha(c.bad, 0.22); stroke = c.bad; txt = c.text; lw = 2; alpha = 1; }
      if (i === f.removed) { fill = withAlpha(c.bad, 0.12); stroke = c.bad; txt = c.muted; lw = 2; alpha = 0.8; }
      if (i === f.hi && !inWin && f.removed !== i) { fill = withAlpha(c.warn, 0.22); stroke = c.warn; txt = c.text; lw = 2; alpha = 1; }
      if (i === f.hi && inWin && f.dup < 0) { stroke = c.accent; lw = 2; }
      if (f.done && f.bestL <= i && i <= f.bestR) { fill = withAlpha(c.good, 0.25); stroke = c.good; txt = c.text; lw = 2; alpha = 1; }
      rr(ctx, x + 3, boxTop, cw - 6, ch, 8);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = txt;
      ctx.font = mainFont;
      ctx.fillText(s.charAt(i), x + cw / 2, cy + 1);
      ctx.globalAlpha = 1;
      // index labels
      ctx.fillStyle = c.muted;
      ctx.font = idxFont;
      ctx.fillText(String(i), x + cw / 2, boxBot + 12);
    }

    // l / r pointers above the boxes
    ctx.font = "700 12px ui-monospace, monospace";
    function ptr(i, label, col) {
      if (i < 0 || i >= n) return;
      var px = x0 + i * cw + cw / 2;
      ctx.fillStyle = col;
      ctx.fillText(label, px, boxTop - 20);
      ctx.beginPath();
      ctx.moveTo(px, boxTop - 7);
      ctx.lineTo(px - 4, boxTop - 13);
      ctx.lineTo(px + 4, boxTop - 13);
      ctx.closePath();
      ctx.fill();
    }
    if (!f.done) {
      var rIdx = f.hi >= 0 ? f.hi : f.r;
      if (rIdx === f.l) {
        ptr(f.l, "l r", c.accent);
      } else {
        ptr(f.l, "l", c.good);
        ptr(rIdx, "r", c.accent);
      }
    }

    // bracket under the best-so-far range
    if (f.bestR >= 0) {
      var bx1 = x0 + f.bestL * cw + 4;
      var bx2 = x0 + (f.bestR + 1) * cw - 4;
      var by = boxBot + 24;
      ctx.strokeStyle = c.good;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx1, by - 5);
      ctx.lineTo(bx1, by);
      ctx.lineTo(bx2, by);
      ctx.lineTo(bx2, by - 5);
      ctx.stroke();
      ctx.fillStyle = c.good;
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.fillText("best", (bx1 + bx2) / 2, by + 9);
    }

    // bottom row: chars currently in the window, plus the best length
    var chipH = Math.min(22, Math.max(16, h * 0.12));
    var chipY = h - chipH - 8;
    ctx.font = "600 12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = c.muted;
    var lbl = "in window:";
    ctx.fillText(lbl, x0, chipY + chipH / 2 + 1);
    var cx = x0 + ctx.measureText(lbl).width + 8;
    if (!f.set || !f.set.length) {
      ctx.fillText("(empty)", cx, chipY + chipH / 2 + 1);
    } else {
      for (var k = 0; k < f.set.length; k++) {
        var chStr = f.set[k];
        var cwd = Math.max(chipH, Math.ceil(ctx.measureText(chStr).width) + 12);
        rr(ctx, cx, chipY, cwd, chipH, 6);
        ctx.fillStyle = c.card;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = c.line;
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = c.text;
        ctx.fillText(chStr, cx + cwd / 2, chipY + chipH / 2 + 1);
        ctx.textAlign = "left";
        cx += cwd + 6;
      }
    }
    ctx.textAlign = "right";
    ctx.fillStyle = f.best > 0 ? c.good : c.muted;
    ctx.fillText("best = " + f.best, x0 + total, chipY + chipH / 2 + 1);
    ctx.textAlign = "left";
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
    var el = document.getElementById("algviz-sliding-window");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Longest substring without repeating characters",
      aspect: 16 / 7,
      cases: [
        { name: 's = "abcabcbb" — best 3', input: { s: "abcabcbb" } },
        { name: 's = "pwwkew" — best 3', input: { s: "pwwkew" } },
        { name: 's = "bbbbb" — best 1', input: { s: "bbbbb" } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
