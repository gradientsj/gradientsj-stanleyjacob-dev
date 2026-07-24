/* Counting-bits visualizer (bit manipulation). Mirrors the AlgViz contract of
   viz/binary-search.js: for i = 0..n, dp[i] = dp[i >> 1] + (i & 1). Each row
   shows a number, its binary bit boxes, and its dp value; the contributor
   dp[i >> 1] and the low bit are highlighted as each entry is filled. */
(function () {
  "use strict";

  function bitLen(n) {
    var b = 1;
    while (n >> b > 0) b++;
    return b;
  }

  function build(input) {
    var n = input.n;
    var dp = new Array(n + 1);
    dp[0] = 0;
    for (var k = 1; k <= n; k++) dp[k] = dp[k >> 1] + (k & 1);
    var frames = [];
    frames.push({ n: n, dp: dp, filled: 0, cur: -1, from: -1,
      note: "Count the 1-bits of every number 0.." + n + ". dp[i] = dp[i >> 1] + (i & 1): shifting right drops the low bit, and that smaller number is already solved." });
    frames.push({ n: n, dp: dp, filled: 1, cur: 0, from: -1,
      note: "Base case: 0 has no bits set, so dp[0] = 0." });
    for (var i = 1; i <= n; i++) {
      frames.push({ n: n, dp: dp, filled: i + 1, cur: i, from: i >> 1,
        note: i + " = " + i.toString(2) + "₂ drops its low bit to give " + (i >> 1) + " = " + (i >> 1).toString(2) + "₂, already solved: dp[" + i + "] = dp[" + (i >> 1) + "] + " + (i & 1) + " = " + dp[i >> 1] + " + " + (i & 1) + " = " + dp[i] + "." });
    }
    frames.push({ n: n, dp: dp, filled: n + 1, cur: -1, from: -1, done: true,
      note: "Done: all " + (n + 1) + " answers built in O(n). Each entry cost one table lookup plus one AND — no per-number bit loop." });
    return frames;
  }

  function draw(ctx, f, view) {
    var w = view.w, h = view.h, c = view.colors;
    var n = f.n, count = n + 1, bits = bitLen(n);
    var pad = 14, headH = 42, labelH = 14, padB = 10;
    var cols = Math.ceil(count / 8);
    var rows = Math.ceil(count / cols);
    var colW = (w - pad * 2) / cols;
    var rowH = (h - headH - labelH - padB) / rows;
    // bit-box size s; every other width scales off it so the entry fits colW
    var s = Math.min(26, rowH - 8, (colW - 10) / (bits * 1.12 + 5));
    if (s < 7) s = 7;
    var gap = Math.max(2, s * 0.12);
    var idxW = s * 1.7, g1 = s * 0.5, g2 = s * 0.4, eqW = s * 0.8, dpW = s * 1.6;
    var bitsW = bits * (s + gap) - gap;
    var entryW = idxW + g1 + bitsW + g2 + eqW + dpW;
    var fontS = Math.max(8, Math.round(s * 0.5));
    var fontM = Math.max(9, Math.round(s * 0.58));

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // column mini-labels
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = c.muted;
    for (var ci = 0; ci < cols; ci++) {
      var lx = pad + ci * colW + (colW - entryW) / 2;
      var ly = headH + labelH / 2;
      ctx.textAlign = "right";
      ctx.fillText("i", lx + idxW, ly);
      ctx.textAlign = "center";
      ctx.fillText("binary", lx + idxW + g1 + bitsW / 2, ly);
      ctx.fillText("dp", lx + idxW + g1 + bitsW + g2 + eqW + dpW / 2, ly);
    }

    for (var i = 0; i < count; i++) {
      var col = Math.floor(i / rows), row = i % rows;
      var ex = pad + col * colW + (colW - entryW) / 2;
      var ey = headH + labelH + row * rowH + rowH / 2;
      var isCur = i === f.cur;
      var isFrom = f.cur > 0 && i === f.from;
      var filled = i < f.filled;

      // row background for the entry being written and its contributor
      if (isCur || isFrom) {
        rr(ctx, ex - 5, ey - (s + 8) / 2, entryW + 10, s + 8, 6);
        ctx.fillStyle = withAlpha(isCur ? c.accent : c.warn, isCur ? 0.12 : 0.14);
        ctx.fill();
        ctx.strokeStyle = isCur ? c.accent : c.warn;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.globalAlpha = filled ? 1 : 0.45;

      // decimal index
      ctx.font = "600 " + fontM + "px ui-monospace, monospace";
      ctx.fillStyle = isCur ? c.accent : isFrom ? c.warn : filled ? c.text : c.muted;
      ctx.textAlign = "right";
      ctx.fillText(String(i), ex + idxW, ey + 1);
      ctx.textAlign = "center";

      // binary bit boxes, most significant bit first
      var bx = ex + idxW + g1;
      for (var b = bits - 1; b >= 0; b--) {
        var bit = (i >> b) & 1;
        var x = bx + (bits - 1 - b) * (s + gap);
        rr(ctx, x, ey - s / 2, s, s, 3);
        if (bit) {
          ctx.fillStyle = withAlpha(c.accent, 0.2);
          ctx.fill();
        }
        var st = c.line, lw = 1;
        if (isCur && b === 0) { st = c.good; lw = 2; }       // the low bit, i & 1
        else if (isCur && b > 0) { st = c.warn; lw = 2; }    // the i >> 1 part
        ctx.strokeStyle = st;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.font = fontS + "px ui-monospace, monospace";
        ctx.fillStyle = bit ? c.text : c.muted;
        ctx.fillText(String(bit), x + s / 2, ey + 1);
      }

      // "=" and the dp value box
      var qx = bx + bitsW + g2;
      ctx.font = fontS + "px ui-monospace, monospace";
      ctx.fillStyle = c.muted;
      ctx.fillText("=", qx + eqW / 2, ey + 1);
      var dx = qx + eqW;
      rr(ctx, dx, ey - s / 2, dpW, s, 3);
      if (filled) {
        ctx.fillStyle = isCur ? withAlpha(c.accent, 0.22) : isFrom ? withAlpha(c.warn, 0.2) : c.card;
        ctx.fill();
        ctx.strokeStyle = isCur ? c.accent : isFrom ? c.warn : c.line;
        ctx.lineWidth = isCur || isFrom ? 2 : 1;
        ctx.stroke();
        ctx.font = "700 " + fontM + "px ui-monospace, monospace";
        ctx.fillStyle = c.text;
        ctx.fillText(String(f.dp[i]), dx + dpW / 2, ey + 1);
      } else {
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }

    // header: the recurrence, with concrete colored numbers during a step
    function segs(list) {
      ctx.font = "600 " + Math.max(12, Math.min(16, Math.round(w * 0.022))) + "px ui-monospace, monospace";
      var total = 0, j;
      for (j = 0; j < list.length; j++) total += ctx.measureText(list[j][0]).width;
      var x = (w - total) / 2;
      ctx.textAlign = "left";
      for (j = 0; j < list.length; j++) {
        ctx.fillStyle = list[j][1];
        ctx.fillText(list[j][0], x, headH / 2 + 2);
        x += ctx.measureText(list[j][0]).width;
      }
      ctx.textAlign = "center";
    }
    if (f.cur > 0) {
      segs([
        ["dp[" + f.cur + "]", c.accent], [" = ", c.muted],
        ["dp[" + f.from + "]", c.warn], [" + ", c.muted],
        [String(f.cur & 1), c.good], [" = ", c.muted],
        [String(f.dp[f.cur]), c.text],
      ]);
    } else if (f.cur === 0) {
      segs([["dp[0]", c.accent], [" = ", c.muted], ["0", c.text]]);
    } else {
      segs([["dp[i] = dp[i >> 1] + (i & 1)", f.done ? c.good : c.text]]);
    }
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
    var el = document.getElementById("algviz-bit-manipulation");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Counting bits",
      aspect: 16 / 9,
      cases: [
        { name: "n = 15 — full 4-bit table", input: { n: 15 } },
        { name: "n = 8 — power of two", input: { n: 8 } },
        { name: "n = 20 — 5-bit numbers", input: { n: 20 } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
