/* Merge overlapping intervals visualizer. Sort intervals by start, then sweep
   left to right, absorbing any interval that overlaps the current merged one
   and emitting the merged interval when a gap appears. Mirrors the AlgViz
   contract established by viz/binary-search.js. */
(function () {
  "use strict";

  function fmt(iv) {
    return "[" + iv[0] + ", " + iv[1] + "]";
  }
  function fmtList(list) {
    return list.map(fmt).join(", ");
  }
  function cp(iv) {
    return iv.slice();
  }

  function build(input) {
    var frames = [];
    var raw = input.intervals.map(cp);
    var n = raw.length;

    function snap(list, cur, absorbed, consumed, out, active, note, done) {
      return {
        list: list.map(cp),
        cur: cur ? cur.slice() : null,
        absorbed: absorbed.slice(),
        consumed: consumed.slice(),
        out: out.map(cp),
        active: active,
        done: !!done,
        note: note,
      };
    }

    frames.push(snap(raw, null, [], [], [], -1,
      "Start with " + n + " intervals: " + fmtList(raw) + ". Any that overlap must be merged."));
    frames.push(snap(raw, null, [], [], [], -1,
      "Each interval [s, e] covers s through e on the number line, so two intervals overlap when one starts before the other ends."));

    var arr = raw.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var reordered = arr.some(function (iv, i) { return iv[0] !== raw[i][0] || iv[1] !== raw[i][1]; });
    frames.push(snap(arr, null, [], [], [], -1,
      reordered
        ? "Sort the intervals by start value so every possible overlap is between neighbors."
        : "Sort the intervals by start value. This input is already in order, so nothing moves."));

    var cur = arr[0].slice();
    var absorbed = [0];
    var consumed = [];
    var out = [];
    frames.push(snap(arr, cur, absorbed, consumed, out, -1,
      "Take the first interval " + fmt(arr[0]) + " as the current merged interval."));

    for (var i = 1; i < n; i++) {
      var s = arr[i][0], e = arr[i][1];
      frames.push(snap(arr, cur, absorbed, consumed, out, i,
        "Compare interval " + i + " = " + fmt(arr[i]) + " with current " + fmt(cur) +
        ": is its start " + s + " <= the current end " + cur[1] + "?"));
      if (s <= cur[1]) {
        var oldEnd = cur[1];
        cur[1] = Math.max(cur[1], e);
        absorbed.push(i);
        var note;
        if (e <= oldEnd) {
          note = "Yes: " + s + " <= " + oldEnd + ", and " + fmt(arr[i]) +
            " lies entirely inside, so it is absorbed. Current stays " + fmt(cur) + ".";
        } else {
          note = "Yes: " + s + " <= " + oldEnd + (s === oldEnd ? " (they touch)" : ", they overlap") +
            ". Extend the current end to max(" + oldEnd + ", " + e + ") = " + cur[1] +
            "; current is now " + fmt(cur) + ".";
        }
        frames.push(snap(arr, cur, absorbed, consumed, out, i, note));
      } else {
        var emitted = cur.slice();
        out.push(emitted);
        consumed = consumed.concat(absorbed);
        cur = arr[i].slice();
        absorbed = [i];
        frames.push(snap(arr, cur, absorbed, consumed, out, i,
          "No: " + s + " > " + emitted[1] + ", there is a gap. Emit " + fmt(emitted) +
          " to the output and start a new current " + fmt(cur) + "."));
      }
    }

    var last = cur.slice();
    out.push(last);
    consumed = consumed.concat(absorbed);
    frames.push(snap(arr, null, [], consumed, out, -1,
      "No intervals remain, so emit the last current " + fmt(last) + " to the output."));
    frames.push(snap(arr, null, [], consumed, out, -1,
      "Done. " + n + " intervals merged into " + out.length + ": " + fmtList(out) + ".", true));
    return frames;
  }

  function draw(ctx, f, view) {
    var w = view.w, h = view.h, c = view.colors;
    var list = f.list || [], n = list.length;
    if (!n) return;

    // stable value domain from the frame's interval list
    var dlo = Infinity, dhi = -Infinity;
    for (var i = 0; i < n; i++) {
      dlo = Math.min(dlo, list[i][0]);
      dhi = Math.max(dhi, list[i][1]);
    }
    if (dhi === dlo) dhi = dlo + 1;

    var gutter = 50, padR = 24, padTop = 10, axisH = 34;
    var plotX = gutter, plotW = w - gutter - padR;
    function xOf(v) { return plotX + ((v - dlo) / (dhi - dlo)) * plotW; }

    var areaH = h - padTop - axisH;
    var rowUnits = n + 2.6; // n input lanes + current lane + output lane + gaps
    var rowH = Math.min(46, areaH / rowUnits);
    var barH = Math.min(26, rowH * 0.68);
    var startY = padTop + (areaH - rowH * rowUnits) / 2;
    var yCur = startY + (n + 0.5) * rowH;   // top of the "current" lane
    var yOut = startY + (n + 1.6) * rowH;   // top of the "output" lane
    var axisY = h - axisH + 12;

    // number line: ticks, faint grid, baseline
    var range = dhi - dlo;
    var step = Math.max(1, Math.ceil(range / 22));
    ctx.lineWidth = 1;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var v = Math.ceil(dlo); v <= Math.floor(dhi); v += step) {
      var gx = xOf(v);
      ctx.strokeStyle = withAlpha(c.line, 0.45);
      ctx.beginPath();
      ctx.moveTo(gx, startY);
      ctx.lineTo(gx, axisY - 6);
      ctx.stroke();
      ctx.strokeStyle = c.line;
      ctx.beginPath();
      ctx.moveTo(gx, axisY - 4);
      ctx.lineTo(gx, axisY + 4);
      ctx.stroke();
      ctx.fillStyle = c.muted;
      ctx.fillText(String(v), gx, axisY + 13);
    }
    ctx.strokeStyle = c.line;
    ctx.beginPath();
    ctx.moveTo(xOf(dlo), axisY);
    ctx.lineTo(xOf(dhi), axisY);
    ctx.stroke();

    // separator between the input lanes and the current/output lanes
    ctx.strokeStyle = withAlpha(c.line, 0.7);
    ctx.beginPath();
    ctx.moveTo(plotX, startY + (n + 0.22) * rowH);
    ctx.lineTo(plotX + plotW, startY + (n + 0.22) * rowH);
    ctx.stroke();

    function bar(x1, x2, laneTop, fill, stroke, lw, label, txtColor) {
      var bw = Math.max(x2 - x1, 6);
      var by = laneTop + (rowH - barH) / 2;
      rr(ctx, x1, by, bw, barH, Math.min(6, barH / 2));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      if (label) {
        ctx.fillStyle = txtColor;
        ctx.font = "600 11px ui-monospace, monospace";
        ctx.textBaseline = "middle";
        var tw = ctx.measureText(label).width;
        if (tw + 8 <= bw) {
          ctx.textAlign = "center";
          ctx.fillText(label, x1 + bw / 2, by + barH / 2 + 0.5);
        } else if (x1 + bw + 8 + tw < w - 2) {
          ctx.textAlign = "left";
          ctx.fillText(label, x1 + bw + 6, by + barH / 2 + 0.5);
        } else {
          ctx.textAlign = "right";
          ctx.fillText(label, x1 - 6, by + barH / 2 + 0.5);
        }
      }
    }

    function laneLabel(text, laneTop, col) {
      ctx.fillStyle = col;
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(text, gutter - 10, laneTop + rowH / 2 + 0.5);
    }

    // dashed marker at the current merged interval's end
    if (f.cur) {
      var cx = xOf(f.cur[1]);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = withAlpha(c.accent, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, startY);
      ctx.lineTo(cx, yCur + rowH);
      ctx.stroke();
      ctx.restore();
    }

    // input lanes, one interval per row, sorted by start
    for (var k = 0; k < n; k++) {
      var laneTop = startY + k * rowH;
      var iv = list[k];
      var x1 = xOf(iv[0]), x2 = xOf(iv[1]);
      var isConsumed = f.consumed.indexOf(k) >= 0;
      var isAbsorbed = f.absorbed.indexOf(k) >= 0;
      var isActive = f.active === k;
      var fill = c.card, stroke = c.line, lw = 1, txt = c.text;
      if (isAbsorbed) { fill = withAlpha(c.accent, 0.18); stroke = withAlpha(c.accent, 0.8); }
      if (isActive) { fill = withAlpha(c.warn, 0.18); stroke = c.warn; lw = 2; }
      if (isConsumed) ctx.globalAlpha = 0.35;
      laneLabel(String(k), laneTop, isActive ? c.warn : c.muted);
      bar(x1, x2, laneTop, fill, stroke, lw, fmt(iv), txt);
      ctx.globalAlpha = 1;
    }

    // current merged interval lane
    laneLabel("cur", yCur, c.accent);
    if (f.cur) {
      bar(xOf(f.cur[0]), xOf(f.cur[1]), yCur, withAlpha(c.accent, 0.22), c.accent, 2, fmt(f.cur), c.text);
    }

    // output lane: emitted merged intervals
    laneLabel("out", yOut, c.good);
    for (var m = 0; m < f.out.length; m++) {
      var ov = f.out[m];
      bar(xOf(ov[0]), xOf(ov[1]), yOut, withAlpha(c.good, 0.22), c.good, f.done ? 2 : 1.5, fmt(ov), c.text);
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
    var el = document.getElementById("algviz-intervals");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Merge intervals",
      aspect: 16 / 7,
      cases: [
        { name: "four intervals — two overlap", input: { intervals: [[1, 3], [2, 6], [8, 10], [15, 18]] } },
        { name: "touching endpoints — [1,4] + [4,5]", input: { intervals: [[1, 4], [4, 5]] } },
        { name: "nested — [2,3] inside [1,4]", input: { intervals: [[1, 4], [2, 3]] } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
