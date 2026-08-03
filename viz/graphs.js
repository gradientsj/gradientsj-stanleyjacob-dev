/* Number of islands visualizer (grid DFS flood fill). Mirrors the AlgViz
   contract established by viz/binary-search.js: scan the grid row by row,
   and every time an unvisited land cell appears, bump the island count and
   flood-fill its whole component with DFS, painting it a distinct color. */
(function () {
  "use strict";

  var DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var DIR_NAMES = ["up", "down", "left", "right"];

  function build(input) {
    var grid = input.grid;
    var rows = grid.length, cols = grid[0].length;
    var owner = [];
    for (var i = 0; i < rows; i++) {
      var row = [];
      for (var j = 0; j < cols; j++) row.push(0);
      owner.push(row);
    }
    var frames = [];
    var count = 0;

    function copyOwner() {
      var o = [];
      for (var r = 0; r < rows; r++) o.push(owner[r].slice());
      return o;
    }
    function copyStack(st) {
      var s = [];
      for (var k = 0; k < st.length; k++) s.push(st[k].slice());
      return s;
    }
    function snap(stack, scan, note, done) {
      frames.push({
        grid: grid,
        owner: copyOwner(),
        count: count,
        stack: copyStack(stack),
        scan: scan ? scan.slice() : null,
        note: note,
        done: !!done,
      });
    }
    function islandSize(id) {
      var n = 0;
      for (var r = 0; r < rows; r++)
        for (var k = 0; k < cols; k++) if (owner[r][k] === id) n++;
      return n;
    }

    snap([], [0, 0],
      "Scan the " + rows + "×" + cols + " grid left to right, top to bottom, " +
      "looking for land (1) that no island has claimed yet. islands = 0.");

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (grid[r][c] !== 1 || owner[r][c] !== 0) continue;
        count++;
        owner[r][c] = count;
        var stack = [[r, c]];
        snap(stack, [r, c],
          "Scan reaches (" + r + "," + c + "): unvisited land, so this is a new island. " +
          "islands rises to " + count + "; start a DFS flood fill here.");
        while (stack.length) {
          var top = stack[stack.length - 1];
          var moved = false;
          for (var d = 0; d < 4; d++) {
            var nr = top[0] + DIRS[d][0], nc = top[1] + DIRS[d][1];
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                grid[nr][nc] === 1 && owner[nr][nc] === 0) {
              owner[nr][nc] = count;
              stack.push([nr, nc]);
              snap(stack, null,
                "DFS spreads " + DIR_NAMES[d] + " from (" + top[0] + "," + top[1] + ") to (" +
                nr + "," + nc + ") and pushes it on the stack. The fill keeps island " + count + "'s color.");
              moved = true;
              break;
            }
          }
          if (!moved) stack.pop();
        }
        var size = islandSize(count);
        snap([], null,
          "No unvisited land is reachable, so the stack empties: island " + count +
          " is complete (" + size + " cell" + (size === 1 ? "" : "s") + "). Resume the scan.");
      }
    }

    snap([], null,
      "Scan complete: every land cell belongs to exactly one flood-filled component. " +
      "Number of islands = " + count + ".", true);
    return frames;
  }

  function draw(ctx, f, view) {
    var grid = f.grid, rows = grid.length, cols = grid[0].length;
    var w = view.w, h = view.h, c = view.colors;
    var pad = Math.max(10, Math.round(Math.min(w, h) * 0.05));
    var panelW = Math.max(128, Math.min(190, w * 0.28));
    var topGap = 26, bottomGap = 16, leftGap = 18, midGap = 12;
    var availW = w - pad * 2 - panelW - leftGap - midGap;
    var availH = h - pad * 2 - topGap - bottomGap;
    var cell = Math.max(8, Math.min(availW / cols, availH / rows, 64));
    var gw = cell * cols, gh = cell * rows;
    var ox = pad + leftGap + (availW - gw) / 2;
    var oy = pad + topGap + (availH - gh) / 2;

    var st = f.stack || [];
    var onStack = {};
    for (var s = 0; s < st.length; s++) onStack[st[s][0] * cols + st[s][1]] = true;
    var top = st.length ? st[st.length - 1] : null;
    var curId = top ? f.owner[top[0]][top[1]] : 0;

    // grid cells
    var valFont = Math.max(9, Math.round(cell * 0.36));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var r = 0; r < rows; r++) {
      for (var k = 0; k < cols; k++) {
        var x = ox + k * cell, y = oy + r * cell;
        var id = f.owner[r][k];
        var stacked = !!onStack[r * cols + k];
        var isTop = top && top[0] === r && top[1] === k;
        var fill, stroke, txt, lw = 1, alpha = 1;
        if (grid[r][k] === 0) {
          fill = c.bg; stroke = c.line; txt = c.muted; alpha = 0.5;
        } else if (id === 0) {
          fill = withAlpha(c.muted, 0.22); stroke = c.muted; txt = c.text;
        } else {
          var col = c.pool[(id - 1) % c.pool.length];
          fill = withAlpha(col, stacked ? 0.5 : 0.3);
          stroke = col; txt = c.text;
          lw = isTop ? 3 : stacked ? 2 : 1.25;
        }
        rr(ctx, x + 2, y + 2, cell - 4, cell - 4, Math.max(3, cell * 0.14));
        ctx.fillStyle = fill; ctx.fill();
        ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke();
        if (cell >= 13) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = txt;
          ctx.font = "600 " + valFont + "px -apple-system, system-ui, sans-serif";
          ctx.fillText(String(grid[r][k]), x + cell / 2, y + cell / 2 + 1);
          ctx.globalAlpha = 1;
        }
      }
    }

    // scan cursor: dashed ring on the cell the row-by-row scan is looking at
    if (f.scan) {
      var sx = ox + f.scan[1] * cell, sy = oy + f.scan[0] * cell;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 2;
      rr(ctx, sx + 0.5, sy + 0.5, cell - 1, cell - 1, Math.max(4, cell * 0.16));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // row / column index labels
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = c.muted;
    ctx.font = Math.max(8, Math.min(11, Math.round(cell * 0.3))) + "px ui-monospace, monospace";
    for (var kc = 0; kc < cols; kc++)
      ctx.fillText(String(kc), ox + kc * cell + cell / 2, oy + gh + 11);
    for (var kr = 0; kr < rows; kr++)
      ctx.fillText(String(kr), ox - 10, oy + kr * cell + cell / 2 + 3);

    // pointer above the grid: scan cursor while scanning, DFS head while filling
    function ptr(cellRC, label, col) {
      var pxc = ox + cellRC[1] * cell + cell / 2;
      ctx.fillStyle = col;
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.fillText(label, pxc, oy - 12);
      ctx.beginPath();
      ctx.moveTo(pxc, oy - 3);
      ctx.lineTo(pxc - 4, oy - 9);
      ctx.lineTo(pxc + 4, oy - 9);
      ctx.closePath();
      ctx.fill();
    }
    if (f.scan) ptr(f.scan, "scan", c.accent);
    else if (top) ptr(top, "dfs", curId > 0 ? c.pool[(curId - 1) % c.pool.length] : c.accent);

    // side panel -----------------------------------------------------------
    var px = w - pad - panelW + 6;
    var py = pad + 2;
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 12, pad);
    ctx.lineTo(px - 12, h - pad);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = c.muted;
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillText("ISLANDS FOUND", px, py + 12);
    ctx.fillStyle = f.done ? c.good : c.accent;
    ctx.font = "700 " + Math.round(Math.min(30, Math.max(20, h * 0.11))) + "px -apple-system, system-ui, sans-serif";
    ctx.fillText(String(f.count), px, py + 42);

    // one colored chip per island found so far
    var chipsY = py + 54;
    var chip = 15, gap = 4;
    var perRow = Math.max(1, Math.floor((panelW - 12) / (chip + gap)));
    var chipRows = f.count ? Math.ceil(f.count / perRow) : 0;
    ctx.font = "600 9px ui-monospace, monospace";
    for (var ci = 0; ci < f.count; ci++) {
      var ccol = c.pool[ci % c.pool.length];
      var cx = px + (ci % perRow) * (chip + gap);
      var cyy = chipsY + Math.floor(ci / perRow) * (chip + gap);
      rr(ctx, cx, cyy, chip, chip, 4);
      ctx.fillStyle = withAlpha(ccol, 0.45); ctx.fill();
      ctx.strokeStyle = ccol; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = c.text;
      ctx.textAlign = "center";
      ctx.fillText(String(ci + 1), cx + chip / 2, cyy + chip / 2 + 3);
      ctx.textAlign = "left";
    }
    var chipsBottom = chipsY + (chipRows ? chipRows * (chip + gap) : 8);

    // DFS stack, top entry first
    var stackLabelY = chipsBottom + 16;
    ctx.fillStyle = c.muted;
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillText("DFS STACK", px, stackLabelY);
    var ey = stackLabelY + 7;
    var eh = 17;
    if (!st.length) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = c.muted;
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText("(empty)", px, ey + 12);
      ctx.globalAlpha = 1;
    } else {
      var scol = curId > 0 ? c.pool[(curId - 1) % c.pool.length] : c.accent;
      var maxShow = Math.max(1, Math.floor((h - pad - ey) / eh));
      var showN = st.length > maxShow ? maxShow - 1 : st.length;
      for (var e = 0; e < showN; e++) {
        var ent = st[st.length - 1 - e];
        var yE = ey + e * eh;
        rr(ctx, px, yE, 62, eh - 3, 4);
        ctx.fillStyle = withAlpha(scol, e === 0 ? 0.45 : 0.22); ctx.fill();
        ctx.strokeStyle = scol; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = c.text;
        ctx.font = "11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("(" + ent[0] + "," + ent[1] + ")", px + 31, yE + eh - 7);
        ctx.textAlign = "left";
        if (e === 0) {
          ctx.fillStyle = c.muted;
          ctx.fillText("← top", px + 68, yE + eh - 7);
        }
      }
      if (st.length > showN) {
        ctx.fillStyle = c.muted;
        ctx.font = "11px ui-monospace, monospace";
        ctx.fillText("… +" + (st.length - showN) + " more", px, ey + showN * eh + 11);
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
    var el = document.getElementById("algviz-graphs");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Number of islands (DFS flood fill)",
      aspect: 16 / 7,
      cases: [
        { name: "5×6 grid — 3 islands", input: { grid: [
          [1, 1, 0, 0, 0, 1],
          [1, 0, 0, 0, 0, 1],
          [0, 0, 1, 1, 0, 1],
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 0, 0],
        ] } },
        { name: "4×4 grid — 1 island", input: { grid: [
          [0, 1, 1, 0],
          [1, 1, 0, 0],
          [0, 1, 1, 1],
          [0, 0, 0, 1],
        ] } },
        { name: "3×3 checkerboard — 5 islands", input: { grid: [
          [1, 0, 1],
          [0, 1, 0],
          [1, 0, 1],
        ] } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
