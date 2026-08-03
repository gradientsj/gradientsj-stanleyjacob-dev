/* KaTeX renderer for the ml/ai article pages.
   Pages opt in with:  <script defer src="/render-math.js"></script>
   Handles $$...$$ and \[...\] (display) and $...$ and \(...\) (inline). If the
   page already loaded katex + auto-render it just renders; otherwise it loads
   them from the CDN first. Degrades to raw source if the CDN is unreachable.
   Single-$ is enabled because these articles author inline math that way, so
   literal dollar signs in their prose are escaped or avoided. */
(function () {
  "use strict";
  var VER = "0.16.11";
  var BASE = "https://cdn.jsdelivr.net/npm/katex@" + VER + "/dist/";

  var OPTS = {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
    ],
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
    throwOnError: false,
    strict: false,
    trust: function (ctx) { return ctx.command === "\\htmlClass"; },
    macros: {
      "\\R": "\\mathbb{R}",
      "\\E": "\\mathbb{E}",
      "\\P": "\\mathbb{P}",
      "\\N": "\\mathcal{N}",
      "\\L": "\\mathcal{L}",
      "\\D": "\\mathcal{D}",
      "\\T": "^{\\mathsf{T}}",
      "\\argmin": "\\operatorname*{arg\\,min}",
      "\\argmax": "\\operatorname*{arg\\,max}",
      "\\softmax": "\\operatorname{softmax}",
      "\\KL": "\\mathrm{KL}",
      "\\diag": "\\operatorname{diag}",
      "\\tr": "\\operatorname{tr}",
      "\\Var": "\\operatorname{Var}",
      "\\Cov": "\\operatorname{Cov}",
    },
  };

  function render() {
    if (window.renderMathInElement) window.renderMathInElement(document.body, OPTS);
  }
  function css(href) {
    var l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href; l.crossOrigin = "anonymous";
    document.head.appendChild(l);
  }
  function js(src, onload) {
    var s = document.createElement("script");
    s.src = src; s.defer = true; s.crossOrigin = "anonymous"; s.onload = onload;
    document.head.appendChild(s);
  }
  function start() {
    if (window.renderMathInElement) { render(); return; }
    if (!document.querySelector('link[href*="katex"]')) css(BASE + "katex.min.css");
    if (window.katex) { js(BASE + "contrib/auto-render.min.js", render); return; }
    js(BASE + "katex.min.js", function () { js(BASE + "contrib/auto-render.min.js", render); });
  }

  if (document.readyState !== "loading") start();
  else document.addEventListener("DOMContentLoaded", start);
})();
