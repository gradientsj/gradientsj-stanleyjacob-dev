/* Binary search visualizer. Reference implementation of the AlgViz contract;
   the other topic visualizers mirror this shape. */
(function () {
  "use strict";
  function build(input) {
    var arr = input.arr, target = input.target;
    var frames = [];
    var lo = 0, hi = arr.length - 1;
    frames.push({ arr: arr, lo: lo, hi: hi, mid: -1, found: -1,
      note: "Search for " + target + " in a sorted array. Begin with lo = 0 and hi = " + hi + "." });
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      frames.push({ arr: arr, lo: lo, hi: hi, mid: mid, found: -1,
        note: "mid = (" + lo + " + " + hi + ") / 2 = " + mid + ", so nums[mid] = " + arr[mid] + "." });
      if (arr[mid] === target) {
        frames.push({ arr: arr, lo: lo, hi: hi, mid: mid, found: mid,
          note: "nums[" + mid + "] = " + arr[mid] + " equals the target. Found it at index " + mid + "." });
        return frames;
      } else if (arr[mid] < target) {
        lo = mid + 1;
        frames.push({ arr: arr, lo: lo, hi: hi, mid: mid, found: -1,
          note: "nums[mid] = " + arr[mid] + " is below " + target + ", so the whole left half is discarded and lo becomes " + lo + "." });
      } else {
        hi = mid - 1;
        frames.push({ arr: arr, lo: lo, hi: hi, mid: mid, found: -1,
          note: "nums[mid] = " + arr[mid] + " is above " + target + ", so the whole right half is discarded and hi becomes " + hi + "." });
      }
    }
    frames.push({ arr: arr, lo: lo, hi: hi, mid: -1, found: -1, done: true,
      note: "lo > hi, so the pointers have crossed. " + target + " is not in the array." });
    return frames;
  }

  function draw(ctx, f, view) {
    var arr = f.arr, n = arr.length, w = view.w, h = view.h, c = view.colors;
    var pad = 24;
    var cw = Math.min(64, (w - pad * 2) / n);
    var total = cw * n;
    var x0 = (w - total) / 2;
    var cy = h / 2;
    var ch = Math.min(58, cw * 0.95);
    ctx.font = "600 " + Math.round(ch * 0.34) + "px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var i = 0; i < n; i++) {
      var x = x0 + i * cw;
      var inRange = f.lo <= i && i <= f.hi;
      var fill = c.card, stroke = c.line, txt = c.muted;
      if (!inRange) { fill = c.bg; stroke = c.line; txt = c.muted; }
      else { txt = c.text; }
      if (i === f.mid && f.found < 0) { fill = withAlpha(c.accent, 0.22); stroke = c.accent; txt = c.text; }
      if (i === f.found) { fill = withAlpha(c.good, 0.28); stroke = c.good; txt = c.text; }
      rr(ctx, x + 3, cy - ch / 2, cw - 6, ch, 8);
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = (i === f.mid || i === f.found) ? 2 : 1;
      ctx.strokeStyle = stroke; ctx.stroke();
      ctx.globalAlpha = inRange || i === f.mid ? 1 : 0.4;
      ctx.fillStyle = txt;
      ctx.fillText(String(arr[i]), x + cw / 2, cy + 1);
      ctx.globalAlpha = 1;
      // index labels
      ctx.fillStyle = c.muted;
      ctx.font = Math.round(ch * 0.24) + "px ui-monospace, monospace";
      ctx.fillText(String(i), x + cw / 2, cy + ch / 2 + 14);
      ctx.font = "600 " + Math.round(ch * 0.34) + "px -apple-system, system-ui, sans-serif";
    }
    // pointer labels above cells
    ctx.font = "600 12px ui-monospace, monospace";
    function ptr(i, label, col) {
      if (i < 0 || i >= n) return;
      var px = x0 + i * cw + cw / 2;
      ctx.fillStyle = col;
      ctx.fillText(label, px, cy - ch / 2 - 14);
      ctx.beginPath();
      ctx.moveTo(px, cy - ch / 2 - 6);
      ctx.lineTo(px - 4, cy - ch / 2 - 11);
      ctx.lineTo(px + 4, cy - ch / 2 - 11);
      ctx.closePath();
      ctx.fill();
    }
    ptr(f.lo, "lo", c.good);
    ptr(f.hi, "hi", c.bad);
    if (f.mid >= 0 && f.found < 0) ptr(f.mid, "mid", c.accent);
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
    var el = document.getElementById("algviz-binary-search");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Binary search",
      aspect: 16 / 6,
      cases: [
        { name: "target 23 — found", input: { arr: [2, 5, 8, 12, 16, 23, 38, 45, 56, 72, 91], target: 23 } },
        { name: "target 40 — not present", input: { arr: [2, 5, 8, 12, 16, 23, 38, 45, 56, 72, 91], target: 40 } },
        { name: "target 91 — last element", input: { arr: [2, 5, 8, 12, 16, 23, 38, 45, 56, 72, 91], target: 91 } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
