/* Copy-to-clipboard for code blocks. The only script code blocks ship; all
   syntax highlighting is baked into the HTML at build time (scripts/highlight.mjs). */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".shl-copy") : null;
    if (!btn) return;
    var scope = btn.closest(".code-tabs") || btn.closest(".shl-box");
    if (!scope) return;
    var code = scope.querySelector("pre.lang.active code") || scope.querySelector("pre code");
    if (!code) return;
    var text = code.textContent;
    var done = function () {
      btn.textContent = "Copied";
      btn.classList.add("did");
      setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("did"); }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    } else { fallback(text); done(); }
  });
  function fallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (err) { /* clipboard unavailable */ }
    ta.remove();
  }
})();
