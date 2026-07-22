/* Adds a search box + category chips above the systems index, derived from
   the page's existing category sections. No dependencies. */
(function () {
  "use strict";

  function txt(el) { return (el.textContent || "").trim(); }

  function init() {
    var uls = document.querySelectorAll("ul.notes.tricks");
    if (!uls.length) return;

    var cats = [];
    Array.prototype.forEach.call(uls, function (ul) {
      var section = ul.closest("section");
      if (!section) return;
      var h2 = section.querySelector("h2");
      var name = h2 ? txt(h2) : "";
      section.classList.add("cat-section");
      Array.prototype.forEach.call(ul.querySelectorAll("li"), function (li) {
        li.setAttribute("data-cat", name);
      });
      cats.push({ name: name, section: section });
    });
    if (!cats.length) return;

    var allCards = document.querySelectorAll("li[data-cat]");
    var bar = document.createElement("div");
    bar.className = "sysfilter wrap";
    var search = document.createElement("input");
    search.type = "search";
    search.className = "sysfilter-search";
    search.placeholder = "Search " + allCards.length + " system designs by name or idea...";
    search.setAttribute("aria-label", "Search system design problems");
    var chipRow = document.createElement("div");
    chipRow.className = "sysfilter-chips";
    bar.appendChild(search);
    bar.appendChild(chipRow);
    cats[0].section.parentNode.insertBefore(bar, cats[0].section);

    var activeCat = null;
    var chipEls = [];
    function makeChip(label, cat) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "syschip";
      b.textContent = label;
      b.addEventListener("click", function () {
        activeCat = cat;
        chipEls.forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        apply();
      });
      chipEls.push(b);
      chipRow.appendChild(b);
      return b;
    }
    var allChip = makeChip("All", null);
    allChip.classList.add("active");
    cats.forEach(function (c) { makeChip(c.name, c.name); });

    function apply() {
      var q = search.value.trim().toLowerCase();
      Array.prototype.forEach.call(allCards, function (li) {
        var okCat = !activeCat || li.getAttribute("data-cat") === activeCat;
        var okQ = !q || txt(li).toLowerCase().indexOf(q) >= 0;
        li.style.display = (okCat && okQ) ? "" : "none";
      });
      cats.forEach(function (c) {
        var vis = Array.prototype.some.call(
          c.section.querySelectorAll("li[data-cat]"),
          function (li) { return li.style.display !== "none"; }
        );
        c.section.style.display = vis ? "" : "none";
      });
    }
    search.addEventListener("input", apply);
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
