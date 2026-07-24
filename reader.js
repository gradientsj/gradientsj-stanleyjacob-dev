/* "Listen" (read-aloud) control for the articles. No dependencies.
   Markup:  <div class="reader" data-reader data-audio="listen.mp3"></div>
   - Plays a listen.mp3 if present, else falls back to the browser's best voice.
   - Highlights three levels while speaking: the passage block, the current
     sentence, and the exact word being spoken (CSS Custom Highlight API).
   - Reading advances sentence by sentence, and the scrubber jumps by
     sentence (short blocks like headings stay whole).
   - Floating controls follow the reader down the page when the main bar
     scrolls out of view, so playback can be paused from anywhere. Auto-scroll
     follows the text but yields as soon as the reader scrolls away, and the
     floating "Go to text" button returns to the passage and re-engages it. */
(function () {
  "use strict";

  var SKIP_TAGS = { pre: 1, svg: 1, script: 1, style: 1, noscript: 1, code: 1 };
  var READ_TAGS = { p: 1, h1: 1, h2: 1, h3: 1, h4: 1, li: 1, blockquote: 1, figcaption: 1 };
  var VOICE_PREFS = [
    "Microsoft Guy Online", "Microsoft Andrew Online", "Microsoft Brian",
    "Google UK English Male", "Alex", "Daniel", "Aaron", "Arthur", "Rishi",
    "Microsoft David", "Google US English"
  ];

  function gather(scope, out) {
    for (var i = 0; i < scope.childNodes.length; i++) {
      var child = scope.childNodes[i];
      if (child.nodeType !== 1) continue;
      var tag = child.tagName.toLowerCase();
      if (SKIP_TAGS[tag]) continue;
      if (child.classList && (child.classList.contains("quiz") || child.classList.contains("qa") ||
        child.classList.contains("reader") || child.classList.contains("diagram"))) continue;
      if (READ_TAGS[tag]) {
        if (window.getComputedStyle(child).display === "none") continue; // don't read hidden text
        var t = child.textContent.replace(/\s+/g, " ").trim();
        if (t) out.push({ el: child, text: t });
        continue;
      }
      gather(child, out);
    }
    return out;
  }

  function articleChunks() {
    var out = [];
    var h1 = document.querySelector(".hero h1");
    if (h1) out.push({ el: h1, text: h1.textContent.trim() });
    gather(document.querySelector("article.prose") || document.body, out);
    return out;
  }

  function pickVoice() {
    if (!("speechSynthesis" in window)) return null;
    var vs = window.speechSynthesis.getVoices();
    if (!vs.length) return null;
    for (var p = 0; p < VOICE_PREFS.length; p++)
      for (var i = 0; i < vs.length; i++)
        if (vs[i].name.indexOf(VOICE_PREFS[p]) >= 0) return vs[i];
    for (var j = 0; j < vs.length; j++)
      if (vs[j].name.indexOf("Natural") >= 0 && /^en/i.test(vs[j].lang)) return vs[j];
    for (var k = 0; k < vs.length; k++)
      if (/^en/i.test(vs[k].lang)) return vs[k];
    return vs[0];
  }

  // sentence boundaries: punctuation, whitespace, then something that starts a
  // sentence, with common abbreviations excluded so "e.g. the" stays together
  var SENT_RE = /(?<!\be\.g\.)(?<!\bi\.e\.)(?<!\bvs\.)(?<!\bDr\.)(?<!\bMr\.)(?<!\bMs\.)(?<!\bProf\.)(?<!\bFig\.)(?<!\bNo\.)(?<!\bet al\.)(?<=[.!?])\s+(?=["'“‘(]?[A-Z0-9])/;

  function splitSentences(text) {
    var parts;
    try { parts = text.split(SENT_RE); }
    catch (e) { parts = [text]; }               // engines without lookbehind
    var out = [], off = 0;
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i];
      var start = text.indexOf(s, off);
      if (start < 0) start = off;
      out.push({ start: start, end: start + s.length, text: s });
      off = start + s.length;
    }
    return out;
  }

  function initReader(root) {
    var audioUrl = root.getAttribute("data-audio");
    var bar = document.createElement("div");
    bar.className = "reader-bar";

    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "reader-btn";

    var stop = document.createElement("button");
    stop.type = "button"; stop.className = "reader-stop"; stop.textContent = "Stop"; stop.hidden = true;
    var note = document.createElement("span");
    note.className = "reader-note";

    var range = document.createElement("input");
    range.type = "range"; range.className = "reader-range";
    range.min = "0"; range.value = "0"; range.step = "1"; range.hidden = true;
    range.setAttribute("aria-label", "Reading position");
    var pos = document.createElement("span");
    pos.className = "reader-pos"; pos.hidden = true;

    bar.appendChild(btn); bar.appendChild(stop);
    bar.appendChild(range); bar.appendChild(pos);
    root.appendChild(bar); root.appendChild(note);

    // floating controls that follow the reader down the page
    var float_ = document.createElement("div");
    float_.className = "reader-float"; float_.hidden = true;
    var fBtn = document.createElement("button");
    fBtn.type = "button"; fBtn.className = "reader-btn reader-float-btn";
    var fStop = document.createElement("button");
    fStop.type = "button"; fStop.className = "reader-stop"; fStop.textContent = "Stop";
    var fJump = document.createElement("button");
    fJump.type = "button"; fJump.className = "reader-stop reader-jump"; fJump.textContent = "Go to text";
    var fPos = document.createElement("span");
    fPos.className = "reader-pos";
    float_.appendChild(fBtn); float_.appendChild(fStop); float_.appendChild(fJump); float_.appendChild(fPos);
    document.body.appendChild(float_);

    var supportsSpeech = "speechSynthesis" in window;
    var mode = null, audio = null;
    var chunks = [], units = [], idx = 0, speaking = false, paused = false;
    var barVisible = true, userAway = false;

    function label(playing) {
      [btn, fBtn].forEach(function (b) {
        b.textContent = "";
        var ic = document.createElement("span");
        ic.className = "reader-ic"; ic.textContent = playing ? "❚❚" : "▶";
        b.appendChild(ic);
        b.appendChild(document.createTextNode(playing ? " Pause" : (b === btn ? " Listen" : " Play")));
      });
      btn.classList.toggle("playing", playing);
      stop.hidden = !playing && mode === null;
      updateFloat();
    }
    function updateFloat() {
      var active = mode !== null;
      float_.hidden = !(active && !barVisible);
    }
    function clearHi() {
      chunks.forEach(function (c) { if (c.el) c.el.classList.remove("reader-reading"); });
      clearRange("reader-word"); clearRange("reader-sentence");
    }
    function highlight(ci) {
      chunks.forEach(function (c) { if (c.el) c.el.classList.remove("reader-reading"); });
      if (chunks[ci] && chunks[ci].el) {
        chunks[ci].el.classList.add("reader-reading");
        if (!userAway) chunks[ci].el.scrollIntoView({ block: "nearest" });
      }
    }
    function showScrub(show) { range.hidden = !show; pos.hidden = !show; }
    function setPos(text) { pos.textContent = text; fPos.textContent = text; }
    function fmt(t) {
      t = Math.max(0, Math.floor(t || 0));
      return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2);
    }
    function finish() {
      speaking = false; paused = false; mode = null; clearHi();
      note.textContent = ""; showScrub(false); label(false); updateFloat();
    }

    /* ---- range highlights (CSS Custom Highlight API, no DOM edits) ----
       The utterance text is the element's textContent with whitespace
       collapsed, so a map from collapsed offsets back to (text node, offset)
       lets boundary events and sentence spans place Ranges over the live
       markup, even across inline elements. Silent no-op where unsupported. */
    var hiApiOk = typeof window.Highlight === "function" && window.CSS && CSS.highlights;
    var mapCache = {};   // chunk index -> { text, map }

    function clearRange(name) { if (hiApiOk) CSS.highlights.delete(name); }

    function buildWordMap(el) {
      var map = [], out = "", lastSpace = true;
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        var s = node.nodeValue;
        for (var i = 0; i < s.length; i++) {
          var ch = s.charAt(i);
          if (/\s/.test(ch)) {
            if (!lastSpace) { out += " "; map.push({ node: node, offset: i }); lastSpace = true; }
          } else {
            out += ch; map.push({ node: node, offset: i }); lastSpace = false;
          }
        }
      }
      if (out.charAt(out.length - 1) === " ") { out = out.slice(0, -1); map.pop(); }
      return { text: out, map: map };
    }
    function chunkMap(ci) {
      if (!mapCache[ci] && chunks[ci] && chunks[ci].el) mapCache[ci] = buildWordMap(chunks[ci].el);
      return mapCache[ci] || null;
    }
    function setRange(name, ci, start, end) {
      if (!hiApiOk) return;
      var wm = chunkMap(ci);
      if (!wm) return;
      try {
        var a = wm.map[Math.max(0, Math.min(start, wm.map.length - 1))];
        var b = wm.map[Math.max(0, Math.min(end, wm.map.length) - 1)];
        if (!a || !b) return;
        var r = document.createRange();
        r.setStart(a.node, a.offset);
        r.setEnd(b.node, b.offset + 1);
        CSS.highlights.set(name, new Highlight(r));
      } catch (e) { /* never let highlighting break playback */ }
    }
    function highlightWord(ci, absIndex, charLength, unitText, relIndex) {
      var end = absIndex + (charLength || 0);
      if (!charLength) {
        var m = /\S+/.exec(unitText.slice(relIndex));
        if (!m) return;
        absIndex = absIndex + m.index;
        end = absIndex + m[0].length;
      }
      setRange("reader-word", ci, absIndex, end);
    }

    function buildUnits() {
      units = [];
      for (var ci = 0; ci < chunks.length; ci++) {
        var text = chunks[ci].text;
        if (text.length < 90) {
          units.push({ ci: ci, start: 0, end: text.length, text: text, whole: true });
        } else {
          var ss = splitSentences(text);
          for (var k = 0; k < ss.length; k++) {
            units.push({ ci: ci, start: ss[k].start, end: ss[k].end, text: ss[k].text, whole: ss.length === 1 });
          }
        }
      }
    }

    var gen = 0; // bumped on jump/start so stale utterance callbacks go quiet

    function speakFrom(i) {
      if (i >= units.length) { finish(); return; }
      idx = i;
      var u = units[i];
      highlight(u.ci);
      if (!u.whole) setRange("reader-sentence", u.ci, u.start, u.end);
      else clearRange("reader-sentence");
      note.textContent = u.text;
      range.value = String(i); setPos((i + 1) + " / " + units.length);
      var myGen = gen;
      var utt = new SpeechSynthesisUtterance(u.text);
      var v = pickVoice(); if (v) utt.voice = v;
      utt.onboundary = function (e) {
        if (myGen !== gen) return;
        if (e.name === "word" || e.name === undefined) {
          highlightWord(u.ci, u.start + (e.charIndex || 0), e.charLength || 0, u.text, e.charIndex || 0);
        }
      };
      utt.onend = function () {
        if (myGen !== gen) return;
        clearRange("reader-word");
        if (speaking && !paused) speakFrom(i + 1);
      };
      window.speechSynthesis.speak(utt);
    }
    function startSpeech() {
      chunks = articleChunks();
      if (!chunks.length) return;
      mapCache = {};
      buildUnits();
      speaking = true; paused = false; mode = "speech"; userAway = false;
      gen++;
      window.speechSynthesis.cancel();
      range.max = String(units.length - 1);
      showScrub(true);
      label(true); speakFrom(0);
    }
    function jumpTo(i) {
      gen++;
      window.speechSynthesis.cancel();
      paused = false; speaking = true;
      label(true);
      speakFrom(Math.max(0, Math.min(i, units.length - 1)));
    }
    function startAudio() {
      mode = "audio"; audio = new Audio(audioUrl);
      note.textContent = "natural narration";
      audio.addEventListener("ended", finish);
      audio.addEventListener("loadedmetadata", function () {
        range.max = "1000"; range.value = "0"; showScrub(true);
        setPos(fmt(0) + " / " + fmt(audio.duration));
      });
      audio.addEventListener("timeupdate", function () {
        if (!audio.duration) return;
        range.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
        setPos(fmt(audio.currentTime) + " / " + fmt(audio.duration));
      });
      label(true); audio.play();
    }
    range.addEventListener("input", function () {
      var v = parseInt(range.value, 10) || 0;
      userAway = false;
      if (mode === "speech") jumpTo(v);
      else if (mode === "audio" && audio && audio.duration) {
        audio.currentTime = (v / 1000) * audio.duration;
        if (audio.paused) { audio.play(); label(true); }
      }
    });
    function haveAudio() {
      if (!audioUrl) return Promise.resolve(false);
      return fetch(audioUrl, { method: "HEAD" }).then(function (r) { return r.ok; }).catch(function () { return false; });
    }
    function togglePlay() {
      if (mode === "audio") {
        if (audio.paused) { audio.play(); label(true); } else { audio.pause(); label(false); }
        return;
      }
      if (mode === "speech") {
        if (!paused) { paused = true; window.speechSynthesis.pause(); label(false); }
        else { paused = false; window.speechSynthesis.resume(); label(true); }
        return;
      }
      haveAudio().then(function (ok) {
        if (ok) startAudio();
        else if (supportsSpeech) startSpeech();
        else note.textContent = "read-aloud is not supported in this browser";
      });
    }
    function stopAll() {
      if (mode === "speech") { gen++; window.speechSynthesis.cancel(); }
      if (audio) { audio.pause(); audio.currentTime = 0; }
      finish();
    }

    btn.addEventListener("click", togglePlay);
    fBtn.addEventListener("click", togglePlay);
    stop.addEventListener("click", stopAll);
    fStop.addEventListener("click", stopAll);
    fJump.addEventListener("click", function () {
      userAway = false;
      var target = (mode === "speech" && units[idx]) ? chunks[units[idx].ci].el : bar;
      if (target) target.scrollIntoView({ block: "center", behavior: "smooth" });
    });

    // auto-scroll yields to the reader: any manual scroll intent while playing
    // parks the follow behavior until "Go to text" or the scrubber re-engages
    ["wheel", "touchmove"].forEach(function (ev) {
      window.addEventListener(ev, function () { if (mode !== null) userAway = true; }, { passive: true });
    });
    window.addEventListener("keydown", function (e) {
      if (mode === null) return;
      if (["PageDown", "PageUp", "Home", "End", " ", "ArrowDown", "ArrowUp"].indexOf(e.key) >= 0) userAway = true;
    });

    // show the floating controls when the main bar leaves the viewport
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        barVisible = entries[0].isIntersecting;
        updateFloat();
      }, { threshold: 0 }).observe(bar);
    } else {
      barVisible = true;
    }

    window.addEventListener("beforeunload", function () {
      if (mode === "speech") window.speechSynthesis.cancel();
    });
    if (supportsSpeech && window.speechSynthesis.onvoiceschanged === null) {
      window.speechSynthesis.onvoiceschanged = function () {};  // warm the voice list
    }
    label(false);
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-reader]"), initReader);
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
