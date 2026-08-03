/* Unique Paths (2D grid DP) visualizer. Mirrors the shape of the reference
   implementation in viz/binary-search.js. Fills an m x n table row-major with
   dp[i][j] = dp[i-1][j] + dp[i][j-1], highlighting the two contributor cells
   for every interior cell. */
(function () {
  "use strict";

  function build(input) {
    var m = input.m, n = input.n;
    var dp = [], i, j;
    for (i = 0; i < m; i++) {
      var row = [];
      for (j = 0; j < n; j++) row.push(null);
      dp.push(row);
    }
    function snap() {
      var out = [];
      for (var r = 0; r < m; r++) out.push(dp[r].slice());
      return out;
    }
    var frames = [];
    frames.push({ m: m, n: n, grid: snap(), cur: null, from: null, phase: "intro",
      note: "Count the paths from the top-left to the bottom-right of a " + m + "×" + n +
        " grid, moving only right or down. dp[i][j] will hold the number of unique paths that reach cell (i, j)." });
    frames.push({ m: m, n: n, grid: snap(), cur: null, from: null, phase: "rule",
      note: "Every cell can only be entered from above or from the left, so dp[i][j] = dp[i-1][j] + dp[i][j-1]. " +
        "We fill the table cell by cell, row by row." });
    for (i = 0; i < m; i++) {
      for (j = 0; j < n; j++) {
        if (i === 0 || j === 0) {
          dp[i][j] = 1;
          var why;
          if (i === 0 && j === 0) why = "the start cell — there is exactly one way to be here (do nothing).";
          else if (i === 0) why = "top row — the only way in is walking straight right from the start.";
          else why = "left column — the only way in is walking straight down from the start.";
          frames.push({ m: m, n: n, grid: snap(), cur: [i, j], from: null, phase: "base",
            note: "dp[" + i + "][" + j + "] = 1: " + why });
        } else {
          var a = dp[i - 1][j], b = dp[i][j - 1];
          frames.push({ m: m, n: n, grid: snap(), cur: [i, j], from: [[i - 1, j], [i, j - 1]], phase: "peek", a: a, b: b,
            note: "Cell (" + i + ", " + j + ") is entered from above or from the left: dp[" + (i - 1) + "][" + j +
              "] = " + a + " and dp[" + i + "][" + (j - 1) + "] = " + b + "." });
          dp[i][j] = a + b;
          frames.push({ m: m, n: n, grid: snap(), cur: [i, j], from: [[i - 1, j], [i, j - 1]], phase: "fill", a: a, b: b,
            note: "dp[" + i + "][" + j + "] = " + a + " + " + b + " = " + (a + b) + "." });
        }
      }
    }
    frames.push({ m: m, n: n, grid: snap(), cur: [m - 1, n - 1], from: null, phase: "done",
      note: "Done. dp[" + (m - 1) + "][" + (n - 1) + "] = " + dp[m - 1][n - 1] + ", so there are " +
        dp[m - 1][n - 1] + " unique paths through the " + m + "×" + n + " grid." });
    return frames;
  }

  function draw(ctx, f, view) {
    var m = f.m, n = f.n, w = view.w, h = view.h, c = view.colors;
    var pad = 14, topG = 24, botG = 30, leftG = 26;
    var gw = w - pad * 2 - leftG;
    var gh = h - pad * 2 - topG - botG;
    var cell = Math.min(gw / n, gh / m, 76);
    var gridW = cell * n, gridH = cell * m;
    var x0 = (w - gridW) / 2;
    var y0 = (h - (topG + gridH + botG)) / 2 + topG;
    var i, j;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // hint about the allowed moves, top-left corner
    ctx.font = "600 " + Math.max(9, Math.min(12, Math.round(w * 0.02))) + "px ui-monospace, monospace";
    ctx.fillStyle = c.muted;
    ctx.textAlign = "left";
    ctx.fillText("moves: right → or down ↓", pad, pad + 4);
    ctx.textAlign = "center";

    // index labels
    var idxFont = Math.max(8, Math.min(12, Math.round(cell * 0.26)));
    ctx.font = idxFont + "px ui-monospace, monospace";
    ctx.fillStyle = c.muted;
    for (j = 0; j < n; j++) ctx.fillText(String(j), x0 + j * cell + cell / 2, y0 - 10);
    for (i = 0; i < m; i++) ctx.fillText(String(i), x0 - 12, y0 + i * cell + cell / 2);

    // cells
    var valFont = "600 " + Math.round(cell * 0.36) + "px -apple-system, system-ui, sans-serif";
    for (i = 0; i < m; i++) {
      for (j = 0; j < n; j++) {
        var x = x0 + j * cell, y = y0 + i * cell;
        var v = f.grid[i][j];
        var isCur = !!(f.cur && f.cur[0] === i && f.cur[1] === j);
        var isFrom = false;
        if (f.from) {
          for (var k = 0; k < f.from.length; k++) {
            if (f.from[k][0] === i && f.from[k][1] === j) isFrom = true;
          }
        }
        var fill = v == null ? c.bg : c.card;
        var stroke = c.line, txt = c.text, lw = 1;
        if (isFrom) { fill = withAlpha(c.warn, 0.2); stroke = c.warn; lw = 2; }
        if (isCur) {
          if (f.phase === "done") { fill = withAlpha(c.good, 0.28); stroke = c.good; }
          else { fill = withAlpha(c.accent, 0.22); stroke = c.accent; }
          lw = 2;
        }
        rr(ctx, x + 3, y + 3, cell - 6, cell - 6, Math.max(4, cell * 0.12));
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = lw;
        ctx.strokeStyle = stroke;
        ctx.stroke();
        ctx.font = valFont;
        if (v != null) {
          ctx.fillStyle = txt;
          ctx.fillText(String(v), x + cell / 2, y + cell / 2 + 1);
        } else if (isCur && f.phase === "peek") {
          ctx.fillStyle = c.accent;
          ctx.fillText("?", x + cell / 2, y + cell / 2 + 1);
        }
      }
    }

    // arrows from the two contributor cells into the current cell
    if (f.cur && f.from) {
      var ci = f.cur[0], cj = f.cur[1];
      var cx = x0 + cj * cell + cell / 2;
      var cy = y0 + ci * cell + cell / 2;
      arrow(ctx, cx, y0 + ci * cell - cell * 0.2, cx, y0 + ci * cell + cell * 0.28, c.warn);
      arrow(ctx, x0 + cj * cell - cell * 0.2, cy, x0 + cj * cell + cell * 0.28, cy, c.warn);
    }

    // formula strip under the grid
    var fx = w / 2, fy = y0 + gridH + 16;
    ctx.font = "600 " + Math.max(10, Math.min(13, Math.round(w * 0.024))) + "px ui-monospace, monospace";
    if (f.phase === "intro") {
      ctx.fillStyle = c.muted;
      ctx.fillText("dp[i][j] = number of unique paths that reach cell (i, j)", fx, fy);
    } else if (f.phase === "rule") {
      ctx.fillStyle = c.text;
      ctx.fillText("dp[i][j] = dp[i-1][j] + dp[i][j-1]", fx, fy);
    } else if (f.phase === "base") {
      ctx.fillStyle = c.text;
      ctx.fillText("dp[" + f.cur[0] + "][" + f.cur[1] + "] = 1  (base case)", fx, fy);
    } else if (f.phase === "peek" || f.phase === "fill") {
      ctx.fillStyle = c.text;
      ctx.fillText("dp[" + f.cur[0] + "][" + f.cur[1] + "] = dp[" + (f.cur[0] - 1) + "][" + f.cur[1] +
        "] + dp[" + f.cur[0] + "][" + (f.cur[1] - 1) + "] = " + f.a + " + " + f.b +
        " = " + (f.phase === "peek" ? "?" : f.a + f.b), fx, fy);
    } else if (f.phase === "done") {
      ctx.fillStyle = c.good;
      ctx.fillText("unique paths = dp[" + (m - 1) + "][" + (n - 1) + "] = " + f.grid[m - 1][n - 1], fx, fy);
    }
  }

  function arrow(ctx, x1, y1, x2, y2, col) {
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    var ang = Math.atan2(y2 - y1, x2 - x1), s = 6;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(ang - 0.5), y2 - s * Math.sin(ang - 0.5));
    ctx.lineTo(x2 - s * Math.cos(ang + 0.5), y2 - s * Math.sin(ang + 0.5));
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
    var el = document.getElementById("algviz-dp-2d");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Unique paths (2D grid DP)",
      aspect: 16 / 7,
      cases: [
        { name: "3×4 grid — 10 paths", input: { m: 3, n: 4 } },
        { name: "3×3 grid — 6 paths", input: { m: 3, n: 3 } },
        { name: "2×2 grid — 2 paths", input: { m: 2, n: 2 } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
