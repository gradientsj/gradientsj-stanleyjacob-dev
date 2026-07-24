/* Two Sum (hash map) visualizer. Mirrors the shape of viz/binary-search.js:
   scan the array left to right; for each value x look up (target - x) in a
   hash map, insert x -> index on a miss, and highlight the pair on a hit.
   Draws the array with a scan pointer plus a side panel showing the map. */
(function () {
  "use strict";
  function build(input) {
    var nums = input.nums, target = input.target;
    var frames = [];
    var map = []; // insertion-ordered entries { k: value, v: index }
    function snap() {
      var out = [];
      for (var m = 0; m < map.length; m++) out.push({ k: map[m].k, v: map[m].v });
      return out;
    }
    frames.push({ nums: nums, target: target, i: -1, need: null, map: snap(), phase: "intro",
      note: "One pass with a hash map: for each value, ask whether its complement (target − value) was already seen." });
    for (var i = 0; i < nums.length; i++) {
      var x = nums[i];
      var need = target - x;
      frames.push({ nums: nums, target: target, i: i, need: need, map: snap(), phase: "scan",
        note: "i = " + i + ": nums[" + i + "] = " + x + ". Its complement is " + target + " − " + x + " = " + need + "." });
      var hit = -1;
      for (var m = 0; m < map.length; m++) {
        if (map[m].k === need) { hit = m; break; }
      }
      if (hit >= 0) {
        var j = map[hit].v;
        frames.push({ nums: nums, target: target, i: i, need: need, map: snap(), phase: "lookup", hit: hit,
          note: "Look up " + need + " in the map — hit! " + need + " was stored earlier at index " + j + "." });
        frames.push({ nums: nums, target: target, i: i, need: need, map: snap(), phase: "found", hit: hit, pair: [j, i],
          note: "nums[" + j + "] + nums[" + i + "] = " + nums[j] + " + " + x + " = " + target + ". Return [" + j + ", " + i + "]." });
        frames.push({ nums: nums, target: target, i: i, need: need, map: snap(), phase: "done", hit: hit, pair: [j, i],
          note: "Done in a single pass: O(n) time, O(n) extra space for the map." });
        return frames;
      }
      frames.push({ nums: nums, target: target, i: i, need: need, map: snap(), phase: "lookup", miss: true,
        note: "Look up " + need + " in the map — miss: " + need + " has not been seen yet." });
      map.push({ k: x, v: i });
      frames.push({ nums: nums, target: target, i: i, need: need, map: snap(), phase: "insert", inserted: map.length - 1,
        note: "Insert " + x + " → " + i + " (value → index) into the map and move the pointer on." });
    }
    frames.push({ nums: nums, target: target, i: nums.length - 1, need: null, map: snap(), phase: "done",
      note: "The scan finished without a hit: no two values sum to " + target + "." });
    return frames;
  }

  function draw(ctx, f, view) {
    var nums = f.nums, n = nums.length, w = view.w, h = view.h, c = view.colors;
    var pad = 16;

    // ---- hash map panel geometry (right side) ----
    var mw = Math.max(120, Math.min(200, w * 0.32));
    var px = w - pad - mw;
    var py = pad;
    var ph = h - pad * 2;

    // ---- array geometry (left side) ----
    var ax = pad;
    var availW = (px - pad) - ax;
    var cw = Math.min(70, availW / n);
    var total = cw * n;
    var x0 = ax + (availW - total) / 2;
    var cy = h * 0.56;
    var ch = Math.min(56, cw * 0.95, h * 0.34);

    // ---- header: target and the current complement ----
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "600 12px ui-monospace, monospace";
    ctx.fillStyle = c.muted;
    ctx.fillText("target = " + f.target, ax + 2, py + 6);
    if (f.need != null && f.i >= 0) {
      ctx.fillStyle = f.pair ? c.good : c.text;
      ctx.fillText("need = " + f.target + " − " + nums[f.i] + " = " + f.need, ax + 2, py + 24);
    }

    // ---- array cells ----
    ctx.textAlign = "center";
    var vFont = "600 " + Math.round(Math.max(12, ch * 0.34)) + "px -apple-system, system-ui, sans-serif";
    var iFont = Math.round(Math.max(9, ch * 0.24)) + "px ui-monospace, monospace";
    for (var i = 0; i < n; i++) {
      var x = x0 + i * cw;
      var inMap = false;
      for (var m = 0; m < f.map.length; m++) {
        if (f.map[m].v === i) inMap = true;
      }
      var isCur = i === f.i;
      var inPair = !!(f.pair && (i === f.pair[0] || i === f.pair[1]));
      var fill = c.card, stroke = c.line;
      var txt = (f.i >= 0 && i > f.i) ? c.muted : c.text;
      if (inMap) fill = withAlpha(c.accent, 0.1);
      if (isCur) { fill = withAlpha(c.accent, 0.22); stroke = c.accent; txt = c.text; }
      if (inPair) { fill = withAlpha(c.good, 0.28); stroke = c.good; txt = c.text; }
      rr(ctx, x + 3, cy - ch / 2, cw - 6, ch, 8);
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = (isCur || inPair) ? 2 : 1;
      ctx.strokeStyle = stroke; ctx.stroke();
      ctx.fillStyle = txt;
      ctx.font = vFont;
      ctx.fillText(String(nums[i]), x + cw / 2, cy + 1);
      // index labels
      ctx.fillStyle = c.muted;
      ctx.font = iFont;
      ctx.fillText(String(i), x + cw / 2, cy + ch / 2 + 14);
    }

    // ---- pointer labels above cells ----
    ctx.font = "600 12px ui-monospace, monospace";
    function ptr(i, label, col) {
      if (i < 0 || i >= n) return;
      var qx = x0 + i * cw + cw / 2;
      ctx.fillStyle = col;
      ctx.fillText(label, qx, cy - ch / 2 - 14);
      ctx.beginPath();
      ctx.moveTo(qx, cy - ch / 2 - 6);
      ctx.lineTo(qx - 4, cy - ch / 2 - 11);
      ctx.lineTo(qx + 4, cy - ch / 2 - 11);
      ctx.closePath();
      ctx.fill();
    }
    if (f.pair) ptr(f.pair[0], "j", c.good);
    if (f.i >= 0) ptr(f.i, "i", c.accent);

    // ---- hash map panel ----
    rr(ctx, px, py, mw, ph, 10);
    ctx.fillStyle = c.soft; ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = c.line; ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillStyle = c.muted;
    ctx.fillText(mw < 160 ? "value → index" : "hash map (value → index)", px + 12, py + 16);

    var rowH = Math.max(14, Math.min(26, (ph - 64) / 3));
    var ry = py + 30;
    var rFont = "600 " + Math.round(Math.min(13, rowH * 0.6)) + "px ui-monospace, monospace";
    if (!f.map.length) {
      ctx.font = rFont;
      ctx.fillStyle = c.muted;
      ctx.fillText("(empty)", px + 16, ry + rowH / 2 + 1);
    }
    for (var e = 0; e < f.map.length; e++) {
      var y = ry + e * (rowH + 4);
      var isHit = f.hit === e;
      var isNew = f.inserted === e;
      if (isHit || isNew) {
        rr(ctx, px + 8, y, mw - 16, rowH, 6);
        ctx.fillStyle = isHit ? withAlpha(c.good, 0.25) : withAlpha(c.accent, 0.2);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isHit ? c.good : c.accent;
        ctx.stroke();
      }
      ctx.font = rFont;
      ctx.fillStyle = c.text;
      ctx.fillText(f.map[e].k + " → " + f.map[e].v, px + 16, y + rowH / 2 + 1);
    }

    // ---- lookup readout at the bottom of the panel ----
    ctx.font = "600 11px ui-monospace, monospace";
    var qy = py + ph - 16;
    if (f.phase === "scan") {
      ctx.fillStyle = c.muted;
      ctx.fillText("look up " + f.need + "?", px + 12, qy);
    } else if (f.phase === "lookup") {
      if (f.miss) {
        ctx.fillStyle = c.warn;
        ctx.fillText(f.need + "? — miss", px + 12, qy);
      } else {
        ctx.fillStyle = c.good;
        ctx.fillText(f.need + "? — hit", px + 12, qy);
      }
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
    var el = document.getElementById("algviz-arrays-hashing");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Two Sum — one pass with a hash map",
      aspect: 16 / 7,
      cases: [
        { name: "nums [2,7,11,15], target 9 — pair (0,1)", input: { nums: [2, 7, 11, 15], target: 9 } },
        { name: "nums [3,2,4], target 6 — pair (1,2)", input: { nums: [3, 2, 4], target: 6 } },
        { name: "nums [3,3], target 6 — duplicates", input: { nums: [3, 3], target: 6 } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
