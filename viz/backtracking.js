/* Backtracking visualizer — subsets via include/exclude. Every subset of a
   set corresponds to one root-to-leaf path in a binary decision tree: at
   depth d we either exclude (left) or include (right) nums[d]. A depth-first
   walk, exclude branch first, visits the leaves left to right and emits every
   subset exactly once. Mirrors the AlgViz contract of binary-search.js. */
(function () {
  "use strict";

  function fmt(s) {
    return s.length ? "{" + s.join(", ") + "}" : "{ }";
  }

  function build(input) {
    var nums = input.nums;
    var n = nums.length;
    var total = 1 << n;
    var frames = [];
    var visited = []; // node ids in heap numbering: root = 1, children 2i / 2i+1
    var out = []; // completed subsets, in DFS order

    function snap(o) {
      frames.push({
        nums: nums,
        n: n,
        visited: visited.slice(),
        out: out.slice(),
        current: o.current || 0,
        phase: o.phase,
        justAdded: o.justAdded != null ? o.justAdded : -1,
        note: o.note,
      });
    }

    snap({
      current: 0,
      phase: "intro",
      note:
        "Every subset of [" + nums.join(", ") + "] is a string of " + n +
        " include/exclude decisions — one leaf of this binary tree. Walk it depth-first, exclude (left) before include (right).",
    });

    function dfs(id, depth, subset, enterNote) {
      visited.push(id);
      if (depth === n) {
        snap({ current: id, phase: "leaf", note: enterNote + " Leaf reached: all " + n + " decisions are made." });
        out.push(subset.slice());
        snap({
          current: id,
          phase: "record",
          justAdded: out.length - 1,
          note: "Record " + fmt(subset) + " as subset #" + out.length + " of " + total + ".",
        });
        return;
      }
      snap({ current: id, phase: "visit", note: enterNote + " Next decision: element " + nums[depth] + "." });
      var v = nums[depth];
      dfs(id * 2, depth + 1, subset, "Exclude " + v + " (left branch) — the subset stays " + fmt(subset) + ".");
      snap({
        current: id,
        phase: "back",
        note: "Backtrack to " + fmt(subset) + " — the exclude branch of " + v + " is fully explored. Now take the include branch.",
      });
      dfs(id * 2 + 1, depth + 1, subset.concat([v]), "Include " + v + " (right branch) — the subset becomes " + fmt(subset.concat([v])) + ".");
    }

    dfs(1, 0, [], "Start at the root with the empty subset " + fmt([]) + ".");

    snap({
      current: 0,
      phase: "done",
      note:
        "Done. The depth-first walk visited every node once and collected all " + total +
        " subsets of [" + nums.join(", ") + "] in left-to-right leaf order.",
    });
    return frames;
  }

  function depthOf(id) {
    var d = -1;
    while (id > 0) {
      id >>= 1;
      d++;
    }
    return d;
  }

  // Decode which elements a node's root path included from its heap id.
  function subsetOf(id, nums) {
    var d = depthOf(id);
    var s = [];
    for (var k = 0; k < d; k++) {
      if ((id >> (d - 1 - k)) & 1) s.push(nums[k]);
    }
    return s;
  }

  function draw(ctx, f, view) {
    if (!f || !f.nums) return;
    var c = view.colors, w = view.w, h = view.h;
    var nums = f.nums, n = f.n, total = 1 << n;

    var vis = {};
    for (var i = 0; i < f.visited.length; i++) vis[f.visited[i]] = true;
    var onPath = {};
    var a = f.current;
    while (a >= 1) {
      onPath[a] = true;
      a >>= 1;
    }

    // ---- layout ----
    var pad = 14;
    var pw = Math.max(96, Math.min(150, w * 0.24)); // output panel width
    var px = w - pad - pw;
    var gutter = 30; // left gutter for per-level element labels
    var tx0 = pad + gutter, tx1 = px - 16;
    var treeW = tx1 - tx0;
    var topY = 36, botY = h - 30;
    var gap = Math.min((botY - topY) / Math.max(n, 1), 110);
    var y0 = topY + (botY - topY - gap * n) / 2;
    var pillH = Math.min(20, gap * 0.45);

    function nodeX(id) {
      var d = depthOf(id);
      var slot = treeW / (1 << d);
      return tx0 + (id - (1 << d) + 0.5) * slot;
    }
    function nodeY(id) {
      return y0 + depthOf(id) * gap;
    }

    // ---- legend ----
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "11px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = c.muted;
    ctx.fillText("dashed left = exclude · solid right = include · DFS goes left first", pad, 15);

    // ---- per-level element labels ("which element is decided here?") ----
    ctx.font = "600 11px ui-monospace, monospace";
    for (var d = 1; d <= n; d++) {
      ctx.fillStyle = c.muted;
      ctx.fillText(nums[d - 1] + "?", pad, y0 + (d - 0.5) * gap);
    }

    // ---- edges ----
    for (var p = 1; p < (1 << n); p++) {
      for (var side = 0; side < 2; side++) {
        var ch = p * 2 + side;
        var pathEdge = onPath[p] && onPath[ch];
        ctx.beginPath();
        ctx.moveTo(nodeX(p), nodeY(p) + pillH / 2);
        ctx.lineTo(nodeX(ch), nodeY(ch) - pillH / 2);
        ctx.setLineDash(side === 0 ? [4, 3] : []);
        if (pathEdge) {
          ctx.strokeStyle = c.accent;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 1;
        } else if (vis[ch]) {
          ctx.strokeStyle = c.line;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.95;
        } else {
          ctx.strokeStyle = c.line;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.4;
        }
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // ---- nodes ----
    ctx.textAlign = "center";
    for (var id = 1; id < (1 << (n + 1)); id++) {
      var dep = depthOf(id);
      var slotW = treeW / (1 << dep);
      var isLeaf = dep === n;
      var leafIndex = isLeaf ? id - (1 << n) : -1;
      var recorded = isLeaf && leafIndex < f.out.length;
      var isCurrent = id === f.current;

      var s = subsetOf(id, nums);
      var compact = slotW < 46;
      var label = compact ? (s.length ? s.join("") : "∅") : (s.length ? "{" + s.join(",") + "}" : "{ }");
      var fs = 11;
      ctx.font = "600 " + fs + "px ui-monospace, monospace";
      while (fs > 8 && ctx.measureText(label).width > slotW - 8) {
        fs--;
        ctx.font = "600 " + fs + "px ui-monospace, monospace";
      }
      var pillW = Math.min(Math.max(ctx.measureText(label).width + 10, 18), Math.max(slotW - 4, 14));

      var fill = c.bg, stroke = c.line, txt = c.muted, lw = 1, alpha = 0.5;
      if (vis[id]) {
        fill = c.card; stroke = c.line; txt = c.text; alpha = 1;
      }
      if (recorded) {
        fill = withAlpha(c.good, 0.14); stroke = withAlpha(c.good, 0.75); txt = c.text; alpha = 1;
      }
      if (onPath[id] && !isCurrent) {
        fill = withAlpha(c.accent, 0.14); stroke = c.accent; txt = c.text; lw = 1.5; alpha = 1;
      }
      if (isCurrent) {
        var hot = f.phase === "record" ? c.good : c.accent;
        fill = withAlpha(hot, 0.26); stroke = hot; txt = c.text; lw = 2; alpha = 1;
      }

      var x = nodeX(id), y = nodeY(id);
      ctx.globalAlpha = alpha;
      rr(ctx, x - pillW / 2, y - pillH / 2, pillW, pillH, 6);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.fillStyle = txt;
      ctx.fillText(label, x, y + 1);
      ctx.globalAlpha = 1;

      // DFS visit-order badge under recorded leaves
      if (recorded) {
        ctx.fillStyle = leafIndex === f.justAdded ? c.good : c.muted;
        ctx.font = "600 9px ui-monospace, monospace";
        ctx.fillText("#" + (leafIndex + 1), x, y + pillH / 2 + 9);
      }
    }

    // ---- output panel ----
    var panelTop = 24, panelBot = h - 12;
    rr(ctx, px, panelTop, pw, panelBot - panelTop, 8);
    ctx.fillStyle = withAlpha(c.card, 0.55);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = f.phase === "done" ? c.good : c.line;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = "600 11px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = c.muted;
    ctx.fillText("subsets " + f.out.length + " / " + total, px + 8, panelTop + 12);

    var chipTop = panelTop + 24;
    var chipH = Math.min(20, Math.floor((panelBot - chipTop - 4) / total) - 4);
    var stride = chipH + 5;
    ctx.font = "600 10px ui-monospace, monospace";
    for (var k = 0; k < total; k++) {
      var cy = chipTop + k * stride;
      if (k < f.out.length) {
        var isNew = k === f.justAdded;
        rr(ctx, px + 6, cy, pw - 12, chipH, 5);
        ctx.fillStyle = isNew ? withAlpha(c.good, 0.22) : c.card;
        ctx.fill();
        ctx.lineWidth = isNew ? 1.5 : 1;
        ctx.strokeStyle = isNew ? c.good : c.line;
        ctx.stroke();
        ctx.fillStyle = c.muted;
        ctx.fillText("#" + (k + 1), px + 11, cy + chipH / 2 + 1);
        ctx.fillStyle = c.text;
        ctx.fillText(f.out[k].length ? "{" + f.out[k].join(",") + "}" : "{ }", px + 32, cy + chipH / 2 + 1);
      } else {
        ctx.setLineDash([3, 3]);
        rr(ctx, px + 6, cy, pw - 12, chipH, 5);
        ctx.strokeStyle = withAlpha(c.muted, 0.35);
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
    var el = document.getElementById("algviz-backtracking");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Subsets via include/exclude",
      aspect: 16 / 7,
      cases: [
        { name: "nums = [1, 2, 3] — 8 subsets", input: { nums: [1, 2, 3] } },
        { name: "nums = [1, 2] — 4 subsets", input: { nums: [1, 2] } },
        { name: "nums = [5] — 2 subsets", input: { nums: [5] } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
