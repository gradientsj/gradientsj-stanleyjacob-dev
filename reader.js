/* Clean "Listen" (read-aloud) control for the articles. No dependencies.
   Markup:  <div class="reader" data-reader data-audio="listen.mp3"></div>
   Behavior:
     - If data-audio points to a real file (e.g. an ElevenLabs narration you generated),
       it plays that high-quality MP3.
     - Otherwise it falls back to the browser's built-in speech, which is free and needs
       no key, reading the visible article text in order.
   Accessible: real <button> controls with aria labels, skips code blocks and diagrams. */
(function () {
  "use strict";

  var SKIP_TAGS = { pre: 1, svg: 1, script: 1, style: 1, noscript: 1, code: 1 };
  var READ_TAGS = { p: 1, h1: 1, h2: 1, h3: 1, h4: 1, li: 1, blockquote: 1, figcaption: 1 };

  function gather(scope) {
    var out = [];
    (function walk(node) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var child = node.childNodes[i];
        if (child.nodeType !== 1) continue;
        var tag = child.tagName.toLowerCase();
        if (SKIP_TAGS[tag]) continue;
        if (child.classList && (child.classList.contains("quiz") ||
          child.classList.contains("reader") || child.classList.contains("diagram"))) continue;
        if (READ_TAGS[tag]) {
          var t = child.textContent.replace(/\s+/g, " ").trim();
          if (t) out.push(t);
          continue; // block already captured, do not descend
        }
        walk(child);
      }
    })(scope);
    return out;
  }

  function articleChunks() {
    var parts = [];
    var h1 = document.querySelector(".hero h1");
    if (h1) parts.push(h1.textContent.trim());
    var scope = document.querySelector("article.prose") || document.body;
    parts = parts.concat(gather(scope));
    return parts;
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
    bar.appendChild(btn); bar.appendChild(stop); bar.appendChild(note);
    root.appendChild(bar);

    var supportsSpeech = "speechSynthesis" in window;
    var mode = null;      // "audio" | "speech" | null
    var audio = null;
    var chunks = [], idx = 0, speaking = false, paused = false;

    function label(playing) {
      btn.textContent = "";
      var ic = document.createElement("span");
      ic.className = "reader-ic";
      ic.textContent = playing ? "❚❚" : "▶";
      btn.appendChild(ic);
      btn.appendChild(document.createTextNode(playing ? " Pause" : " Listen"));
      btn.classList.toggle("playing", playing);
      stop.hidden = !playing;
    }

    function finish() {
      speaking = false; paused = false; mode = null; label(false);
    }

    function speakFrom(i) {
      if (i >= chunks.length) { finish(); return; }
      idx = i;
      var u = new SpeechSynthesisUtterance(chunks[i]);
      u.rate = 1.0;
      u.onend = function () { if (speaking && !paused) speakFrom(i + 1); };
      window.speechSynthesis.speak(u);
    }

    function startSpeech() {
      chunks = articleChunks();
      if (!chunks.length) return;
      speaking = true; paused = false; mode = "speech";
      note.textContent = "reading with your browser voice";
      window.speechSynthesis.cancel();
      label(true);
      speakFrom(0);
    }

    function startAudio() {
      mode = "audio";
      audio = new Audio(audioUrl);
      note.textContent = "high-quality narration";
      audio.addEventListener("ended", finish);
      label(true);
      audio.play();
    }

    function haveAudio() {
      if (!audioUrl) return Promise.resolve(false);
      return fetch(audioUrl, { method: "HEAD" })
        .then(function (r) { return r.ok; })
        .catch(function () { return false; });
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

    label(false);
  }

  function init() {
    var nodes = document.querySelectorAll("[data-reader]");
    Array.prototype.forEach.call(nodes, initReader);
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
