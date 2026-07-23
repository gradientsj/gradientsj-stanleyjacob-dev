/* KaTeX loader for the coursework articles.
   Pages opt in with:  <script defer src="/classes/math.js"></script>
   Delimiters: $$...$$ (display) and \( ... \) (inline).
   Loads from the CDN, renders once on DOMContentLoaded, and degrades to the
   raw source text if the CDN is unreachable (nothing else on the page depends
   on it). Kept out of style.css/oss pages so the rest of the site still ships
   zero client-side libraries. */
(function () {
  "use strict";
  var VER = "0.16.11";
  var BASE = "https://cdn.jsdelivr.net/npm/katex@" + VER + "/dist/";

  function css(href) {
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.crossOrigin = "anonymous";
    document.head.appendChild(l);
  }
  function js(src, onload) {
    var s = document.createElement("script");
    s.src = src;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.onload = onload;
    document.head.appendChild(s);
  }

  css(BASE + "katex.min.css");
  js(BASE + "katex.min.js", function () {
    js(BASE + "contrib/auto-render.min.js", function () {
      if (!window.renderMathInElement) return;
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
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
      });
    });
  });
})();
