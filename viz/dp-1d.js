/* House Robber (1D DP) visualizer. Mirrors the binary-search reference
   implementation of the AlgViz contract: build() emits frames, draw() renders
   one frame in CSS pixels, caption() reads the frame's note. */
(function () {
  "use strict";

  function build(input) {
    var nums = input.nums;
    var n = nums.length;
    var frames = [];
    var dp = new Array(n);
    for (var z = 0; z < n; z++) dp[z] = null;

    function snap(extra) {
      var f = {
        nums: nums, dp: dp.slice(), i: -1, phase: "intro",
        skip: null, rob: null, win: null, robbed: null, traceI: -1, note: "",
      };
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) f[k] = extra[k];
      return f;
    }

    frames.push(snap({
      note: "Each house holds cash: [" + nums.join(", ") + "]. Rob any set of non-adjacent houses; dp[i] will record the best loot using houses 0..i.",
    }));

    // base case i = 0
    frames.push(snap({
      i: 0, phase: "consider", skip: 0, rob: nums[0], win: "rob",
      note: "House 0 ($" + nums[0] + ") has no earlier house to worry about: the choice is $" + nums[0] + " or nothing.",
    }));
    dp[0] = nums[0];
    frames.push(snap({
      i: 0, phase: "commit", skip: 0, rob: nums[0], win: "rob",
      note: "Base case: dp[0] = nums[0] = " + nums[0] + ".",
    }));

    for (var i = 1; i < n; i++) {
      var skip = dp[i - 1];
      var rob = (i >= 2 ? dp[i - 2] : 0) + nums[i];
      var win = rob > skip ? "rob" : "skip";
      frames.push(snap({
        i: i, phase: "consider", skip: skip, rob: rob, win: win,
        note: i >= 2
          ? "House " + i + " ($" + nums[i] + "): skip it and keep dp[" + (i - 1) + "] = " + skip + ", or rob it and add $" + nums[i] + " to dp[" + (i - 2) + "] = " + dp[i - 2] + " for " + rob + "."
          : "House 1 ($" + nums[1] + "): skip it and keep dp[0] = " + skip + ", or rob it — forfeiting house 0 — for $" + nums[1] + ".",
      }));
      dp[i] = Math.max(skip, rob);
      frames.push(snap({
        i: i, phase: "commit", skip: skip, rob: rob, win: win,
        note: win === "rob"
          ? "max(" + skip + ", " + rob + ") = " + rob + " — robbing wins. dp[" + i + "] = " + rob + "."
          : "max(" + skip + ", " + rob + ") = " + skip + " — skipping wins. dp[" + i + "] = " + skip + ".",
      }));
    }

    frames.push(snap({
      phase: "done",
      note: "The table is full. The answer is dp[" + (n - 1) + "] = " + dp[n - 1] + ". Now trace backwards to find which houses were robbed.",
    }));

    // trace back which houses produced the answer
    var robbed = [];
    function sorted() { return robbed.slice().sort(function (a, b) { return a - b; }); }
    var t = n - 1;
    while (t >= 0) {
      if (t === 0) {
        if (dp[0] > 0) {
          robbed.push(0);
          frames.push(snap({
            phase: "trace", traceI: 0, robbed: sorted(),
            note: "At i = 0, dp[0] = " + dp[0] + " came from robbing house 0.",
          }));
        } else {
          frames.push(snap({
            phase: "trace", traceI: 0, robbed: sorted(),
            note: "At i = 0 there is nothing worth taking; house 0 was skipped.",
          }));
        }
        t = -1;
      } else if (dp[t] !== dp[t - 1]) {
        robbed.push(t);
        frames.push(snap({
          phase: "trace", traceI: t, robbed: sorted(),
          note: "dp[" + t + "] = " + dp[t] + " differs from dp[" + (t - 1) + "] = " + dp[t - 1] + ", so house " + t + " was robbed. Jump over its neighbour to i = " + (t - 2) + ".",
        }));
        t -= 2;
      } else {
        frames.push(snap({
          phase: "trace", traceI: t, robbed: sorted(),
          note: "dp[" + t + "] = " + dp[t] + " equals dp[" + (t - 1) + "], so house " + t + " was skipped. Step to i = " + (t - 1) + ".",
        }));
        t -= 1;
      }
    }

    var list = sorted();
    frames.push(snap({
      phase: "final", robbed: list,
      note: "Maximum loot: " + dp[n - 1] + ", from robbing house" + (list.length === 1 ? " " : "s ") + list.join(", ") + ".",
    }));
    return frames;
  }

  function draw(ctx, f, view) {
    if (!f || !f.nums) return;
    var nums = f.nums, dp = f.dp, n = nums.length;
    var w = view.w, h = view.h, c = view.colors;
    var pad = 24;
    var cw = Math.min(72, (w - pad * 2) / n);
    var total = cw * n;
    var x0 = (w - total) / 2;
    var ch = Math.min(52, h * 0.2, cw * 0.9);
    var yH = h * 0.28, yD = h * 0.62, yC = h * 0.9;
    var roofH = ch * 0.38;
    var rad = Math.min(8, ch * 0.2);
    var i, x, xc;

    var robbedSet = {};
    if (f.robbed) for (i = 0; i < f.robbed.length; i++) robbedSet[f.robbed[i]] = true;
    var tracing = f.phase === "trace" || f.phase === "final";

    function cxOf(j) { return x0 + j * cw + cw / 2; }

    function cell(x, cy, fill, stroke, lw, dashed) {
      rr(ctx, x + 3, cy - ch / 2, cw - 6, ch, rad);
      ctx.fillStyle = fill;
      ctx.fill();
      if (dashed) ctx.setLineDash([4, 3]);
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    var valueFont = "600 " + Math.round(ch * 0.34) + "px -apple-system, system-ui, sans-serif";
    var idxFont = Math.round(ch * 0.24) + "px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // row labels
    if (x0 >= 58) {
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.fillStyle = c.muted;
      ctx.fillText("cash", x0 - 10, yH);
      ctx.fillText("dp", x0 - 10, yD);
      ctx.textAlign = "center";
    }

    // ---- houses row ----
    for (i = 0; i < n; i++) {
      x = x0 + i * cw;
      xc = x + cw / 2;
      var fill = c.card, stroke = c.line, lw = 1, alpha = 1;
      if (f.phase === "consider" && i === f.i) { stroke = c.accent; lw = 2; }
      if (f.phase === "commit" && i === f.i) {
        if (f.win === "rob") { fill = withAlpha(c.good, 0.22); stroke = c.good; lw = 2; }
        else alpha = 0.45;
      }
      if (tracing || f.phase === "done") {
        if (robbedSet[i]) { fill = withAlpha(c.good, 0.25); stroke = c.good; lw = 2; }
        else if (f.phase === "final") alpha = 0.45;
      }
      ctx.globalAlpha = alpha;
      // roof
      var top = yH - ch / 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, top - 1);
      ctx.lineTo(xc, top - roofH);
      ctx.lineTo(x + cw - 4, top - 1);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      // body
      cell(x, yH, fill, stroke, lw, false);
      ctx.font = valueFont;
      ctx.fillStyle = c.text;
      ctx.fillText("$" + nums[i], xc, yH + 1);
      ctx.globalAlpha = 1;
      // index label between the rows
      ctx.font = idxFont;
      ctx.fillStyle = c.muted;
      ctx.fillText(String(i), xc, yH + ch / 2 + 12);
    }

    // ---- dp row ----
    for (i = 0; i < n; i++) {
      x = x0 + i * cw;
      xc = x + cw / 2;
      var filled = dp[i] != null;
      var dFill = filled ? c.card : c.bg;
      var dStroke = c.line, dLw = 1, dDash = !filled;
      var txt = filled ? String(dp[i]) : "";
      var txtCol = c.text;
      if ((f.phase === "consider" || f.phase === "commit") && f.i >= 0) {
        if (i === f.i - 1 && (f.phase === "consider" || f.win === "skip")) { dStroke = c.warn; dLw = 2; }
        if (f.i >= 2 && i === f.i - 2 && (f.phase === "consider" || f.win === "rob")) { dStroke = c.accent; dLw = 2; }
        if (i === f.i && f.phase === "consider") {
          dFill = withAlpha(c.accent, 0.08); dStroke = c.accent; dLw = 2; dDash = true;
          txt = "?"; txtCol = c.accent;
        }
        if (i === f.i && f.phase === "commit") {
          dFill = withAlpha(c.good, 0.25); dStroke = c.good; dLw = 2; dDash = false;
        }
      }
      if ((f.phase === "done" || f.phase === "final") && i === n - 1) {
        dFill = withAlpha(c.good, 0.18); dStroke = c.good; dLw = 2;
      }
      if (f.phase === "trace" && i === f.traceI) { dStroke = c.accent; dLw = 2; }
      cell(x, yD, dFill, dStroke, dLw, dDash);
      if (txt) {
        ctx.font = valueFont;
        ctx.fillStyle = txtCol;
        ctx.fillText(txt, xc, yD + 1);
      }
    }

    // ---- choice arrows ----
    if ((f.phase === "consider" || f.phase === "commit") && f.i >= 1) {
      var iC = f.i;
      var yBot = yD + ch / 2;
      var skipWon = f.win === "skip";
      var dimLoser = f.phase === "commit";
      // skip: dp[i-1] slides forward into dp[i]
      ctx.globalAlpha = dimLoser && !skipWon ? 0.3 : 1;
      arrow(ctx, cxOf(iC - 1), yBot, cxOf(iC) - 6, yBot + 2,
        (cxOf(iC - 1) + cxOf(iC)) / 2, yBot + ch * 0.45, c.warn);
      // rob: house i drops down into dp[i] (plus dp[i-2] if it exists)
      ctx.globalAlpha = dimLoser && skipWon ? 0.3 : 1;
      var xa = cxOf(iC) + cw * 0.22;
      arrow(ctx, xa, yH + ch / 2 + 2, xa, yD - ch / 2 - 3,
        xa, (yH + yD) / 2, c.accent);
      if (iC >= 2) {
        arrow(ctx, cxOf(iC - 2), yBot, cxOf(iC) + 6, yBot + 2,
          (cxOf(iC - 2) + cxOf(iC)) / 2, yBot + ch * 0.9, c.accent);
      }
      ctx.globalAlpha = 1;
    }

    // ---- traceback pointer ----
    if (f.phase === "trace" && f.traceI >= 0) {
      var px = cxOf(f.traceI), py = yD + ch / 2 + 5;
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - 4, py + 6);
      ctx.lineTo(px + 4, py + 6);
      ctx.closePath();
      ctx.fill();
      ctx.font = "600 12px ui-monospace, monospace";
      ctx.fillText("i", px, py + 14);
    }

    // ---- bottom summary line ----
    var fs = Math.max(9, Math.min(13, Math.round(w / 48)));
    ctx.font = "600 " + fs + "px ui-monospace, monospace";
    if (f.phase === "intro") {
      ctx.fillStyle = c.muted;
      ctx.fillText("dp[i] = max(dp[i-1], dp[i-2] + nums[i])", w / 2, yC);
    } else if (f.phase === "consider" || f.phase === "commit") {
      var sSkip = f.i === 0 ? "take nothing: 0" : "skip: " + f.skip;
      var sRob = f.i >= 2
        ? "rob: " + dp[f.i - 2] + " + $" + nums[f.i] + " = " + f.rob
        : "rob: $" + nums[f.i];
      var sVs = "   vs   ";
      var wS = ctx.measureText(sSkip).width;
      var wV = ctx.measureText(sVs).width;
      var wR = ctx.measureText(sRob).width;
      var sx = (w - (wS + wV + wR)) / 2;
      ctx.textAlign = "left";
      if (f.phase === "commit") {
        var winX = f.win === "skip" ? sx : sx + wS + wV;
        var winW = f.win === "skip" ? wS : wR;
        rr(ctx, winX - 6, yC - fs * 0.95, winW + 12, fs * 1.9, 6);
        ctx.fillStyle = withAlpha(c.good, 0.18);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = c.good;
        ctx.stroke();
      }
      ctx.globalAlpha = f.phase === "commit" && f.win !== "skip" ? 0.55 : 1;
      ctx.fillStyle = c.warn;
      ctx.fillText(sSkip, sx, yC);
      ctx.globalAlpha = 1;
      ctx.fillStyle = c.muted;
      ctx.fillText(sVs, sx + wS, yC);
      ctx.globalAlpha = f.phase === "commit" && f.win !== "rob" ? 0.55 : 1;
      ctx.fillStyle = c.accent;
      ctx.fillText(sRob, sx + wS + wV, yC);
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
    } else if (f.phase === "done") {
      ctx.fillStyle = c.good;
      ctx.fillText("answer = dp[" + (n - 1) + "] = " + dp[n - 1], w / 2, yC);
    } else if (f.phase === "trace") {
      ctx.fillStyle = c.muted;
      ctx.fillText("robbed so far: " + (f.robbed && f.robbed.length ? f.robbed.join(", ") : "—"), w / 2, yC);
    } else if (f.phase === "final") {
      ctx.fillStyle = c.good;
      ctx.fillText("max loot = " + dp[n - 1] + "  ·  houses " + f.robbed.join(", "), w / 2, yC);
    }
  }

  function arrow(ctx, x1, y1, x2, y2, cx, cy, col) {
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
    var ang = Math.atan2(y2 - cy, x2 - cx);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 7 * Math.cos(ang - 0.5), y2 - 7 * Math.sin(ang - 0.5));
    ctx.lineTo(x2 - 7 * Math.cos(ang + 0.5), y2 - 7 * Math.sin(ang + 0.5));
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
    var el = document.getElementById("algviz-dp-1d");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "House Robber",
      aspect: 16 / 7,
      cases: [
        { name: "nums = [2, 7, 9, 3, 1] — loot 12", input: { nums: [2, 7, 9, 3, 1] } },
        { name: "nums = [2, 1, 1, 2] — rob both ends", input: { nums: [2, 1, 1, 2] } },
        { name: "nums = [5] — single house", input: { nums: [5] } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
