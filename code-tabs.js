/* Language switcher for .code-tabs blocks. Clicking a tab switches every
   block on the page to that language and remembers the choice for future
   visits. Blocks missing the chosen language fall back to their first tab. */
(function () {
  var LANGS = ["python", "c", "cpp", "rust", "typescript", "go", "swift", "pytorch", "triton", "cuda", "jax"];

  function setLang(lang) {
    /* .code-steps blocks (approach ladder pages) manage their own visibility */
    document.querySelectorAll(".code-tabs:not(.code-steps)").forEach(function (block) {
      var target = lang;
      if (!block.querySelector('pre[data-lang="' + lang + '"]')) {
        var first = block.querySelector("pre[data-lang]");
        if (!first) return;
        target = first.getAttribute("data-lang");
      }
      block.querySelectorAll("pre[data-lang]").forEach(function (pre) {
        pre.classList.toggle("active", pre.getAttribute("data-lang") === target);
      });
      block.querySelectorAll("button[data-lang]").forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-lang") === target);
      });
    });
    try {
      localStorage.setItem("codeLang", lang);
    } catch (e) {
      /* private browsing: no persistence, switching still works */
    }
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".code-tabs:not(.code-steps) button[data-lang]") : null;
    if (btn) setLang(btn.getAttribute("data-lang"));
  });

  var saved = null;
  try {
    saved = localStorage.getItem("codeLang");
  } catch (e) {}
  if (saved && LANGS.indexOf(saved) >= 0) setLang(saved);
})();
