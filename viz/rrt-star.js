/* RRT* tree growth, rewiring, and informed sampling, run live in the browser.

   This is a faithful 2D reimplementation of the planner in
   github.com/gradientsj/aerial-autonomy-lab, kept deliberately small so the
   algorithm is readable rather than hidden behind an engine. The published
   numbers on this page come from the C++ core, not from this file. What this
   file is for is showing the mechanism: where samples land, which parent a new
   node picks, which existing edges get rewired, and how the informed ellipse
   collapses once a solution exists.

   One genuine difference from the C++ core, worth knowing. Here the obstacles
   are analytic discs and boxes, so the distance field is exact and therefore
   exactly 1-Lipschitz, and the sphere trace can stride by the full clearance.
   The C++ core queries a trilinear interpolant of a voxel grid, whose gradient
   norm reaches sqrt(3), so its strides are divided by sqrt(3) to stay sound. */
(function () {
  "use strict";

  /* ---------- deterministic PRNG (mulberry32) ---------- */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- worlds ---------- */
  var W = 100, H = 60;

  function forestWorld(seed) {
    var r = rng(seed), obs = [], tries = 0;
    while (obs.length < 26 && tries < 4000) {
      tries++;
      var c = { x: 8 + r() * (W - 16), y: 4 + r() * (H - 8), r: 2.6 + r() * 3.4 };
      // Keep the start and goal corridors clear so every case is solvable.
      if (Math.hypot(c.x - 6, c.y - 30) < c.r + 5) continue;
      if (Math.hypot(c.x - 94, c.y - 30) < c.r + 5) continue;
      var ok = true;
      for (var i = 0; i < obs.length; i++) {
        if (Math.hypot(c.x - obs[i].x, c.y - obs[i].y) < c.r + obs[i].r + 1.5) { ok = false; break; }
      }
      if (ok) obs.push(c);
    }
    return { discs: obs, boxes: [] };
  }

  function windowWorld() {
    // A wall across the map with one gap. The gap sits deliberately off the
    // straight line between start and goal. Putting it on the line would let
    // the first solution equal the straight-line lower bound immediately, and
    // the informed ellipse would collapse to a degenerate segment before it had
    // shown anything. Forcing a detour keeps the ellipse a real ellipse that
    // visibly tightens as the incumbent improves.
    return {
      discs: [],
      boxes: [
        { x0: 48, y0: 0, x1: 54, y1: 6 },
        { x0: 48, y0: 16, x1: 54, y1: H },
      ],
    };
  }

  /* ---------- exact signed distance to the obstacle set ---------- */
  function sdf(world, x, y) {
    var best = 1e9, i;
    for (i = 0; i < world.discs.length; i++) {
      var d = world.discs[i];
      best = Math.min(best, Math.hypot(x - d.x, y - d.y) - d.r);
    }
    for (i = 0; i < world.boxes.length; i++) {
      var b = world.boxes[i];
      // Distance from a point to an axis-aligned box, negative inside.
      var dx = Math.max(b.x0 - x, 0, x - b.x1);
      var dy = Math.max(b.y0 - y, 0, y - b.y1);
      var outside = Math.hypot(dx, dy);
      var inside = Math.min(0, Math.max(Math.max(b.x0 - x, x - b.x1), Math.max(b.y0 - y, y - b.y1)));
      best = Math.min(best, outside > 0 ? outside : inside);
    }
    // Treat the map border as solid so the tree cannot escape.
    best = Math.min(best, x, y, W - x, H - y);
    return best;
  }

  // Sphere trace. The analytic field above is exactly 1-Lipschitz, so striding
  // by the full clearance can never step over a violation.
  function edgeFree(world, ax, ay, bx, by, clear) {
    var L = Math.hypot(bx - ax, by - ay);
    if (L === 0) return sdf(world, ax, ay) >= clear;
    var ux = (bx - ax) / L, uy = (by - ay) / L, t = 0, guard = 0;
    while (t <= L) {
      if (++guard > 2000) return false;
      var slack = sdf(world, ax + ux * t, ay + uy * t) - clear;
      if (slack < 1e-3) return false;
      t += slack;
    }
    return true;
  }

  /* ---------- the planner ---------- */
  function build(input) {
    var world = input.world;
    var rand = rng(input.seed);
    var start = input.start, goal = input.goal;
    var step = 6.0, clear = 1.1, goalTol = 3.0, goalBias = 0.06;
    var iters = input.iters || 900;
    var frames = [], stride = Math.max(1, Math.round(iters / 70));

    var nx = [start.x], ny = [start.y], parent = [-1], cost = [0], kids = [[]];
    var bestNode = -1, bestCost = Infinity;
    var curve = [];  // [iteration, best cost] for the anytime plot
    var cMin = Math.hypot(goal.x - start.x, goal.y - start.y);

    function nearest(x, y) {
      var bi = 0, bd = Infinity;
      for (var i = 0; i < nx.length; i++) {
        var d = (nx[i] - x) * (nx[i] - x) + (ny[i] - y) * (ny[i] - y);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }

    function radius(n) {
      // r(n) = min( gamma (log n / n)^(1/d), eta ) with d = 2 here. The
      // exponent is 1/d, and the log is what keeps the graph connected.
      var gamma = 46.0;
      return Math.min(gamma * Math.sqrt(Math.log(n) / n), step * 2.2);
    }

    function propagate(node, delta) {
      var stack = [node];
      while (stack.length) {
        var u = stack.pop();
        for (var i = 0; i < kids[u].length; i++) {
          cost[kids[u][i]] += delta;
          stack.push(kids[u][i]);
        }
      }
    }

    function snapshot(note, highlight, sampleAt) {
      frames.push({
        n: nx.length,
        px: nx.slice(), py: ny.slice(), par: parent.slice(), cst: cost.slice(),
        best: bestNode, bestCost: bestCost,
        curve: curve.slice(),
        rewired: highlight || [],
        sample: sampleAt || null,
        note: note,
      });
    }

    snapshot("Start. The tree holds one node, at the launch point.", [], null);

    for (var it = 0; it < iters; it++) {
      // --- sample ---
      var sx, sy;
      if (rand() < goalBias) {
        sx = goal.x; sy = goal.y;
      } else if (input.informed && bestNode >= 0 && bestCost > cMin) {
        // Direct sampling of the ellipse with foci at start and goal, whose
        // major axis is bestCost. Every point outside it provably cannot
        // improve the incumbent, so sampling there is wasted work.
        var a = bestCost / 2;
        var b = Math.sqrt(Math.max(0, bestCost * bestCost - cMin * cMin)) / 2;
        var th = rand() * Math.PI * 2, rr = Math.sqrt(rand());
        var ex = a * rr * Math.cos(th), ey = b * rr * Math.sin(th);
        var ang = Math.atan2(goal.y - start.y, goal.x - start.x);
        sx = (start.x + goal.x) / 2 + ex * Math.cos(ang) - ey * Math.sin(ang);
        sy = (start.y + goal.y) / 2 + ex * Math.sin(ang) + ey * Math.cos(ang);
      } else {
        sx = rand() * W; sy = rand() * H;
      }

      // --- extend ---
      var ni = nearest(sx, sy);
      var dx = sx - nx[ni], dy = sy - ny[ni], L = Math.hypot(dx, dy);
      if (L < 1e-9) continue;
      var scale = Math.min(step, L) / L;
      var px = nx[ni] + dx * scale, py = ny[ni] + dy * scale;
      if (px < 0 || py < 0 || px > W || py > H) continue;
      if (!edgeFree(world, nx[ni], ny[ni], px, py, clear)) continue;

      // --- near set and parent choice ---
      var r = radius(nx.length + 1), near = [];
      if (input.rewire) {
        for (var i = 0; i < nx.length; i++) {
          if (Math.hypot(nx[i] - px, ny[i] - py) <= r) near.push(i);
        }
      }
      var par = ni, bc = cost[ni] + Math.hypot(px - nx[ni], py - ny[ni]);
      for (var j = 0; j < near.length; j++) {
        var k = near[j];
        var c = cost[k] + Math.hypot(px - nx[k], py - ny[k]);
        if (c < bc && edgeFree(world, nx[k], ny[k], px, py, clear)) { bc = c; par = k; }
      }

      var id = nx.length;
      nx.push(px); ny.push(py); parent.push(par); cost.push(bc); kids.push([]);
      kids[par].push(id);

      // --- rewire ---
      var rewired = [];
      if (input.rewire) {
        for (var m = 0; m < near.length; m++) {
          var q = near[m];
          if (q === par || q === id) continue;
          var through = bc + Math.hypot(px - nx[q], py - ny[q]);
          if (through < cost[q] && edgeFree(world, px, py, nx[q], ny[q], clear)) {
            var op = parent[q];
            if (op >= 0) {
              var sib = kids[op], w = sib.indexOf(q);
              if (w >= 0) sib.splice(w, 1);
            }
            var delta = through - cost[q];
            parent[q] = id; cost[q] = through; kids[id].push(q);
            propagate(q, delta);
            rewired.push(q);
          }
        }
      }

      // --- goal ---
      var dg = Math.hypot(px - goal.x, py - goal.y);
      if (dg <= goalTol && edgeFree(world, px, py, goal.x, goal.y, clear)) {
        var total = cost[id] + dg;
        if (total < bestCost) { bestCost = total; bestNode = id; curve.push([it, total]); }
      } else if (bestNode >= 0) {
        var refreshed = cost[bestNode] + Math.hypot(nx[bestNode] - goal.x, ny[bestNode] - goal.y);
        if (refreshed < bestCost - 1e-9) { bestCost = refreshed; curve.push([it, refreshed]); }
      }

      if (it % stride === 0 || rewired.length > 2) {
        var note;
        if (bestNode < 0) {
          note = "Growing. " + nx.length + " nodes, no route to the goal yet.";
        } else if (rewired.length) {
          note = "Rewired " + rewired.length + " edge" + (rewired.length > 1 ? "s" : "") +
                 " through the new node. Best route " + bestCost.toFixed(1) + " m.";
        } else {
          note = nx.length + " nodes. Best route " + bestCost.toFixed(1) +
                 " m against a straight-line bound of " + cMin.toFixed(1) + " m.";
        }
        snapshot(note, rewired, { x: sx, y: sy });
      }
    }

    var tail = bestNode >= 0
      ? "Converged. Best route " + bestCost.toFixed(1) + " m, a " +
        ((bestCost / cMin - 1) * 100).toFixed(0) + "% gap over the straight-line lower bound."
      : "No route found within the sample budget.";
    snapshot(tail, [], null);
    return frames;
  }

  /* ---------- drawing ---------- */
  function withAlpha(hex, a) {
    var h = (hex || "").trim();
    if (h.charAt(0) !== "#" || (h.length !== 7 && h.length !== 4)) return h;
    if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    var n = parseInt(h.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function draw(ctx, f, view) {
    var c = view.colors, input = view.input;
    var pad = 10;
    var plotW = Math.min(190, Math.max(120, view.w * 0.26));
    var mapW = view.w - plotW - pad * 3;
    var mapH = view.h - pad * 2;
    var s = Math.min(mapW / W, mapH / H);
    var ox = pad + (mapW - W * s) / 2;
    var oy = pad + (mapH - H * s) / 2;
    function X(x) { return ox + x * s; }
    function Y(y) { return oy + y * s; }

    ctx.fillStyle = c.card;
    ctx.fillRect(ox, oy, W * s, H * s);
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, W * s, H * s);

    // obstacles
    var world = input.world, i;
    ctx.fillStyle = withAlpha(c.muted, 0.42);
    ctx.strokeStyle = withAlpha(c.muted, 0.75);
    for (i = 0; i < world.discs.length; i++) {
      var d = world.discs[i];
      ctx.beginPath();
      ctx.arc(X(d.x), Y(d.y), d.r * s, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    for (i = 0; i < world.boxes.length; i++) {
      var b = world.boxes[i];
      ctx.fillRect(X(b.x0), Y(b.y0), (b.x1 - b.x0) * s, (b.y1 - b.y0) * s);
      ctx.strokeRect(X(b.x0), Y(b.y0), (b.x1 - b.x0) * s, (b.y1 - b.y0) * s);
    }

    // informed ellipse
    if (input.informed && f.best >= 0 && isFinite(f.bestCost)) {
      var cMin = Math.hypot(input.goal.x - input.start.x, input.goal.y - input.start.y);
      if (f.bestCost > cMin) {
        var a = f.bestCost / 2;
        var bb = Math.sqrt(Math.max(0, f.bestCost * f.bestCost - cMin * cMin)) / 2;
        var ang = Math.atan2(input.goal.y - input.start.y, input.goal.x - input.start.x);
        ctx.save();
        ctx.translate(X((input.start.x + input.goal.x) / 2), Y((input.start.y + input.goal.y) / 2));
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.ellipse(0, 0, a * s, bb * s, 0, 0, Math.PI * 2);
        ctx.strokeStyle = withAlpha(c.warn, 0.9);
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // tree edges, shaded by cost to come
    var maxCost = 1e-6;
    for (i = 0; i < f.n; i++) if (f.cst[i] > maxCost) maxCost = f.cst[i];
    ctx.lineWidth = 1;
    for (i = 1; i < f.n; i++) {
      var p = f.par[i];
      if (p < 0) continue;
      var t = Math.min(1, f.cst[i] / maxCost);
      ctx.strokeStyle = withAlpha(c.accent, 0.20 + 0.45 * (1 - t));
      ctx.beginPath();
      ctx.moveTo(X(f.px[p]), Y(f.py[p]));
      ctx.lineTo(X(f.px[i]), Y(f.py[i]));
      ctx.stroke();
    }

    // rewired edges this step
    if (f.rewired && f.rewired.length) {
      ctx.strokeStyle = c.bad;
      ctx.lineWidth = 2.4;
      for (i = 0; i < f.rewired.length; i++) {
        var q = f.rewired[i], pq = f.par[q];
        if (pq < 0) continue;
        ctx.beginPath();
        ctx.moveTo(X(f.px[pq]), Y(f.py[pq]));
        ctx.lineTo(X(f.px[q]), Y(f.py[q]));
        ctx.stroke();
      }
    }

    // the sample that produced this step
    if (f.sample) {
      ctx.fillStyle = withAlpha(c.warn, 0.9);
      ctx.beginPath();
      ctx.arc(X(f.sample.x), Y(f.sample.y), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // best path
    if (f.best >= 0) {
      ctx.strokeStyle = c.good;
      ctx.lineWidth = 2.8;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(X(input.goal.x), Y(input.goal.y));
      for (var u = f.best; u !== -1; u = f.par[u]) ctx.lineTo(X(f.px[u]), Y(f.py[u]));
      ctx.stroke();
    }

    // start and goal
    ctx.fillStyle = c.text;
    ctx.beginPath(); ctx.arc(X(input.start.x), Y(input.start.y), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c.good;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(X(input.goal.x), Y(input.goal.y), 5.5, 0, Math.PI * 2); ctx.stroke();

    /* ---- anytime cost curve ---- */
    var gx = view.w - plotW - pad, gy = pad + 14, gw = plotW, gh = view.h - pad * 2 - 26;
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);
    ctx.fillStyle = c.muted;
    ctx.font = "600 10px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("best cost vs iteration", gx, gy - 5);

    var cMin2 = Math.hypot(input.goal.x - input.start.x, input.goal.y - input.start.y);
    if (f.curve && f.curve.length) {
      var hi = f.curve[0][1], lo = cMin2;
      var span = Math.max(1e-6, hi - lo);
      var itMax = Math.max(1, input.iters || 900);
      ctx.strokeStyle = c.good;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (i = 0; i < f.curve.length; i++) {
        var qx = gx + (f.curve[i][0] / itMax) * gw;
        var qy = gy + gh - ((f.curve[i][1] - lo) / span) * gh * 0.86 - gh * 0.07;
        if (i === 0) ctx.moveTo(qx, qy); else { ctx.lineTo(qx, qy); }
        // step plot: cost is piecewise constant between improvements
        if (i + 1 < f.curve.length) {
          var nx2 = gx + (f.curve[i + 1][0] / itMax) * gw;
          ctx.lineTo(nx2, qy);
        }
      }
      ctx.stroke();
      // straight-line lower bound
      ctx.strokeStyle = withAlpha(c.muted, 0.8);
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      var yb = gy + gh - gh * 0.07;
      ctx.beginPath(); ctx.moveTo(gx, yb); ctx.lineTo(gx + gw, yb); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.muted;
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText("lower bound " + cMin2.toFixed(0) + " m", gx + 4, yb - 4);
      ctx.fillStyle = c.good;
      ctx.font = "600 11px -apple-system, system-ui, sans-serif";
      ctx.fillText(f.bestCost.toFixed(1) + " m", gx + 4, gy + 14);
    } else {
      ctx.fillStyle = withAlpha(c.muted, 0.8);
      ctx.font = "10px -apple-system, system-ui, sans-serif";
      ctx.fillText("no solution yet", gx + 8, gy + 20);
    }
  }

  /* ---------- mount ---------- */
  function init() {
    var el = document.getElementById("algviz-rrt-star");
    if (!el || !window.AlgViz) return;
    var forest = forestWorld(7);
    var win = windowWorld();
    AlgViz.mount(el, {
      title: "RRT*",
      aspect: 16 / 7,
      cases: [
        {
          name: "RRT* with rewiring, forest",
          input: { world: forest, seed: 21, rewire: true, informed: false, iters: 900,
                   start: { x: 6, y: 30 }, goal: { x: 94, y: 30 } },
        },
        {
          name: "plain RRT, same seed and map",
          input: { world: forest, seed: 21, rewire: false, informed: false, iters: 900,
                   start: { x: 6, y: 30 }, goal: { x: 94, y: 30 } },
        },
        {
          name: "Informed RRT*, wall with one window",
          input: { world: win, seed: 5, rewire: true, informed: true, iters: 900,
                   start: { x: 8, y: 30 }, goal: { x: 92, y: 30 } },
        },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
