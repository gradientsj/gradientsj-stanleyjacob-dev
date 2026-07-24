/* Jump Game (greedy reachability) visualizer. Mirrors the shape of the
   binary-search reference implementation of the AlgViz contract. */
(function () {
  "use strict";
  function build(input) {
    var nums = input.nums;
    var n = nums.length;
    var last = n - 1;
    var frames = [];
    var far = 0;
    frames.push({ nums: nums, i: -1, far: 0, cand: -1,
      note: "Each value is the maximum jump length from that index. Start with farthest = 0, so only index 0 is reachable. Goal: reach index " + last + "." });
    for (var i = 0; i < n; i++) {
      if (i > far) {
        frames.push({ nums: nums, i: i, far: far, cand: -1, stuck: true, done: true,
          note: "Index " + i + " is beyond the farthest reach (" + far + "). Every earlier index tops out at " + far + ", so we are stuck - the last index is unreachable. Answer: false." });
        return frames;
      }
      frames.push({ nums: nums, i: i, far: far, cand: -1,
        note: "Scan index " + i + ": it is within the farthest reach (" + i + " <= " + far + "), so we can actually stand here. Its value is " + nums[i] + "." });
      var cand = i + nums[i];
      frames.push({ nums: nums, i: i, far: far, cand: cand,
        note: nums[i] === 0
          ? "nums[" + i + "] = 0, so no jump is possible from here. The best reach from this index is " + cand + " - itself."
          : "From index " + i + " we can jump up to " + nums[i] + " step" + (nums[i] === 1 ? "" : "s") + ", reaching index " + cand + " at best." });
      if (cand > far) {
        var old = far;
        far = cand;
        frames.push({ nums: nums, i: i, far: far, cand: cand, improved: true,
          note: "New record: farthest = max(" + old + ", " + i + " + " + nums[i] + ") = " + far + ". The reach bar extends." });
      } else if (far < last) {
        frames.push({ nums: nums, i: i, far: far, cand: cand,
          note: "i + nums[i] = " + cand + " does not beat farthest = " + far + ". No improvement - keep scanning." });
      }
      if (far >= last) {
        frames.push({ nums: nums, i: i, far: far, cand: cand, reached: true, done: true,
          note: n === 1
            ? "The array has a single element, so we already stand on the last index. Trivially reachable. Answer: true."
            : "farthest = " + far + " now covers the last index (" + last + "), so the goal is reachable. Answer: true." });
        return frames;
      }
    }
    frames.push({ nums: nums, i: last, far: far, cand: -1, done: true, reached: far >= last,
      note: "Scan complete. farthest = " + far + (far >= last ? " reaches the last index. Answer: true." : " never reached the last index. Answer: false.") });
    return frames;
  }

  function draw(ctx, f, view) {
    var nums = f.nums, n = nums.length, w = view.w, h = view.h, c = view.colors;
    var last = n - 1;
    var pad = 24;
    var cw = Math.min(64, (w - pad * 2) / n);
    var total = cw * n;
    var x0 = (w - total) / 2;
    var cy = h * 0.48;
    var ch = Math.min(58, cw * 0.95, h * 0.3);
    var cellTop = cy - ch / 2;
    var cellBot = cy + ch / 2;

    // status line, top-left
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "600 11px ui-monospace, monospace";
    var status = "i = " + (f.i < 0 ? "-" : f.i) + "   farthest = " + f.far + "   goal = " + last;
    ctx.fillStyle = c.muted;
    ctx.fillText(status, 14, 15);
    if (f.done) {
      var bw = ctx.measureText(status).width;
      ctx.fillStyle = f.stuck ? c.bad : c.good;
      ctx.fillText(f.stuck ? "   -> reachable: false" : "   -> reachable: true", 14 + bw, 15);
    }

    // cells
    ctx.textAlign = "center";
    for (var i = 0; i < n; i++) {
      var x = x0 + i * cw;
      var reachable = i <= f.far;
      var fill = reachable ? c.card : c.bg;
      var stroke = c.line;
      var txt = reachable ? c.text : c.muted;
      if (i === f.i && !f.stuck) { fill = withAlpha(c.accent, 0.22); stroke = c.accent; txt = c.text; }
      if (f.stuck && i === f.i) { fill = withAlpha(c.bad, 0.25); stroke = c.bad; txt = c.text; }
      if (f.reached && i === last) { fill = withAlpha(c.good, 0.28); stroke = c.good; txt = c.text; }
      rr(ctx, x + 3, cellTop, cw - 6, ch, 8);
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = (i === f.i || (f.reached && i === last)) ? 2 : 1;
      ctx.strokeStyle = stroke; ctx.stroke();
      ctx.globalAlpha = reachable || i === f.i ? 1 : 0.45;
      ctx.fillStyle = txt;
      ctx.font = "600 " + Math.round(ch * 0.34) + "px -apple-system, system-ui, sans-serif";
      ctx.fillText(String(nums[i]), x + cw / 2, cy + 1);
      ctx.globalAlpha = 1;
      // index labels
      ctx.fillStyle = i === last ? c.warn : c.muted;
      ctx.font = Math.max(9, Math.round(ch * 0.24)) + "px ui-monospace, monospace";
      ctx.fillText(String(i), x + cw / 2, cellBot + Math.max(9, h * 0.055));
    }

    // goal flag above the last cell
    var gx = x0 + last * cw + cw / 2 + Math.min(10, cw * 0.22);
    var poleTop = Math.max(cellTop - 16, 24);
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx, cellTop - 2);
    ctx.lineTo(gx, poleTop);
    ctx.stroke();
    ctx.fillStyle = c.warn;
    ctx.beginPath();
    ctx.moveTo(gx, poleTop);
    ctx.lineTo(gx + 7, poleTop + 3.5);
    ctx.lineTo(gx, poleTop + 7);
    ctx.closePath();
    ctx.fill();

    // candidate jump arc from i to i + nums[i]
    if (f.cand >= 0 && f.i >= 0) {
      var candDraw = Math.min(f.cand, last);
      var xa = x0 + f.i * cw + cw / 2;
      var xb = x0 + candDraw * cw + cw / 2;
      var yTop = cellTop - 6;
      ctx.strokeStyle = c.accent;
      ctx.fillStyle = c.accent;
      ctx.font = "600 11px ui-monospace, monospace";
      if (candDraw <= f.i) {
        // zero-length jump: a small dot above the cell
        ctx.beginPath();
        ctx.arc(xa, yTop - 6, 3, 0, Math.PI * 2);
        ctx.fill();
        if (yTop - 18 > 8) ctx.fillText("+0", xa, yTop - 18);
      } else {
        var dist = candDraw - f.i;
        var arcH = Math.min(Math.max(6, yTop - 28), 14 + dist * 6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xa, yTop);
        ctx.quadraticCurveTo((xa + xb) / 2, yTop - 2 * arcH, xb, yTop);
        ctx.stroke();
        // arrowhead pointing down at the landing cell
        ctx.beginPath();
        ctx.moveTo(xb, yTop + 2);
        ctx.lineTo(xb - 4, yTop - 6);
        ctx.lineTo(xb + 4, yTop - 6);
        ctx.closePath();
        ctx.fill();
        var apexY = yTop - arcH;
        if (apexY - 9 > 8) ctx.fillText("+" + nums[f.i], (xa + xb) / 2, apexY - 9);
      }
    }

    // "i" pointer below-the-cell is redundant; show it above when no arc is drawn
    if (f.i >= 0 && f.cand < 0) {
      var px = x0 + f.i * cw + cw / 2;
      var col = f.stuck ? c.bad : c.accent;
      ctx.fillStyle = col;
      ctx.font = "600 12px ui-monospace, monospace";
      ctx.fillText("i", px, cellTop - 14);
      ctx.beginPath();
      ctx.moveTo(px, cellTop - 4);
      ctx.lineTo(px - 4, cellTop - 9);
      ctx.lineTo(px + 4, cellTop - 9);
      ctx.closePath();
      ctx.fill();
    }

    // farthest-reach bar under the index labels
    var idxY = cellBot + Math.max(9, h * 0.055);
    var barY = idxY + Math.max(10, h * 0.06);
    var trackL = x0 + 3;
    var trackR = x0 + total - 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = withAlpha(c.line, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trackL, barY);
    ctx.lineTo(trackR, barY);
    ctx.stroke();
    var barFar = Math.min(f.far, last);
    var barEnd = x0 + barFar * cw + cw - 3;
    ctx.strokeStyle = c.good;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(trackL, barY);
    ctx.lineTo(barEnd, barY);
    ctx.stroke();
    ctx.fillStyle = c.good;
    ctx.beginPath();
    ctx.arc(barEnd, barY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // gap segment when stuck: the scan pointer sits past the bar
    if (f.stuck && f.i >= 0) {
      var sx = x0 + f.i * cw + cw / 2;
      ctx.strokeStyle = c.bad;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(barEnd + 5, barY);
      ctx.lineTo(sx, barY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.lineCap = "butt";
    // label the bar, clamped inside the canvas
    ctx.font = "600 11px ui-monospace, monospace";
    var lab = "farthest = " + f.far;
    var lw2 = ctx.measureText(lab).width / 2;
    var lx = Math.max(lw2 + 6, Math.min(w - lw2 - 6, barEnd));
    ctx.fillStyle = c.good;
    ctx.fillText(lab, lx, barY + Math.max(9, h * 0.05));
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
    var el = document.getElementById("algviz-greedy");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Jump Game (greedy reachability)",
      aspect: 16 / 6,
      cases: [
        { name: "nums = [2,3,1,1,4] — reachable", input: { nums: [2, 3, 1, 1, 4] } },
        { name: "nums = [3,2,1,0,4] — stuck at index 3", input: { nums: [3, 2, 1, 0, 4] } },
        { name: "nums = [0] — trivially reachable", input: { nums: [0] } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
