/* AlgViz — a tiny, dependency-free player for step-by-step algorithm
   visualizations. Each topic supplies a config; the harness renders a canvas,
   a test-case selector, transport controls (reset / step / play / speed), a
   caption, and a progress readout. Colors are read from the site's CSS theme
   variables and refresh when the light/dark toggle flips.

   Contract:
     AlgViz.mount(mountEl, {
       title: "Binary search",
       cases: [{ name: "target 9 in a sorted array", input: <any> }, ...],
       build(input) -> [frame, frame, ...],   // pure: input -> array of frames
       draw(ctx, frame, view),                 // render one frame (CSS pixels)
       caption(frame) -> "step description",   // optional
       aspect: 16/7,                           // optional canvas w:h
       autoplay: true                          // optional
     })

   `view` passed to draw() is { w, h, colors, frameIndex, frameCount, input }.
   `colors` has: bg, card, text, muted, line, accent, good, warn, bad, and a
   categorical pool `pool[]` for series. draw() works in CSS pixels; the harness
   handles devicePixelRatio scaling. Frames are opaque to the harness. */
(function () {
  "use strict";

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    function v(name, fallback) {
      var x = cs.getPropertyValue(name);
      return (x && x.trim()) || fallback;
    }
    return {
      bg: v("--bg", "#FAF6F0"),
      card: v("--card", "#131c28"),
      soft: v("--bg-soft", "#121a25"),
      text: v("--text", "#e9eff6"),
      muted: v("--muted", "#a7b4c4"),
      line: v("--line", "#263341"),
      accent: v("--accent", "#AF3A03"),
      good: v("--good", "#4ecb8a"),
      warn: v("--warn", "#e0b44e"),
      bad: v("--bad", "#f2726f"),
      pool: [
        v("--accent", "#AF3A03"),
        v("--good", "#4ecb8a"),
        v("--warn", "#e0b44e"),
        v("--bad", "#f2726f"),
        "#b98cff",
        "#3fd0c9",
        "#f29e4a",
      ],
    };
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function svgIcon(paths) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      paths +
      "</svg>"
    );
  }
  var ICONS = {
    reset: svgIcon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    prev: svgIcon('<path d="M19 20 9 12l10-8z"/><path d="M5 19V5"/>'),
    next: svgIcon('<path d="M5 4l10 8-10 8z"/><path d="M19 5v14"/>'),
    play: svgIcon('<path d="M6 4l14 8-14 8z"/>'),
    pause: svgIcon('<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>'),
  };

  function mount(host, cfg) {
    if (!host) return;
    host.innerHTML = "";
    host.classList.add("algviz");

    var cases = cfg.cases && cfg.cases.length ? cfg.cases : [{ name: "example", input: cfg.input }];
    var aspect = cfg.aspect || 16 / 7;

    // header
    var head = el("div", "algviz-head");
    var title = el("div", "algviz-title", cfg.title || "Visualization");
    head.appendChild(title);
    var sel = el("select", "algviz-cases");
    cases.forEach(function (c, i) {
      var o = el("option", null, c.name || "case " + (i + 1));
      o.value = String(i);
      sel.appendChild(o);
    });
    if (cases.length > 1) head.appendChild(sel);
    host.appendChild(head);

    // canvas
    var stage = el("div", "algviz-stage");
    var canvas = el("canvas", "algviz-canvas");
    stage.appendChild(canvas);
    host.appendChild(stage);
    var ctx = canvas.getContext("2d");

    // caption + progress
    var capRow = el("div", "algviz-caprow");
    var caption = el("div", "algviz-caption");
    var progress = el("div", "algviz-progress");
    capRow.appendChild(caption);
    capRow.appendChild(progress);
    host.appendChild(capRow);

    // controls
    var ctrls = el("div", "algviz-ctrls");
    function btn(icon, label) {
      var b = el("button", "algviz-btn");
      b.type = "button";
      b.innerHTML = icon;
      b.setAttribute("aria-label", label);
      b.title = label;
      return b;
    }
    var bReset = btn(ICONS.reset, "Reset");
    var bPrev = btn(ICONS.prev, "Step back");
    var bPlay = btn(ICONS.play, "Play");
    bPlay.classList.add("algviz-play");
    var bNext = btn(ICONS.next, "Step forward");
    var speed = el("input", "algviz-speed");
    speed.type = "range";
    speed.min = "0.25";
    speed.max = "3";
    speed.step = "0.25";
    speed.value = "1";
    speed.setAttribute("aria-label", "Speed");
    var speedLabel = el("span", "algviz-speedlabel", "1x");
    ctrls.appendChild(bReset);
    ctrls.appendChild(bPrev);
    ctrls.appendChild(bPlay);
    ctrls.appendChild(bNext);
    ctrls.appendChild(speed);
    ctrls.appendChild(speedLabel);
    host.appendChild(ctrls);

    // state
    var frames = [];
    var idx = 0;
    var playing = false;
    var colors = readColors();
    var input = null;
    var lastTick = 0;
    var raf = null;

    function buildCase(i) {
      var c = cases[i] || cases[0];
      input = c.input;
      try {
        frames = cfg.build(c.input) || [];
      } catch (e) {
        frames = [];
        console.error("AlgViz build error", e);
      }
      if (!frames.length) frames = [{}];
      idx = 0;
      render();
      if (cfg.autoplay) play();
    }

    function sizeCanvas() {
      var w = stage.clientWidth || 640;
      var h = Math.round(w / aspect);
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: w, h: h };
    }

    function render() {
      var dim = sizeCanvas();
      ctx.clearRect(0, 0, dim.w, dim.h);
      var frame = frames[idx] || {};
      var view = {
        w: dim.w,
        h: dim.h,
        colors: colors,
        frameIndex: idx,
        frameCount: frames.length,
        input: input,
      };
      try {
        cfg.draw(ctx, frame, view);
      } catch (e) {
        console.error("AlgViz draw error", e);
      }
      var cap = "";
      if (cfg.caption) {
        try {
          cap = cfg.caption(frame, view) || "";
        } catch (e) {}
      } else if (frame && frame.note) {
        cap = frame.note;
      }
      caption.textContent = cap;
      progress.textContent = "step " + (idx + 1) + " / " + frames.length;
      bPlay.innerHTML = playing ? ICONS.pause : ICONS.play;
      bPlay.setAttribute("aria-label", playing ? "Pause" : "Play");
    }

    function stepTo(i) {
      idx = Math.max(0, Math.min(frames.length - 1, i));
      render();
    }

    function play() {
      if (frames.length <= 1) return;
      if (idx >= frames.length - 1) idx = 0;
      playing = true;
      lastTick = 0;
      loop(0);
    }
    function pause() {
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      render();
    }
    function loop(ts) {
      if (!playing) return;
      if (!lastTick) lastTick = ts;
      var interval = 780 / parseFloat(speed.value);
      if (ts - lastTick >= interval) {
        lastTick = ts;
        if (idx >= frames.length - 1) {
          playing = false;
          render();
          return;
        }
        idx++;
        render();
      }
      raf = requestAnimationFrame(loop);
    }

    bReset.addEventListener("click", function () {
      pause();
      stepTo(0);
    });
    bPrev.addEventListener("click", function () {
      pause();
      stepTo(idx - 1);
    });
    bNext.addEventListener("click", function () {
      pause();
      stepTo(idx + 1);
    });
    bPlay.addEventListener("click", function () {
      if (playing) pause();
      else play();
    });
    speed.addEventListener("input", function () {
      speedLabel.textContent = parseFloat(speed.value) + "x";
    });
    sel.addEventListener("change", function () {
      pause();
      buildCase(parseInt(sel.value, 10));
    });

    var ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () {
        render();
      });
      ro.observe(stage);
    } else {
      window.addEventListener("resize", render);
    }

    // refresh colors when the theme toggle flips
    new MutationObserver(function () {
      colors = readColors();
      render();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    buildCase(0);
  }

  window.AlgViz = { mount: mount, readColors: readColors };
})();
