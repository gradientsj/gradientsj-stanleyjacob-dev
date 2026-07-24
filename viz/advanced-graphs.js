/* Dijkstra's shortest paths visualizer. Runs Dijkstra on a small weighted
   undirected graph: nodes sit at fixed positions, every node carries a
   tentative-distance label (starting at infinity), and each step either picks
   the cheapest unvisited node and settles it, or relaxes one of its edges.
   Mirrors the AlgViz contract established by viz/binary-search.js. */
(function () {
  "use strict";

  var INF = Infinity;
  function fmt(d) { return d === INF ? "∞" : String(d); }

  function build(input) {
    var names = input.names, pos = input.pos, edges = input.edges, src = input.source;
    var n = names.length;
    var adj = [], i;
    for (i = 0; i < n; i++) adj.push([]);
    edges.forEach(function (e) {
      adj[e[0]].push([e[1], e[2]]);
      adj[e[1]].push([e[0], e[2]]);
    });
    var dist = [], prev = [], settled = [];
    for (i = 0; i < n; i++) { dist.push(INF); prev.push(-1); settled.push(false); }
    dist[src] = 0;

    var frames = [];
    function snap(extra) {
      var f = {
        names: names, pos: pos, edges: edges, source: src,
        dist: dist.slice(), prev: prev.slice(), settled: settled.slice(),
        current: -1, edge: null, improved: false, updated: -1, phase: "run", note: "",
      };
      for (var k in extra) f[k] = extra[k];
      frames.push(f);
    }

    snap({ phase: "init",
      note: "Dijkstra from source " + names[src] + ": set dist[" + names[src] +
        "] = 0; every other node starts at ∞ (no known path yet)." });

    for (var step = 0; step < n; step++) {
      var u = -1, cand = [];
      for (i = 0; i < n; i++) {
        if (settled[i]) continue;
        if (dist[i] < INF) cand.push(names[i] + "=" + dist[i]);
        if (dist[i] < (u < 0 ? INF : dist[u])) u = i;
      }
      if (u < 0) break; // remaining nodes unreachable
      settled[u] = true;
      snap({ phase: "pick", current: u,
        note: "Unvisited frontier: " + cand.join(", ") + ". " + names[u] +
          " has the smallest tentative distance — settle " + names[u] +
          " at " + dist[u] + "." });
      for (var j = 0; j < adj[u].length; j++) {
        var v = adj[u][j][0], wt = adj[u][j][1];
        if (settled[v]) continue;
        var nd = dist[u] + wt;
        if (nd < dist[v]) {
          var old = dist[v];
          dist[v] = nd; prev[v] = u;
          snap({ phase: "relax", current: u, edge: [u, v], improved: true, updated: v,
            note: "Relax " + names[u] + "–" + names[v] + " (weight " + wt + "): " +
              dist[u] + " + " + wt + " = " + nd + " beats " + fmt(old) +
              ", so dist[" + names[v] + "] ← " + nd + " via " + names[u] + "." });
        } else {
          snap({ phase: "relax", current: u, edge: [u, v], improved: false,
            note: "Relax " + names[u] + "–" + names[v] + " (weight " + wt + "): " +
              dist[u] + " + " + wt + " = " + nd + " does not beat " + fmt(dist[v]) +
              " — keep dist[" + names[v] + "] = " + fmt(dist[v]) + "." });
        }
      }
    }

    var parts = [];
    for (i = 0; i < n; i++) parts.push(names[i] + "=" + fmt(dist[i]));
    snap({ phase: "done",
      note: "All nodes settled. Shortest distances from " + names[src] + ": " +
        parts.join(", ") + ". The green edges form the shortest-path tree." });
    return frames;
  }

  function draw(ctx, f, view) {
    if (!f || !f.names) return;
    var w = view.w, h = view.h, c = view.colors;
    var n = f.names.length;

    // layout: graph on top, dist[] table strip along the bottom
    var tableH = Math.max(56, Math.min(76, h * 0.25));
    var r = Math.max(12, Math.min(20, (h - tableH) * 0.1));
    var padX = r + 26, padTop = r + 18, padBot = r + 22;
    var gx = padX, gy = padTop;
    var gw = w - padX * 2, gh = h - tableH - padTop - padBot;
    function nx(i) { return gx + f.pos[i][0] * gw; }
    function ny(i) { return gy + f.pos[i][1] * gh; }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineCap = "round";

    function edgeState(e) {
      var u = e[0], v = e[1];
      var active = !!(f.edge && ((f.edge[0] === u && f.edge[1] === v) ||
        (f.edge[0] === v && f.edge[1] === u)));
      var treeDone = (f.prev[u] === v && f.settled[u]) || (f.prev[v] === u && f.settled[v]);
      var treeTent = !treeDone && !active && (f.prev[u] === v || f.prev[v] === u);
      return { active: active, treeDone: treeDone, treeTent: treeTent };
    }

    // edge lines
    var i, e, st;
    for (i = 0; i < f.edges.length; i++) {
      e = f.edges[i];
      st = edgeState(e);
      ctx.beginPath();
      ctx.moveTo(nx(e[0]), ny(e[0]));
      ctx.lineTo(nx(e[1]), ny(e[1]));
      if (st.active) { ctx.strokeStyle = f.improved ? c.accent : c.warn; ctx.lineWidth = 3; }
      else if (st.treeDone) { ctx.strokeStyle = c.good; ctx.lineWidth = 2.5; }
      else if (st.treeTent) {
        ctx.strokeStyle = withAlpha(c.accent, 0.55); ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      } else { ctx.strokeStyle = c.line; ctx.lineWidth = 1.5; }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // edge weight pills (drawn after all lines so they stay readable)
    ctx.font = "600 11px ui-monospace, monospace";
    for (i = 0; i < f.edges.length; i++) {
      e = f.edges[i];
      st = edgeState(e);
      var mx = (nx(e[0]) + nx(e[1])) / 2, my = (ny(e[0]) + ny(e[1])) / 2;
      var label = String(e[2]);
      var lw2 = ctx.measureText(label).width;
      rr(ctx, mx - lw2 / 2 - 5, my - 9, lw2 + 10, 18, 6);
      ctx.fillStyle = c.card;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = st.active ? (f.improved ? c.accent : c.warn) :
        st.treeDone ? c.good : c.line;
      ctx.stroke();
      ctx.fillStyle = (st.active || st.treeDone) ? c.text : c.muted;
      ctx.fillText(label, mx, my + 0.5);
    }

    // nodes + distance labels
    for (i = 0; i < n; i++) {
      var x = nx(i), y = ny(i);
      var fill = c.card, stroke = c.line, lw = 1.5;
      if (f.settled[i]) { fill = withAlpha(c.good, 0.2); stroke = c.good; lw = 2; }
      if (i === f.current && f.phase !== "done") {
        fill = withAlpha(c.accent, 0.25); stroke = c.accent; lw = 2.5;
      }
      if (i === f.source) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = withAlpha(c.accent, 0.5);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke();
      ctx.font = "700 " + Math.round(r * 0.9) + "px -apple-system, system-ui, sans-serif";
      ctx.fillStyle = c.text;
      ctx.fillText(f.names[i], x, y + 1);

      // tentative-distance pill under the node
      var dl = fmt(f.dist[i]);
      var ly = y + r + 13;
      ctx.font = "700 12px ui-monospace, monospace";
      var dw = ctx.measureText(dl).width;
      var hot = (i === f.updated) ? c.good :
        (i === f.current && f.phase !== "done") ? c.accent : null;
      rr(ctx, x - dw / 2 - 5, ly - 8, dw + 10, 16, 5);
      ctx.fillStyle = c.card; ctx.fill();
      ctx.lineWidth = hot ? 1.5 : 1;
      ctx.strokeStyle = hot || c.line;
      ctx.stroke();
      ctx.fillStyle = hot || (f.dist[i] === INF ? c.muted : c.text);
      ctx.fillText(dl, x, ly + 0.5);
    }

    // legend, top-left
    var lx = 14;
    ctx.textAlign = "left";
    ctx.font = "600 10px -apple-system, system-ui, sans-serif";
    function chip(col, label) {
      ctx.beginPath();
      ctx.arc(lx + 4, 12, 4, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(col, 0.25); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = c.muted;
      ctx.fillText(label, lx + 12, 12.5);
      lx += 12 + ctx.measureText(label).width + 14;
    }
    chip(c.accent, "current");
    chip(c.good, "settled");
    ctx.beginPath();
    ctx.moveTo(lx, 12); ctx.lineTo(lx + 14, 12);
    ctx.lineWidth = 2.5; ctx.strokeStyle = c.good; ctx.stroke();
    ctx.fillStyle = c.muted;
    ctx.fillText("tree edge", lx + 20, 12.5);
    ctx.textAlign = "center";

    // dist[] table along the bottom
    var cw = Math.min(64, (w - 56) / n);
    var tx0 = (w - cw * n) / 2;
    var headY = h - tableH + 8;
    var cellY = h - tableH + 18;
    var cellH = tableH - 26;
    ctx.font = "600 10px ui-monospace, monospace";
    for (i = 0; i < n; i++) {
      ctx.fillStyle = (i === f.current && f.phase !== "done") ? c.accent : c.muted;
      ctx.fillText(f.names[i] + (i === f.source ? " (src)" : ""), tx0 + i * cw + cw / 2, headY);
    }
    for (i = 0; i < n; i++) {
      var cx1 = tx0 + i * cw;
      var cfill = c.card, cstroke = c.line, clw = 1;
      if (f.settled[i]) { cfill = withAlpha(c.good, 0.16); cstroke = withAlpha(c.good, 0.8); }
      if (i === f.current && f.phase !== "done") {
        cfill = withAlpha(c.accent, 0.2); cstroke = c.accent; clw = 2;
      }
      if (i === f.updated) { cfill = withAlpha(c.good, 0.28); cstroke = c.good; clw = 2; }
      rr(ctx, cx1 + 3, cellY, cw - 6, cellH, 7);
      ctx.fillStyle = cfill; ctx.fill();
      ctx.lineWidth = clw; ctx.strokeStyle = cstroke; ctx.stroke();
      ctx.font = "700 13px ui-monospace, monospace";
      ctx.fillStyle = f.dist[i] === INF ? c.muted : c.text;
      ctx.fillText(fmt(f.dist[i]), cx1 + cw / 2, cellY + cellH / 2 + 1);
      ctx.font = "600 10px ui-monospace, monospace";
    }
    if (tx0 >= 44) {
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.fillStyle = c.muted;
      ctx.fillText("dist", tx0 - 8, cellY + cellH / 2 + 1);
      ctx.textAlign = "center";
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
    var el = document.getElementById("algviz-advanced-graphs");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Dijkstra's shortest paths",
      aspect: 16 / 7,
      cases: [
        { name: "6-node graph, source A", input: {
          names: ["A", "B", "C", "D", "E", "F"],
          pos: [[0.05, 0.5], [0.3, 0.13], [0.3, 0.87], [0.62, 0.13], [0.62, 0.87], [0.95, 0.5]],
          edges: [[0, 1, 4], [0, 2, 2], [1, 2, 1], [1, 3, 5], [2, 3, 8], [2, 4, 10], [3, 4, 2], [3, 5, 6], [4, 5, 3]],
          source: 0,
        } },
        { name: "5-node graph, source 0", input: {
          names: ["0", "1", "2", "3", "4"],
          pos: [[0.08, 0.72], [0.3, 0.14], [0.5, 0.86], [0.72, 0.16], [0.94, 0.66]],
          edges: [[0, 1, 7], [0, 2, 3], [1, 2, 1], [1, 3, 2], [2, 3, 6], [3, 4, 4], [2, 4, 9]],
          source: 0,
        } },
        { name: "triangle + tail, source A", input: {
          names: ["A", "B", "C", "D"],
          pos: [[0.1, 0.5], [0.42, 0.12], [0.45, 0.85], [0.9, 0.6]],
          edges: [[0, 1, 1], [0, 2, 4], [1, 2, 2], [2, 3, 3]],
          source: 0,
        } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
