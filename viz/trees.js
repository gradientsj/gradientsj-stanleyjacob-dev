/* Level-order (BFS) traversal visualizer. Mirrors the shape of
   viz/binary-search.js, the reference implementation of the AlgViz contract.
   Draws the binary tree with nodes at their levels, a queue panel on the
   right, and the visit order building up along the bottom. */
(function () {
  "use strict";

  /* Turn the per-level input (full rows, nulls for missing slots) into
     { nodes, edges, depth }. Node ids are assigned in level order. */
  function buildTree(levels) {
    var nodes = [], edges = [], idAt = [];
    for (var k = 0; k < levels.length; k++) {
      idAt.push([]);
      var row = levels[k] || [];
      var slots = 1 << k;
      for (var j = 0; j < slots; j++) {
        var val = j < row.length ? row[j] : null;
        var ok = val != null;
        if (ok && k > 0 && idAt[k - 1][j >> 1] < 0) ok = false;
        if (!ok) { idAt[k].push(-1); continue; }
        var id = nodes.length;
        nodes.push({ id: id, val: val, level: k, slot: j, kids: [] });
        idAt[k].push(id);
        if (k > 0) {
          var pid = idAt[k - 1][j >> 1];
          edges.push({ from: pid, to: id });
          nodes[pid].kids.push(id);
        }
      }
    }
    return { nodes: nodes, edges: edges, depth: levels.length, maxQ: 1 };
  }

  function build(input) {
    var t = buildTree(input.levels);
    var frames = [];
    var q = [0], visited = [], out = [];
    function qVals() {
      return q.map(function (id) { return t.nodes[id].val; }).join(", ");
    }
    function snap(current, just, phase, note) {
      frames.push({
        t: t, queue: q.slice(), visited: visited.slice(), current: current,
        just: just, out: out.slice(), phase: phase, note: note,
      });
    }
    snap(-1, [], "start",
      "Start: enqueue the root " + t.nodes[0].val + ". Queue = [" + qVals() + "]; visit order is empty.");
    while (q.length) {
      if (q.length > t.maxQ) t.maxQ = q.length;
      var cur = q.shift();
      var node = t.nodes[cur];
      out.push(node.val);
      snap(cur, [], "deq",
        "Dequeue " + node.val + " from the front and visit it — visit order is now [" + out.join(", ") + "].");
      var kids = node.kids;
      for (var i = 0; i < kids.length; i++) q.push(kids[i]);
      if (q.length > t.maxQ) t.maxQ = q.length;
      var kidVals = kids.map(function (id) { return t.nodes[id].val; });
      var qNote = q.length ? "Queue = [" + qVals() + "]." : "Queue is now empty.";
      if (kids.length) {
        snap(cur, kids.slice(), "enq",
          "Enqueue " + node.val + "'s " + (kids.length > 1 ? "children " : "child ") +
          kidVals.join(" and ") + " at the back. " + qNote);
      } else {
        snap(cur, [], "enq", node.val + " is a leaf — nothing to enqueue. " + qNote);
      }
      visited.push(cur);
    }
    snap(-1, [], "done",
      "Queue is empty, so the traversal is complete. Level order: [" + out.join(", ") + "].");
    return frames;
  }

  function draw(ctx, f, view) {
    var c = view.colors, w = view.w, h = view.h;
    var t = f.t, nodes = t.nodes;
    var pad = 14;
    var outH = Math.max(44, Math.round(h * 0.2));
    var panelW = Math.max(100, Math.min(150, Math.round(w * 0.24)));
    var areaX = pad, areaY = pad + 4;
    var areaW = w - panelW - pad * 3;
    var areaH = h - outH - areaY - 8;
    var sans = "-apple-system, system-ui, sans-serif";
    var mono = "ui-monospace, monospace";

    // ---- tree layout ----
    var labelW = 48;
    var cols = 1 << (t.depth - 1);
    var r = Math.min(22, areaH / (t.depth * 2.4), (areaW - labelW) / cols / 2.2);
    r = Math.max(8, r);
    var yTop = areaY + r + 4;
    var yGap = t.depth > 1 ? (areaH - 2 * r - 8) / (t.depth - 1) : 0;
    function nx(nd) {
      return areaX + labelW + (nd.slot + 0.5) * ((areaW - labelW) / (1 << nd.level));
    }
    function ny(nd) { return yTop + nd.level * yGap; }

    // level labels
    ctx.font = "10px " + mono;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = c.muted;
    for (var k = 0; k < t.depth; k++) ctx.fillText("level " + k, areaX, yTop + k * yGap);

    // edges (drawn from circle edge to circle edge)
    for (var e = 0; e < t.edges.length; e++) {
      var ed = t.edges[e];
      var a = nodes[ed.from], b = nodes[ed.to];
      var ax = nx(a), ay = ny(a), bx = nx(b), by = ny(b);
      var dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len;
      var hot = f.just.indexOf(ed.to) >= 0;
      ctx.beginPath();
      ctx.moveTo(ax + ux * r, ay + uy * r);
      ctx.lineTo(bx - ux * r, by - uy * r);
      ctx.strokeStyle = hot ? c.warn : c.line;
      ctx.lineWidth = hot ? 2 : 1.5;
      ctx.stroke();
    }

    // nodes
    ctx.textAlign = "center";
    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      var x = nx(nd), y = ny(nd);
      var inQ = f.queue.indexOf(nd.id) >= 0;
      var isJust = f.just.indexOf(nd.id) >= 0;
      var isCur = f.current === nd.id;
      var isVis = f.visited.indexOf(nd.id) >= 0;
      var fill = c.card, stroke = c.line, txt = c.muted, lw = 1.5;
      if (inQ) { fill = withAlpha(c.warn, isJust ? 0.3 : 0.16); stroke = c.warn; txt = c.text; lw = isJust ? 2 : 1.5; }
      if (isVis) { fill = withAlpha(c.good, 0.22); stroke = c.good; txt = c.text; }
      if (isCur) { fill = withAlpha(c.accent, 0.26); stroke = c.accent; txt = c.text; lw = 2.5; }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
      if (isCur) { // extra ring marks the node being visited
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = withAlpha(c.accent, 0.5); ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.fillStyle = txt;
      ctx.font = "600 " + Math.max(10, Math.round(r * 0.85)) + "px " + sans;
      ctx.fillText(String(nd.val), x, y + 1);
    }

    // ---- queue panel ----
    var px = w - panelW - pad, py = areaY, pw = panelW, ph = areaH;
    rr(ctx, px, py, pw, ph, 10);
    ctx.fillStyle = c.soft; ctx.fill();
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = "600 11px " + mono;
    ctx.fillStyle = c.muted;
    ctx.textAlign = "center";
    ctx.fillText("queue", px + pw / 2, py + 14);
    var maxQ = Math.max(1, t.maxQ);
    var boxGap = 6;
    var boxH = Math.max(12, Math.min(30, (ph - 28 - 8 - (maxQ - 1) * boxGap) / maxQ));
    var boxW = Math.min(56, pw - 56);
    var boxX = px + pw - boxW - 10;
    if (!f.queue.length) {
      ctx.fillStyle = c.muted;
      ctx.font = "11px " + mono;
      ctx.fillText("(empty)", px + pw / 2, py + ph / 2);
    }
    for (var qi = 0; qi < f.queue.length; qi++) {
      var qy = py + 24 + qi * (boxH + boxGap);
      if (qy + boxH > py + ph - 4) { // never draw past the panel
        ctx.fillStyle = c.muted;
        ctx.textAlign = "center";
        ctx.fillText("…", boxX + boxW / 2, py + ph - 8);
        break;
      }
      var qn = nodes[f.queue[qi]];
      var qJust = f.just.indexOf(qn.id) >= 0;
      rr(ctx, boxX, qy, boxW, boxH, 7);
      ctx.fillStyle = withAlpha(c.warn, qJust ? 0.3 : 0.14); ctx.fill();
      ctx.strokeStyle = c.warn; ctx.lineWidth = qJust ? 2 : 1; ctx.stroke();
      ctx.fillStyle = c.text;
      ctx.font = "600 " + Math.max(10, Math.round(boxH * 0.55)) + "px " + sans;
      ctx.textAlign = "center";
      ctx.fillText(String(qn.val), boxX + boxW / 2, qy + boxH / 2 + 1);
      ctx.font = "10px " + mono;
      ctx.fillStyle = c.muted;
      ctx.textAlign = "left";
      if (qi === 0) ctx.fillText("front →", px + 8, qy + boxH / 2);
      else if (qi === f.queue.length - 1) ctx.fillText("back →", px + 8, qy + boxH / 2);
    }

    // ---- visit-order row ----
    var cy = h - outH / 2 - 2;
    ctx.font = "600 11px " + mono;
    ctx.fillStyle = c.muted;
    ctx.textAlign = "left";
    ctx.fillText("visit order", pad, cy);
    var rowLabelW = 78;
    var n = nodes.length;
    var slotW = Math.min(36, (w - pad * 2 - rowLabelW) / n);
    var slotH = Math.min(30, outH - 14);
    var sx0 = pad + rowLabelW;
    for (var s = 0; s < n; s++) {
      var sx = sx0 + s * slotW;
      if (s < f.out.length) {
        var newest = s === f.out.length - 1 && f.current >= 0;
        rr(ctx, sx, cy - slotH / 2, slotW - 5, slotH, 7);
        ctx.fillStyle = withAlpha(newest ? c.accent : c.good, newest ? 0.26 : 0.22);
        ctx.fill();
        ctx.strokeStyle = newest ? c.accent : c.good;
        ctx.lineWidth = newest ? 2 : 1;
        ctx.stroke();
        ctx.fillStyle = c.text;
        ctx.font = "600 " + Math.max(10, Math.round(slotH * 0.5)) + "px " + sans;
        ctx.textAlign = "center";
        ctx.fillText(String(f.out[s]), sx + (slotW - 5) / 2, cy + 1);
        ctx.textAlign = "left";
      } else {
        ctx.setLineDash([4, 3]);
        rr(ctx, sx, cy - slotH / 2, slotW - 5, slotH, 7);
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
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
    var el = document.getElementById("algviz-trees");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Level-order traversal (BFS)",
      aspect: 16 / 7,
      cases: [
        { name: "tree [3, 9, 20, null, null, 15, 7]",
          input: { levels: [[3], [9, 20], [null, null, 15, 7]] } },
        { name: "perfect tree [1..7]",
          input: { levels: [[1], [2, 3], [4, 5, 6, 7]] } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
