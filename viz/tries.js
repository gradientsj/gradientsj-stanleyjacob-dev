/* Trie insert & search visualizer. Mirrors the AlgViz contract established by
   viz/binary-search.js: build() turns an input into frames, draw() renders one
   frame with Canvas 2D in CSS pixels, colors come only from view.colors. */
(function () {
  "use strict";

  /* ---- trie construction + tidy top-down layout ------------------------- */

  function childOf(nodes, id, ch) {
    var kids = nodes[id].children;
    for (var i = 0; i < kids.length; i++) if (nodes[kids[i]].ch === ch) return kids[i];
    return -1;
  }

  function assignX(nodes, id, slot) {
    var nd = nodes[id];
    if (!nd.children.length) {
      nd.x = slot.next++;
      return;
    }
    for (var i = 0; i < nd.children.length; i++) assignX(nodes, nd.children[i], slot);
    var first = nodes[nd.children[0]].x;
    var last = nodes[nd.children[nd.children.length - 1]].x;
    nd.x = (first + last) / 2;
  }

  function makeTrie(words) {
    var nodes = [{ id: 0, ch: "", parent: -1, depth: 0, children: [] }];
    for (var w = 0; w < words.length; w++) {
      var cur = 0;
      for (var i = 0; i < words[w].length; i++) {
        var ch = words[w][i];
        var kid = childOf(nodes, cur, ch);
        if (kid < 0) {
          kid = nodes.length;
          nodes.push({ id: kid, ch: ch, parent: cur, depth: nodes[cur].depth + 1, children: [] });
          nodes[cur].children.push(kid);
        }
        cur = kid;
      }
    }
    assignX(nodes, 0, { next: 0 });
    var maxDepth = 1, minX = nodes[0].x, maxX = nodes[0].x;
    for (var j = 0; j < nodes.length; j++) {
      if (nodes[j].depth > maxDepth) maxDepth = nodes[j].depth;
      if (nodes[j].x < minX) minX = nodes[j].x;
      if (nodes[j].x > maxX) maxX = nodes[j].x;
    }
    return { nodes: nodes, maxDepth: maxDepth, minX: minX, maxX: maxX };
  }

  function nodeName(nodes, id) {
    return id === 0 ? "the root" : "node '" + nodes[id].ch + "'";
  }

  /* ---- build: input -> frames ------------------------------------------ */

  function build(input) {
    var words = input.words, target = input.search;
    var trie = makeTrie(words);
    var nodes = trie.nodes;
    var frames = [];
    var created = [];
    var ends = [];
    created[0] = true;

    function snap(extra) {
      var f = {
        trie: trie, words: words, target: target,
        visible: created.slice(), ends: ends.slice(),
        path: [0], cur: -1, fresh: -1, wi: -1, word: null, ci: -1,
        miss: false, phantom: null, verdict: null, phase: "insert", note: "",
      };
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) f[k] = extra[k];
      frames.push(f);
    }

    snap({
      phase: "intro",
      note: "An empty trie: just a root node. Insert " + words.join(", ") +
        ", then search for \"" + target + "\".",
    });

    for (var w = 0; w < words.length; w++) {
      var word = words[w];
      var path = [0], cur = 0;
      snap({ wi: w, word: word, cur: 0, path: path.slice(),
        note: "Insert \"" + word + "\": start at the root and walk down one letter at a time." });
      for (var i = 0; i < word.length; i++) {
        var ch = word[i];
        var kid = childOf(nodes, cur, ch);
        var isNew = !created[kid];
        created[kid] = true;
        var parentName = nodeName(nodes, cur);
        cur = kid;
        path.push(kid);
        snap({ wi: w, word: word, ci: i, cur: cur, path: path.slice(), fresh: isNew ? cur : -1,
          note: isNew
            ? "'" + ch + "': " + parentName + " has no child '" + ch + "' — create a new node."
            : "'" + ch + "': " + parentName + " already has a child '" + ch + "' — reuse it and step down." });
      }
      ends[cur] = true;
      snap({ wi: w, word: word, ci: word.length, cur: cur, path: path.slice(),
        note: "\"" + word + "\" is fully inserted — mark this node as end-of-word (double ring)." });
    }

    snap({ wi: words.length,
      note: "All " + words.length + " words are stored. Shared prefixes (like \"ca\") share nodes; double rings mark word ends." });

    var spath = [0], scur = 0, failed = false;
    snap({ phase: "search", word: target, cur: 0, path: spath.slice(),
      note: "Search \"" + target + "\": start back at the root and try to match every letter downward." });
    for (var j = 0; j < target.length && !failed; j++) {
      var sch = target[j];
      var next = childOf(nodes, scur, sch);
      if (next < 0) {
        failed = true;
        snap({ phase: "search", word: target, ci: j, cur: scur, path: spath.slice(),
          miss: true, phantom: { parent: scur, ch: sch },
          note: "'" + sch + "': " + nodeName(nodes, scur) + " has no child '" + sch +
            "'. \"" + target + "\" falls off the trie." });
        snap({ phase: "search", word: target, ci: j, cur: scur, path: spath.slice(),
          miss: true, phantom: { parent: scur, ch: sch }, verdict: "missing",
          note: "Result: \"" + target + "\" is NOT in the trie — the path for it does not exist." });
      } else {
        scur = next;
        spath.push(next);
        snap({ phase: "search", word: target, ci: j, cur: scur, path: spath.slice(),
          note: "'" + sch + "': " + nodeName(nodes, nodes[scur].parent) + " has that edge — follow it down." });
      }
    }
    if (!failed) {
      if (ends[scur]) {
        snap({ phase: "search", word: target, ci: target.length, cur: scur, path: spath.slice(),
          verdict: "found",
          note: "Every letter matched and the final node is marked end-of-word — \"" + target + "\" IS in the trie." });
      } else {
        snap({ phase: "search", word: target, ci: target.length, cur: scur, path: spath.slice(),
          verdict: "prefix",
          note: "Every letter matched, but node '" + nodes[scur].ch + "' is not marked end-of-word — \"" +
            target + "\" is only a prefix of a stored word, not a word itself." });
      }
    }
    return frames;
  }

  /* ---- draw: render one frame ------------------------------------------ */

  function draw(ctx, f, view) {
    var c = view.colors, w = view.w, h = view.h;
    var trie = f.trie, nodes = trie.nodes;
    var s = Math.max(0.6, Math.min(1.35, Math.min(w / 560, h / 315)));
    var pad = 12 * s;
    var headCy = 20 * s, chipH = 20 * s;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var chipFont = Math.max(9, Math.round(11 * s));
    ctx.font = "600 " + chipFont + "px ui-monospace, monospace";

    // phase badge
    var badgeTxt = f.phase === "search" ? "search" : f.phase === "intro" ? "trie" : "insert";
    var badgeCol = f.phase === "search" ? c.pool[4] : f.phase === "intro" ? c.muted : c.accent;
    var cx = pad;
    var bw = ctx.measureText(badgeTxt).width + 14 * s;
    rr(ctx, cx, headCy - chipH / 2, bw, chipH, 6 * s);
    ctx.fillStyle = withAlpha(badgeCol, 0.16);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = badgeCol;
    ctx.stroke();
    ctx.fillStyle = badgeCol;
    ctx.fillText(badgeTxt, cx + bw / 2, headCy + 0.5);
    cx += bw + 10 * s;

    // word chips: the insert list, colored by progress
    var allDone = f.phase !== "insert" && f.phase !== "intro";
    for (var i = 0; i < f.words.length; i++) {
      var tw = ctx.measureText(f.words[i]).width + 12 * s;
      var done = allDone || i < f.wi;
      var current = f.phase === "insert" && i === f.wi;
      rr(ctx, cx, headCy - chipH / 2, tw, chipH, 6 * s);
      ctx.fillStyle = done ? withAlpha(c.good, 0.12) : current ? withAlpha(c.accent, 0.14) : "rgba(0,0,0,0)";
      ctx.fill();
      ctx.strokeStyle = done ? withAlpha(c.good, 0.7) : current ? c.accent : c.line;
      ctx.lineWidth = current ? 1.5 : 1;
      ctx.stroke();
      ctx.fillStyle = done || current ? c.text : c.muted;
      ctx.fillText(f.words[i], cx + tw / 2, headCy + 0.5);
      cx += tw + 6 * s;
    }

    // active word letter cells, right-aligned
    if (f.word) {
      var n = f.word.length, cw = 17 * s, gap = 3 * s;
      var lx = w - pad - (n * cw + (n - 1) * gap);
      var doneCol = f.phase === "search" ? c.good : c.accent;
      for (var j = 0; j < n; j++) {
        var x = lx + j * (cw + gap);
        var fill = "rgba(0,0,0,0)", stroke = c.line, txt = c.muted;
        if (j < f.ci) { fill = withAlpha(doneCol, 0.16); stroke = withAlpha(doneCol, 0.8); txt = c.text; }
        else if (j === f.ci) {
          var cc = f.miss ? c.bad : f.verdict === "prefix" ? c.warn : doneCol;
          fill = withAlpha(cc, 0.28); stroke = cc; txt = c.text;
        }
        rr(ctx, x, headCy - chipH / 2, cw, chipH, 5 * s);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = j === f.ci ? 1.5 : 1;
        ctx.strokeStyle = stroke;
        ctx.stroke();
        ctx.fillStyle = txt;
        ctx.fillText(f.word[j], x + cw / 2, headCy + 0.5);
      }
    }

    // ---- tree geometry ----
    var top = 66 * s;
    var bottom = h - 24 * s;
    var levelH = (bottom - top) / Math.max(1, trie.maxDepth);
    var span = Math.max(1, trie.maxX - trie.minX);
    var inner = w - 2 * (pad + 20 * s);
    var unit = Math.min(inner / span, 130 * s);
    var x0 = (w - unit * span) / 2;
    var r = Math.max(8, Math.min(17 * s, levelH * 0.32, unit * 0.4));
    function nx(nd) { return x0 + (nd.x - trie.minX) * unit; }
    function ny(nd) { return top + nd.depth * levelH; }
    function onPath(id) { return f.path.indexOf(id) >= 0; }

    var dimming = f.phase === "search";

    // edges (letter labels beside them)
    var edgeFont = Math.max(9, Math.round(10 * s));
    for (var e = 1; e < nodes.length; e++) {
      if (!f.visible[e]) continue;
      var nd = nodes[e], pa = nodes[nd.parent];
      var hot = onPath(e);
      var freshE = e === f.fresh;
      ctx.globalAlpha = dimming && !hot ? 0.4 : 1;
      ctx.beginPath();
      ctx.moveTo(nx(pa), ny(pa));
      ctx.lineTo(nx(nd), ny(nd));
      ctx.lineWidth = hot || freshE ? 2 : 1.25;
      ctx.strokeStyle = freshE ? c.good : hot ? c.accent : c.line;
      ctx.stroke();
      // letter label, offset perpendicular so the line does not strike it
      var dx = nx(nd) - nx(pa), dy = ny(nd) - ny(pa);
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var mx = (nx(pa) + nx(nd)) / 2 - (dy / len) * 9 * s;
      var my = (ny(pa) + ny(nd)) / 2 + (dx / len) * 9 * s;
      ctx.font = "600 " + edgeFont + "px ui-monospace, monospace";
      ctx.fillStyle = freshE ? c.good : hot ? c.accent : c.muted;
      ctx.fillText(nd.ch, mx, my);
      ctx.globalAlpha = 1;
    }

    // phantom node for a failed search step
    if (f.phantom) {
      var ppa = nodes[f.phantom.parent];
      var px = Math.min(nx(ppa) + unit * 0.75, w - pad - r);
      var py = Math.min(ny(ppa) + levelH, h - r - 4);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(nx(ppa), ny(ppa));
      ctx.lineTo(px, py);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = c.bad;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(c.bad, 0.12);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "700 " + Math.max(10, Math.round(r * 0.95)) + "px -apple-system, system-ui, sans-serif";
      ctx.fillStyle = c.bad;
      ctx.fillText(f.phantom.ch + "?", px, py + 1);
    }

    // nodes
    var nodeFont = "700 " + Math.max(10, Math.round(r * 0.95)) + "px -apple-system, system-ui, sans-serif";
    for (var k = 0; k < nodes.length; k++) {
      if (!f.visible[k]) continue;
      var node = nodes[k];
      var x2 = nx(node), y2 = ny(node);
      var hot2 = onPath(k);
      var isCur = k === f.cur;
      var isEnd = !!f.ends[k];
      var fill2 = k === 0 ? c.soft : c.card, stroke2 = c.line, lw = 1.25;
      if (isEnd) { fill2 = withAlpha(c.good, 0.13); stroke2 = withAlpha(c.good, 0.8); }
      if (hot2) { stroke2 = c.accent; lw = 2; if (!isEnd) fill2 = withAlpha(c.accent, 0.1); }
      if (isCur) { fill2 = withAlpha(c.accent, 0.24); stroke2 = c.accent; lw = 2.5; }
      if (k === f.fresh) { fill2 = withAlpha(c.good, 0.26); stroke2 = c.good; }
      if (isCur && f.verdict === "found") { fill2 = withAlpha(c.good, 0.32); stroke2 = c.good; }
      if (isCur && f.verdict === "prefix") { fill2 = withAlpha(c.warn, 0.3); stroke2 = c.warn; }
      ctx.globalAlpha = dimming && !hot2 ? 0.4 : 1;
      ctx.beginPath();
      ctx.arc(x2, y2, r, 0, Math.PI * 2);
      ctx.fillStyle = fill2;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke2;
      ctx.stroke();
      if (isEnd) { // end-of-word marker: inner second ring
        ctx.beginPath();
        ctx.arc(x2, y2, Math.max(3, r - 3.5), 0, Math.PI * 2);
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = f.verdict === "found" && isCur ? c.good : withAlpha(c.good, 0.9);
        ctx.stroke();
      }
      if (k === 0) {
        ctx.font = "600 " + Math.max(9, Math.round(10 * s)) + "px ui-monospace, monospace";
        ctx.fillStyle = c.muted;
        ctx.fillText("root", x2, y2 - r - 8 * s);
      } else {
        ctx.font = nodeFont;
        ctx.fillStyle = c.text;
        ctx.fillText(node.ch, x2, y2 + 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---- shared helpers (same as the reference visualizer) ---------------- */

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
    var el = document.getElementById("algviz-tries");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Trie insert & search",
      aspect: 16 / 9,
      cases: [
        { name: "insert 4 words, search \"car\" — found", input: { words: ["cat", "car", "card", "dog"], search: "car" } },
        { name: "search \"care\" — falls off the trie", input: { words: ["cat", "car", "card", "dog"], search: "care" } },
        { name: "search \"do\" — prefix, not a word", input: { words: ["cat", "car", "card", "dog"], search: "do" } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
