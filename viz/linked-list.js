/* Reverse-a-linked-list visualizer. Mirrors the AlgViz contract established
   by viz/binary-search.js: nodes are boxes, next pointers are arrows, and the
   prev / curr / next walk pointers are labeled below the nodes. Arrows flip
   backwards one at a time as the reversal proceeds. */
(function () {
  "use strict";
  function build(input) {
    var vals = input.list.slice();
    var n = vals.length;
    var next = [];
    for (var i = 0; i < n; i++) next.push(i + 1 < n ? i + 1 : -1); // -1 = null on the right
    var frames = [];
    var prev = -1, curr = 0;

    function snap(extra) {
      var f = { n: n, vals: vals, next: next.slice(), prev: prev, curr: curr,
        nxt: -1, hasNext: false, flip: -1, phase: "", note: "" };
      for (var k in extra) f[k] = extra[k];
      return f;
    }

    frames.push(snap({ phase: "init",
      note: "Start with prev = null and curr = head (" + vals[0] + "). Reverse the list by flipping one arrow at a time." }));

    while (curr !== -1) {
      var nxt = next[curr];
      frames.push(snap({ nxt: nxt, hasNext: true, phase: "save",
        note: nxt >= 0
          ? "Save next = curr.next (" + vals[nxt] + ") so the rest of the list is not lost when the arrow flips."
          : "Save next = curr.next = null — curr (" + vals[curr] + ") is the last node." }));
      next[curr] = prev >= 0 ? prev : -2; // -2 = null on the left
      frames.push(snap({ nxt: nxt, hasNext: true, flip: curr, phase: "flip",
        note: prev >= 0
          ? "Flip the arrow: curr.next (" + vals[curr] + ") now points back to prev (" + vals[prev] + ") instead of forward."
          : "Flip the arrow: curr.next (" + vals[curr] + ") now points to null — it becomes the tail of the reversed list." }));
      prev = curr;
      curr = nxt;
      frames.push(snap({ nxt: nxt, hasNext: true, phase: "advance",
        note: "Advance: prev = curr (" + vals[prev] + ")" +
          (curr >= 0 ? " and curr = next (" + vals[curr] + ")." : " and curr = next = null.") }));
    }

    frames.push(snap({ phase: "done",
      note: "curr is null, so the walk is over. Every arrow points backwards; prev (" + vals[prev] + ") is the new head." }));
    return frames;
  }

  function draw(ctx, f, view) {
    var n = f.n || 0, w = view.w, h = view.h, c = view.colors;
    if (!n) return;
    var pad = 20;
    var slots = n + 2; // left null slot + nodes + right null slot
    var slotW = Math.min(112, (w - pad * 2) / slots);
    var x0 = (w - slotW * slots) / 2;
    function cx(k) { return x0 + (k + 1.5) * slotW; } // k in [-1 .. n]
    var boxW = Math.min(64, slotW * 0.74);
    var boxH = Math.min(54, Math.max(24, Math.min(boxW * 0.95, h * 0.3)));
    var cy = h * 0.46;
    var top = cy - boxH / 2, bot = cy + boxH / 2;
    var arcH = Math.min(42, h * 0.2);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // ghost "null" slots at both ends of the list
    function nullSlot(k) {
      var gw = boxW * 0.92, gh = boxH * 0.78;
      ctx.setLineDash([4, 4]);
      rr(ctx, cx(k) - gw / 2, cy - gh / 2, gw, gh, 8);
      ctx.strokeStyle = withAlpha(c.muted, 0.55);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = withAlpha(c.muted, 0.85);
      ctx.font = "600 " + Math.round(Math.max(9, boxH * 0.26)) + "px ui-monospace, monospace";
      ctx.fillText("null", cx(k), cy + 1);
    }
    nullSlot(-1);
    nullSlot(n);

    // node boxes
    for (var i = 0; i < n; i++) {
      var rev = f.next[i] === -2 || (f.next[i] >= 0 && f.next[i] < i);
      var fill = rev ? withAlpha(c.good, 0.14) : c.card;
      var stroke = rev ? withAlpha(c.good, 0.7) : c.line;
      var lw = 1;
      if (i === f.curr) { fill = withAlpha(c.accent, 0.2); stroke = c.accent; lw = 2; }
      else if (i === f.prev) { stroke = c.good; lw = 2; }
      rr(ctx, cx(i) - boxW / 2, top, boxW, boxH, 9);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.fillStyle = c.text;
      ctx.font = "600 " + Math.round(Math.max(11, boxH * 0.38)) + "px -apple-system, system-ui, sans-serif";
      ctx.fillText(String(f.vals[i]), cx(i), cy + 1);
    }

    // arrow helpers
    function head(x, y, ang, col) {
      var s = Math.max(5, boxH * 0.15);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - s * Math.cos(ang - 0.45), y - s * Math.sin(ang - 0.45));
      ctx.lineTo(x - s * Math.cos(ang + 0.45), y - s * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    }
    function straight(x1, y1, x2, y2, col, lw) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();
      head(x2, y2, Math.atan2(y2 - y1, x2 - x1), col);
    }
    function arc(x1, y1, x2, y2, col, lw) {
      var mx = (x1 + x2) / 2, my = Math.min(y1, y2) - arcH;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();
      head(x2, y2, Math.atan2(y2 - my, x2 - mx), col);
    }

    // next-pointer arrows: forward links run straight between boxes, flipped
    // links arc over the tops of the boxes back to the previous node
    for (var j = 0; j < n; j++) {
      var t = f.next[j];
      var flipped = t === -2 || (t >= 0 && t < j);
      var col = flipped ? c.good : withAlpha(c.muted, 0.85);
      var lw2 = 1.5;
      if (f.flip === j) { col = c.accent; lw2 = 2.5; }
      else if (f.phase === "save" && j === f.curr) { col = c.warn; lw2 = 2.5; }
      if (t === j + 1) {
        straight(cx(j) + boxW / 2 + 2, cy, cx(t) - boxW / 2 - 2, cy, col, lw2);
      } else if (t === -1) {
        straight(cx(j) + boxW / 2 + 2, cy, cx(n) - boxW * 0.46 - 2, cy, col, lw2);
      } else if (t >= 0 && t < j) {
        arc(cx(j), top - 2, cx(t) + boxW * 0.12, top - 3, col, lw2);
      } else if (t === -2) {
        arc(cx(j), top - 2, cx(-1), cy - boxH * 0.39 - 3, col, lw2);
      }
    }

    // prev / curr / next pointer labels below the nodes
    var rowGap = Math.min(18, Math.max(10, h * 0.075));
    var baseY = bot + 8;
    function ptr(k, label, col, row, dx) {
      var px = cx(k) + dx;
      var apexY = bot + 3;
      ctx.beginPath();
      ctx.moveTo(px, apexY);
      ctx.lineTo(px - 4, apexY + 6);
      ctx.lineTo(px + 4, apexY + 6);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      var ly = baseY + rowGap * (row + 1);
      ctx.strokeStyle = withAlpha(col, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, apexY + 7);
      ctx.lineTo(px, ly - 7);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = "600 " + Math.round(Math.min(12, Math.max(9, h * 0.052))) + "px ui-monospace, monospace";
      ctx.fillText(label, px, ly);
    }
    ptr(f.prev >= 0 ? f.prev : -1, "prev", c.good, 0, -7);
    ptr(f.curr >= 0 ? f.curr : n, "curr", c.accent, 1, 0);
    if (f.hasNext) ptr(f.nxt >= 0 ? f.nxt : n, "next", c.warn, 2, 7);
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
    var el = document.getElementById("algviz-linked-list");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Reverse a linked list",
      aspect: 16 / 6,
      cases: [
        { name: "list [1, 2, 3, 4, 5]", input: { list: [1, 2, 3, 4, 5] } },
        { name: "two equal nodes [7, 7]", input: { list: [7, 7] } },
        { name: "single node [9]", input: { list: [9] } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
