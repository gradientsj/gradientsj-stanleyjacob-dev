/* "Listen" (read-aloud) control for the articles. No dependencies.
   Markup:  <div class="reader" data-reader data-audio="listen.mp3"></div>
   - Plays an ElevenLabs listen.mp3 if present (natural voice), else falls back to the
     browser's best available voice (prefers a natural male voice over the robotic default).
   - Speed control (1x / 2x / 3x / 4x), pause/stop, and it highlights the block being read. */
(function () {
  "use strict";

  var SKIP_TAGS = { pre: 1, svg: 1, script: 1, style: 1, noscript: 1, code: 1 };
  var READ_TAGS = { p: 1, h1: 1, h2: 1, h3: 1, h4: 1, li: 1, blockquote: 1, figcaption: 1 };
  // browser voices, most natural / male first
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

    bar.appendChild(btn); bar.appendChild(stop);
    root.appendChild(bar); root.appendChild(note);

    var supportsSpeech = "speechSynthesis" in window;
    var mode = null, audio = null;
    var chunks = [], idx = 0, speaking = false, paused = false;

    function label(playing) {
      btn.textContent = "";
      var ic = document.createElement("span");
      ic.className = "reader-ic"; ic.textContent = playing ? "❚❚" : "▶";
      btn.appendChild(ic);
      btn.appendChild(document.createTextNode(playing ? " Pause" : " Listen"));
      btn.classList.toggle("playing", playing);
      stop.hidden = !playing;
    }
    function clearHi() {
      chunks.forEach(function (c) { if (c.el) c.el.classList.remove("reader-reading"); });
    }
    function highlight(i) {
      clearHi();
      if (chunks[i] && chunks[i].el) {
        chunks[i].el.classList.add("reader-reading");
        chunks[i].el.scrollIntoView({ block: "nearest" });
      }
    }
    function finish() { speaking = false; paused = false; mode = null; clearHi(); note.textContent = ""; label(false); }

    function speakFrom(i) {
      if (i >= chunks.length) { finish(); return; }
      idx = i; highlight(i); note.textContent = chunks[i].text;
      var u = new SpeechSynthesisUtterance(chunks[i].text);
      var v = pickVoice(); if (v) u.voice = v;
      u.onend = function () { if (speaking && !paused) speakFrom(i + 1); };
      window.speechSynthesis.speak(u);
    }
    function startSpeech() {
      chunks = articleChunks();
      if (!chunks.length) return;
      speaking = true; paused = false; mode = "speech";
      window.speechSynthesis.cancel();
      label(true); speakFrom(0);
    }
    function startAudio() {
      mode = "audio"; audio = new Audio(audioUrl);
      note.textContent = "natural narration";
      audio.addEventListener("ended", finish);
      label(true); audio.play();
    }
    function haveAudio() {
      if (!audioUrl) return Promise.resolve(false);
      return fetch(audioUrl, { method: "HEAD" }).then(function (r) { return r.ok; }).catch(function () { return false; });
    }

    btn.addEventListener("click", function () {
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
    });
    stop.addEventListener("click", function () {
      if (mode === "speech") window.speechSynthesis.cancel();
      if (audio) { audio.pause(); audio.currentTime = 0; }
      finish();
    });
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
