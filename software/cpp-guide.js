(function () {
  "use strict";

  var controls = document.querySelector(".cpp-problem-controls");
  var rows = Array.prototype.slice.call(
    document.querySelectorAll(".cpp-problem-row")
  );
  var count = document.querySelector(".cpp-problem-count");
  if (!controls || !rows.length) return;

  function apply(pattern) {
    var visible = 0;
    rows.forEach(function (row) {
      var patterns = (row.getAttribute("data-pattern") || "").split(/\s+/);
      var show = pattern === "all" || patterns.indexOf(pattern) >= 0;
      row.hidden = !show;
      if (show) visible += 1;
    });
    controls.querySelectorAll("button[data-pattern]").forEach(function (button) {
      button.classList.toggle(
        "active",
        button.getAttribute("data-pattern") === pattern
      );
      button.setAttribute(
        "aria-pressed",
        button.getAttribute("data-pattern") === pattern ? "true" : "false"
      );
    });
    if (count) {
      count.textContent =
        visible + (visible === 1 ? " problem shown" : " problems shown");
    }
  }

  controls.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-pattern]");
    if (button) apply(button.getAttribute("data-pattern"));
  });

  apply("all");
})();
