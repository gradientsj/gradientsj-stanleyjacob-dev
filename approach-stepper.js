/* Approach ladder for .code-steps blocks (Top Interview 150 page). Each block
   holds one <pre> per (language, approach) pair. The language choice is global,
   shared with code-tabs.js through the same localStorage key; the approach step
   is per block, walked with the ‹ › control at the bottom right. Blocks default
   to approach 1 (the naive rung) so the ladder reads bottom-up. Buttons use
   aria-disabled instead of disabled so keyboard focus survives reaching either
   end of the ladder. */
(function () {
  if (window.__approachStepperInit) return;
  window.__approachStepperInit = true;

  var current = "python";
  try {
    /* accept whatever code-tabs.js saved, even languages this page lacks;
       render() falls back per block, and the stored choice is preserved */
    current = localStorage.getItem("codeLang") || current;
  } catch (e) {
    /* private browsing: no persistence, switching still works */
  }

  function ladderOf(block, lang) {
    var out = [];
    block.querySelectorAll('pre[data-lang="' + lang + '"][data-rung]').forEach(function (p) {
      out.push(p);
    });
    out.sort(function (a, b) {
      return +a.getAttribute("data-rung") - +b.getAttribute("data-rung");
    });
    return out;
  }

  function langFor(block) {
    if (block.querySelector('pre[data-lang="' + current + '"]')) return current;
    var first = block.querySelector("pre[data-lang]");
    return first ? first.getAttribute("data-lang") : current;
  }

  /* the rung actually shown: the stored position clamped to this language's
     ladder, without overwriting the stored position (switching to a shorter
     ladder and back must not lose the reader's place) */
  function shownRung(block, ladder) {
    return Math.min(Math.max(block._rung || 1, 1), ladder.length);
  }

  function setAriaDisabled(btn, off) {
    if (btn) btn.setAttribute("aria-disabled", off ? "true" : "false");
  }

  function render(block) {
    var lang = langFor(block);
    var ladder = ladderOf(block, lang);
    if (!ladder.length) return;
    var k = shownRung(block, ladder);
    var active = ladder[k - 1];

    block.querySelectorAll("pre[data-lang]").forEach(function (p) {
      p.classList.toggle("active", p === active);
    });
    block.querySelectorAll(".approach-note").forEach(function (n) {
      n.classList.toggle(
        "active",
        n.getAttribute("data-lang") === lang && +n.getAttribute("data-rung") === k
      );
    });
    block.querySelectorAll(".lang-row button[data-lang]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
    });

    var label = block.querySelector(".approach-label");
    if (label) {
      label.textContent =
        "Approach " + k + " of " + ladder.length + " · " + (active.getAttribute("data-title") || "");
    }
    var comp = block.querySelector(".approach-comp");
    if (comp) {
      comp.textContent =
        active.getAttribute("data-time") + " time · " + active.getAttribute("data-space") + " space";
    }
    var badge = block.querySelector(".approach-badge");
    if (badge) badge.classList.toggle("show", active.hasAttribute("data-rec"));
    setAriaDisabled(block.querySelector(".step-prev"), k <= 1);
    setAriaDisabled(block.querySelector(".step-next"), k >= ladder.length);
  }

  function renderAll() {
    document.querySelectorAll(".code-steps").forEach(render);
  }

  document.addEventListener("click", function (e) {
    var closest = e.target.closest ? e.target.closest.bind(e.target) : null;
    if (!closest) return;
    var btn = closest(".code-steps .lang-row button[data-lang]");
    if (btn) {
      current = btn.getAttribute("data-lang");
      try {
        localStorage.setItem("codeLang", current);
      } catch (e2) {}
      renderAll();
      return;
    }
    var step = closest(".code-steps .step-prev, .code-steps .step-next");
    if (step) {
      if (step.getAttribute("aria-disabled") === "true") return;
      var block = step.closest(".code-steps");
      var ladder = ladderOf(block, langFor(block));
      var k = shownRung(block, ladder);
      var next = k + (step.classList.contains("step-next") ? 1 : -1);
      block._rung = Math.min(Math.max(next, 1), ladder.length);
      render(block);
    }
  });

  renderAll();
})();
