(function () {
  "use strict";

  var buttons = Array.prototype.slice.call(
    document.querySelectorAll("[data-work-filter]")
  );
  var cards = Array.prototype.slice.call(
    document.querySelectorAll("[data-work-card]")
  );

  if (!buttons.length || !cards.length) return;

  buttons.forEach(function (button) {
    button.setAttribute(
      "aria-pressed",
      button.classList.contains("active") ? "true" : "false"
    );
    button.addEventListener("click", function () {
      var filter = button.getAttribute("data-work-filter");

      buttons.forEach(function (item) {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });

      cards.forEach(function (card) {
        var kinds = (card.getAttribute("data-kind") || "").split(/\s+/);
        card.hidden = filter !== "all" && kinds.indexOf(filter) === -1;
      });
    });
  });
})();
