/* BFS shortest path on a grid visualizer. Mirrors the AlgViz contract shape of
   viz/binary-search.js: build() turns an input into frames, draw() renders one
   frame with Canvas 2D in CSS pixels, caption() reads the frame's note. */
(function () {
  "use strict";

  function key(r, c) { return r + "," + c; }

  function build(input) {
    var rows = input.rows, cols = input.cols;
    var S = input.start, T = input.target;
    var walls = input.walls || [];
    var wallSet = {};
    walls.forEach(function (p) { wallSet[key(p[0], p[1])] = true; });

    var dist = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) row.push(-1);
      dist.push(row);
    }
    function snapDist() {
      return dist.map(function (row2) { return row2.slice(); });
    }
    function frame(extra) {
      var f = { rows: rows, cols: cols, walls: walls, start: S, target: T,
        dist: snapDist(), frontier: [], ring: 0, path: null, phase: "init", note: "" };
      for (var k in extra) f[k] = extra[k];
      return f;
    }

    var frames = [];
    dist[S[0]][S[1]] = 0;
    var frontier = [S.slice()];
    frames.push(frame({ frontier: [S.slice()],
      note: "BFS from S (" + S[0] + "," + S[1] + ") to T (" + T[0] + "," + T[1] +
        "). The queue starts with S, whose distance is 0. Hatched cells are walls." }));

    var DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    var parent = {};
    var found = false;
    var ring = 0;
    while (frontier.length && !found) {
      var next = [];
      for (var i = 0; i < frontier.length; i++) {
        var cur = frontier[i];
        for (var d = 0; d < 4; d++) {
          var nr = cur[0] + DIRS[d][0], nc = cur[1] + DIRS[d][1];
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (wallSet[key(nr, nc)]) continue;
          if (dist[nr][nc] !== -1) continue;
          dist[nr][nc] = ring + 1;
          parent[key(nr, nc)] = cur;
          next.push([nr, nc]);
          if (nr === T[0] && nc === T[1]) found = true;
        }
      }
      ring++;
      if (!next.length) break;
      frames.push(frame({ frontier: next.map(function (p) { return p.slice(); }),
        ring: ring, phase: "expand",
        note: "Ring " + ring + ": dequeue the frontier and enqueue " + next.length +
          " unvisited neighbor" + (next.length === 1 ? "" : "s") +
          ", writing distance " + ring + " into each." }));
      frontier = next;
    }

    if (!found) {
      frames.push(frame({ ring: ring, phase: "dead",
        note: "The queue is empty and T was never reached, so no path exists." }));
    } else {
      var dT = dist[T[0]][T[1]];
      frames.push(frame({ frontier: frontier.map(function (p) { return p.slice(); }),
        ring: ring, phase: "found",
        note: "T reached with distance " + dT + ". BFS expands ring by ring, so no shorter route to T can exist." }));

      var path = [T.slice()];
      var p2 = T;
      while (!(p2[0] === S[0] && p2[1] === S[1])) {
        p2 = parent[key(p2[0], p2[1])];
        path.unshift(p2.slice());
      }
      var step = path.length > 12 ? 2 : 1;
      var reveals = [];
      for (var k2 = 1; k2 <= path.length; k2 += step) reveals.push(k2);
      if (reveals[reveals.length - 1] !== path.length) reveals.push(path.length);
      reveals.forEach(function (k3, j) {
        var shown = path.slice(path.length - k3).map(function (p3) { return p3.slice(); });
        var last = j === reveals.length - 1;
        var note;
        if (j === 0) {
          note = "Backtrack: start at T and follow the stored parent pointers toward S.";
        } else if (!last) {
          note = "Backtrack via parents: " + k3 + " of " + path.length + " path cells marked.";
        } else {
          note = "Shortest path highlighted: " + (path.length - 1) + " moves from S to T (distance " + dT + ").";
        }
        frames.push(frame({ ring: ring, phase: last ? "done" : "trace", path: shown, note: note }));
      });
    }

    var maxd = 1;
    for (var r2 = 0; r2 < rows; r2++) {
      for (var c2 = 0; c2 < cols; c2++) {
        if (dist[r2][c2] > maxd) maxd = dist[r2][c2];
      }
    }
    frames.forEach(function (f2) { f2.maxd = maxd; });
    return frames;
  }

  function draw(ctx, f, view) {
    if (!f || !f.dist) return;
    var c = view.colors, w = view.w, h = view.h;
    var rows = f.rows, cols = f.cols;
    var margin = 12, labelT = 16, labelL = 18, bandH = 34;
    var availW = w - margin * 2 - labelL;
    var availH = h - margin * 2 - labelT - bandH;
    var cell = Math.min(availW / cols, availH / rows, 56);
    var gw = cell * cols, gh = cell * rows;
    var x0 = margin + labelL + (availW - gw) / 2;
    var y0 = margin + labelT + (availH - gh) / 2;

    var wallSet = {}, frontSet = {}, pathSet = {};
    f.walls.forEach(function (p) { wallSet[key(p[0], p[1])] = true; });
    f.frontier.forEach(function (p) { frontSet[key(p[0], p[1])] = true; });
    var path = f.path || [];
    path.forEach(function (p) { pathSet[key(p[0], p[1])] = true; });
    var S = f.start, T = f.target;
    var maxd = Math.max(1, f.maxd || 1);
    var traced = f.phase === "trace" || f.phase === "done";
    var reached = traced || f.phase === "found";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // row / column index labels
    ctx.fillStyle = c.muted;
    ctx.font = "10px ui-monospace, monospace";
    for (var ci = 0; ci < cols; ci++) ctx.fillText(String(ci), x0 + ci * cell + cell / 2, y0 - 8);
    ctx.textAlign = "right";
    for (var ri = 0; ri < rows; ri++) ctx.fillText(String(ri), x0 - 6, y0 + ri * cell + cell / 2);
    ctx.textAlign = "center";

    // pass 1: cell boxes
    var r, cc, x, y, k;
    for (r = 0; r < rows; r++) {
      for (cc = 0; cc < cols; cc++) {
        x = x0 + cc * cell;
        y = y0 + r * cell;
        k = key(r, cc);
        var d = f.dist[r][cc];
        var isS = r === S[0] && cc === S[1];
        var isT = r === T[0] && cc === T[1];
        var fill = c.card, stroke = c.line, lw = 1;
        if (wallSet[k]) {
          fill = withAlpha(c.muted, 0.4);
          stroke = withAlpha(c.muted, 0.6);
        } else if (d >= 0) {
          fill = withAlpha(c.accent, 0.1 + 0.55 * (d / maxd));
          stroke = withAlpha(c.accent, 0.45);
        }
        if (pathSet[k]) { fill = withAlpha(c.good, 0.3); stroke = c.good; lw = 2; }
        else if (frontSet[k] && !traced) { stroke = c.accent; lw = 2; }
        if (isT) { stroke = reached ? c.good : c.warn; lw = 2; }
        if (isS) { stroke = c.good; lw = 2; }
        rr(ctx, x + 2, y + 2, cell - 4, cell - 4, Math.min(7, cell * 0.18));
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = lw;
        ctx.strokeStyle = stroke;
        ctx.stroke();
        if (wallSet[k]) {
          ctx.strokeStyle = withAlpha(c.muted, 0.7);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + cell * 0.24, y + cell * 0.76);
          ctx.lineTo(x + cell * 0.76, y + cell * 0.24);
          ctx.stroke();
        }
      }
    }

    // pass 2: the traced path as a polyline through cell centers
    if (path.length > 1) {
      ctx.strokeStyle = withAlpha(c.good, 0.45);
      ctx.lineWidth = Math.max(2, cell * 0.1);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      for (var pi = 0; pi < path.length; pi++) {
        var px = x0 + path[pi][1] * cell + cell / 2;
        var py = y0 + path[pi][0] * cell + cell / 2;
        if (pi === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // pass 3: cell labels (distances, S and T)
    for (r = 0; r < rows; r++) {
      for (cc = 0; cc < cols; cc++) {
        x = x0 + cc * cell;
        y = y0 + r * cell;
        k = key(r, cc);
        if (wallSet[k]) continue;
        var d2 = f.dist[r][cc];
        var isS2 = r === S[0] && cc === S[1];
        var isT2 = r === T[0] && cc === T[1];
        if (isS2 || isT2) {
          ctx.fillStyle = c.text;
          ctx.font = "700 " + Math.round(cell * 0.4) + "px -apple-system, system-ui, sans-serif";
          if (isT2 && d2 >= 0) {
            ctx.fillText("T", x + cell / 2, y + cell / 2 - cell * 0.13);
            ctx.fillStyle = c.muted;
            ctx.font = "600 " + Math.max(8, Math.round(cell * 0.24)) + "px ui-monospace, monospace";
            ctx.fillText(String(d2), x + cell / 2, y + cell / 2 + cell * 0.24);
          } else {
            ctx.fillText(isS2 ? "S" : "T", x + cell / 2, y + cell / 2);
          }
        } else if (d2 >= 0) {
          ctx.fillStyle = c.text;
          ctx.font = "600 " + Math.max(9, Math.round(cell * 0.34)) + "px ui-monospace, monospace";
          ctx.fillText(String(d2), x + cell / 2, y + cell / 2);
        }
      }
    }

    // bottom band: the queue (current ring) or the traced path, plus a legend
    var bandTop = h - margin - bandH;
    var midY = bandTop + bandH / 2;
    var isPath = traced;
    ctx.fillStyle = c.muted;
    ctx.font = "600 10px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(isPath ? "path" : "queue", margin, midY);
    var chipX0 = margin + 46;

    var legendW = 0;
    if (w >= 460) {
      legendW = 5 * 12 + 40;
      var lx = w - margin - legendW;
      ctx.textAlign = "right";
      ctx.fillStyle = c.muted;
      ctx.fillText("0", lx + 8, midY);
      for (var li = 0; li < 5; li++) {
        rr(ctx, lx + 14 + li * 12, midY - 5, 10, 10, 2);
        ctx.fillStyle = withAlpha(c.accent, 0.1 + 0.55 * (li / 4));
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = c.line;
        ctx.stroke();
      }
      ctx.textAlign = "left";
      ctx.fillStyle = c.muted;
      ctx.fillText(String(maxd), lx + 14 + 5 * 12 + 4, midY);
    }

    var items = isPath ? path : f.frontier;
    var chipCol = isPath ? c.good : c.accent;
    var chipAvail = w - margin - legendW - (legendW ? 12 : 0) - chipX0;
    ctx.textAlign = "left";
    if (!items.length) {
      ctx.fillStyle = c.muted;
      ctx.fillText("(empty)", chipX0, midY);
    } else {
      var chipW = Math.min(46, chipAvail / items.length);
      if (chipW < 24) {
        ctx.fillStyle = c.muted;
        ctx.fillText(items.length + " cells" + (isPath ? " on the path" : " at distance " + f.ring), chipX0, midY);
      } else {
        ctx.textAlign = "center";
        ctx.font = "600 " + Math.min(10, Math.round(chipW * 0.38)) + "px ui-monospace, monospace";
        for (var qi = 0; qi < items.length; qi++) {
          var cx = chipX0 + qi * chipW;
          rr(ctx, cx, midY - 10, chipW - 4, 20, 5);
          ctx.fillStyle = withAlpha(chipCol, 0.14);
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = withAlpha(chipCol, 0.6);
          ctx.stroke();
          ctx.fillStyle = c.text;
          ctx.fillText(items[qi][0] + "," + items[qi][1], cx + (chipW - 4) / 2, midY + 1);
        }
        ctx.textAlign = "left";
      }
    }
    ctx.textAlign = "center";
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
    var el = document.getElementById("algviz-graph-traversal");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "BFS shortest path on a grid",
      aspect: 16 / 7,
      cases: [
        { name: "6x8 grid with a wall",
          input: { rows: 6, cols: 8, start: [0, 0], target: [5, 7],
            walls: [[1, 3], [2, 3], [3, 3], [4, 3]] } },
        { name: "5x5 open grid",
          input: { rows: 5, cols: 5, start: [0, 0], target: [4, 4], walls: [] } },
        { name: "6x6 barrier — forced detour",
          input: { rows: 6, cols: 6, start: [0, 0], target: [3, 3],
            walls: [[2, 2], [2, 3], [2, 4], [3, 2], [4, 2], [4, 3], [4, 4]] } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
