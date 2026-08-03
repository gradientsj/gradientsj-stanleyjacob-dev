/* Valid parentheses (stack) visualizer. Mirrors the shape of the reference
   binary-search visualizer for the AlgViz harness: scan the string with a
   pointer, push opening brackets onto a stack, pop and check on closers. */
(function () {
  "use strict";

  var OPEN = { "(": true, "[": true, "{": true };
  var PARTNER = { ")": "(", "]": "[", "}": "{" };
  var CLOSER = { "(": ")", "[": "]", "{": "}" };

  function build(input) {
    var s = input.s.split("");
    var frames = [];
    var stack = [];
    var maxDepth = 1;
    function snap(f) {
      f.stack = stack.slice();
      frames.push(f);
    }

    snap({ i: -1, phase: "start",
      note: 'Check "' + input.s + '". Scan left to right: push every opening bracket, and on a closing bracket pop the stack and check the pair matches.' });

    var failed = false;
    for (var i = 0; i < s.length && !failed; i++) {
      var ch = s[i];
      if (OPEN[ch]) {
        snap({ i: i, phase: "scan-open",
          note: "s[" + i + "] = '" + ch + "' is an opening bracket." });
        stack.push(ch);
        if (stack.length > maxDepth) maxDepth = stack.length;
        snap({ i: i, phase: "push",
          note: "Push '" + ch + "' onto the stack. Its partner '" + CLOSER[ch] + "' must show up later, after anything opened above it is closed." });
      } else {
        snap({ i: i, phase: "scan-close",
          note: "s[" + i + "] = '" + ch + "' is a closing bracket, so the most recently opened bracket must be its partner." });
        if (!stack.length) {
          failed = true;
          snap({ i: i, phase: "underflow", ch: ch,
            note: "The stack is empty — there is no open bracket for '" + ch + "' to close." });
        } else {
          var popped = stack.pop();
          snap({ i: i, phase: "pop", popped: popped, ch: ch,
            note: "Pop the top of the stack: '" + popped + "'. Does '" + ch + "' close '" + popped + "'?" });
          if (PARTNER[ch] === popped) {
            snap({ i: i, phase: "match", popped: popped, ch: ch,
              note: "Yes — '" + popped + ch + "' is a matched pair. Discard both and keep scanning." });
          } else {
            failed = true;
            snap({ i: i, phase: "mismatch", popped: popped, ch: ch,
              note: "No — '" + popped + "' needs '" + CLOSER[popped] + "' to close it, not '" + ch + "'. The brackets are interleaved, not nested." });
          }
        }
      }
    }
    if (failed) {
      var last = frames[frames.length - 1];
      snap({ i: last.i, phase: "invalid", result: false, popped: last.popped, ch: last.ch,
        note: "The string is not valid." });
    } else if (stack.length === 0) {
      snap({ i: s.length, phase: "valid", result: true,
        note: "End of string and the stack is empty — every bracket was matched and properly nested. Valid." });
    } else {
      snap({ i: s.length, phase: "check-end",
        note: "End of string. A valid string must also leave the stack empty — check what is left." });
      snap({ i: s.length, phase: "invalid", result: false, leftover: true,
        note: stack.length + " opening bracket" + (stack.length > 1 ? "s" : "") + " never got closed — the stack is not empty. Invalid." });
    }
    var cap = Math.max(3, maxDepth);
    for (var k = 0; k < frames.length; k++) {
      frames[k].s = s;
      frames[k].cap = cap;
    }
    return frames;
  }

  function draw(ctx, f, view) {
    var s = f.s, n = s.length, w = view.w, h = view.h, c = view.colors;
    var pad = 20;

    // layout: string row on the left, stack column on the right
    var stackW = Math.max(70, Math.min(120, w * 0.2));
    var gap = 28;
    var sx0 = w - pad - stackW; // left edge of the stack region
    var areaW = sx0 - gap - pad; // width available for the string row
    var cw = Math.min(58, areaW / n);
    var x0 = pad + (areaW - cw * n) / 2;
    var cy = h * 0.55;
    var chh = Math.min(52, cw * 0.95, h * 0.3);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // current-cell highlight color depends on the phase
    var curCol = c.accent;
    if (f.phase === "match") curCol = c.good;
    if (f.phase === "mismatch" || f.phase === "underflow" || (f.phase === "invalid" && f.i < n)) curCol = c.bad;

    // input string cells
    for (var k = 0; k < n; k++) {
      var x = x0 + k * cw;
      var consumed = k < f.i || f.i >= n;
      var cur = k === f.i && f.i >= 0 && f.i < n;
      var fill = consumed ? c.bg : c.card, stroke = c.line, txt = consumed ? c.muted : c.text;
      if (cur) { fill = withAlpha(curCol, 0.22); stroke = curCol; txt = c.text; }
      rr(ctx, x + 3, cy - chh / 2, cw - 6, chh, 8);
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = cur ? 2 : 1;
      ctx.strokeStyle = stroke; ctx.stroke();
      ctx.globalAlpha = consumed && !cur ? 0.45 : 1;
      ctx.fillStyle = txt;
      ctx.font = "600 " + Math.round(chh * 0.44) + "px ui-monospace, monospace";
      ctx.fillText(s[k], x + cw / 2, cy + 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = c.muted;
      ctx.font = Math.round(chh * 0.26) + "px ui-monospace, monospace";
      ctx.fillText(String(k), x + cw / 2, cy + chh / 2 + 12);
    }

    // scan pointer above the current cell
    if (f.i >= 0 && f.i < n) {
      var px = x0 + f.i * cw + cw / 2;
      ctx.fillStyle = curCol;
      ctx.font = "600 12px ui-monospace, monospace";
      ctx.fillText("i", px, cy - chh / 2 - 16);
      ctx.beginPath();
      ctx.moveTo(px, cy - chh / 2 - 5);
      ctx.lineTo(px - 4, cy - chh / 2 - 10);
      ctx.lineTo(px + 4, cy - chh / 2 - 10);
      ctx.closePath();
      ctx.fill();
    }

    // stack container (open at the top)
    var cap = f.cap || 3;
    var innerW = Math.min(64, stackW - 16);
    var sxc = sx0 + (stackW - innerW) / 2;
    var baseY = h - pad - 16;
    var slotH = Math.min(42, (baseY - pad - 8) / (cap + 0.6));
    var wallTop = baseY - cap * slotH - 8;
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sxc - 8, wallTop);
    ctx.lineTo(sxc - 8, baseY);
    ctx.lineTo(sxc + innerW + 8, baseY);
    ctx.lineTo(sxc + innerW + 8, wallTop);
    ctx.stroke();
    ctx.fillStyle = c.muted;
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillText("stack", sxc + innerW / 2, baseY + 11);

    // stack cells, bottom-up
    var st = f.stack || [];
    for (var j = 0; j < st.length; j++) {
      var yTop = baseY - (j + 1) * slotH;
      var isTop = j === st.length - 1;
      var sFill = c.card, sStroke = c.line, sLw = 1;
      if (f.phase === "push" && isTop) { sFill = withAlpha(c.accent, 0.22); sStroke = c.accent; sLw = 2; }
      if (f.phase === "check-end") { sFill = withAlpha(c.warn, 0.18); sStroke = c.warn; }
      if (f.phase === "invalid" && f.leftover) { sFill = withAlpha(c.bad, 0.18); sStroke = c.bad; }
      rr(ctx, sxc, yTop + 3, innerW, slotH - 6, 6);
      ctx.fillStyle = sFill; ctx.fill();
      ctx.lineWidth = sLw;
      ctx.strokeStyle = sStroke; ctx.stroke();
      ctx.fillStyle = c.text;
      ctx.font = "600 " + Math.round(slotH * 0.48) + "px ui-monospace, monospace";
      ctx.fillText(st[j], sxc + innerW / 2, yTop + slotH / 2 + 1);
    }

    // "top" pointer at the topmost stack cell
    if (st.length) {
      var ty = baseY - st.length * slotH + slotH / 2;
      ctx.fillStyle = c.muted;
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.fillText("top", sxc - 20, ty);
      ctx.textAlign = "center";
      ctx.beginPath();
      ctx.moveTo(sxc - 17, ty - 4);
      ctx.lineTo(sxc - 17, ty + 4);
      ctx.lineTo(sxc - 11, ty);
      ctx.closePath();
      ctx.fill();
    }

    // the popped bracket floats above the stack while it is compared
    if (f.popped != null && (f.phase === "pop" || f.phase === "match" || f.phase === "mismatch" || f.phase === "invalid")) {
      var fCol = c.accent;
      if (f.phase === "match") fCol = c.good;
      if (f.phase === "mismatch" || f.phase === "invalid") fCol = c.bad;
      var fy = baseY - (st.length + 1) * slotH - 10;
      if (fy < 4) fy = 4;
      rr(ctx, sxc, fy + 3, innerW, slotH - 6, 6);
      ctx.fillStyle = withAlpha(fCol, 0.22); ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = fCol; ctx.stroke();
      ctx.fillStyle = c.text;
      ctx.font = "600 " + Math.round(slotH * 0.48) + "px ui-monospace, monospace";
      ctx.fillText(f.popped, sxc + innerW / 2, fy + slotH / 2 + 1);
    }

    // status line / verdict badge above the string row
    var midX = x0 + (cw * n) / 2;
    if (f.result === true || f.result === false) {
      var label = f.result ? "valid" : "invalid";
      var bCol = f.result ? c.good : c.bad;
      ctx.font = "700 14px -apple-system, system-ui, sans-serif";
      var tw = ctx.measureText(label).width;
      rr(ctx, midX - tw / 2 - 14, pad, tw + 28, 28, 14);
      ctx.fillStyle = withAlpha(bCol, 0.16); ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = bCol; ctx.stroke();
      ctx.fillStyle = bCol;
      ctx.fillText(label, midX, pad + 15);
    } else {
      var msg = null, mCol = c.muted;
      if (f.phase === "pop") { msg = "pop '" + f.popped + "' — does '" + f.ch + "' match it?"; mCol = c.accent; }
      if (f.phase === "match") { msg = "'" + f.popped + "' + '" + f.ch + "' — matched pair"; mCol = c.good; }
      if (f.phase === "mismatch") { msg = "'" + f.popped + "' vs '" + f.ch + "' — mismatch"; mCol = c.bad; }
      if (f.phase === "underflow") { msg = "stack empty — nothing to pop"; mCol = c.bad; }
      if (f.phase === "check-end") { msg = "scan done — is the stack empty?"; mCol = c.warn; }
      if (msg) {
        ctx.fillStyle = mCol;
        ctx.font = "600 12px ui-monospace, monospace";
        ctx.fillText(msg, midX, pad + 8);
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
    var el = document.getElementById("algviz-stack");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Valid parentheses",
      aspect: 16 / 7,
      cases: [
        { name: '"([{}])" — valid', input: { s: "([{}])" } },
        { name: '"([)]" — mismatched pair', input: { s: "([)]" } },
        { name: '"(((" — unclosed brackets', input: { s: "(((" } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
