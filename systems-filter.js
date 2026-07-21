/* Color-codes the systems index by its existing category sections and adds a
   search box + category chips at the top. No dependencies. */
(function () {
  "use strict";

  // category name -> [color, icon]
  var PALETTE = {
    "Classic starters": ["#0066cc", "🧱"],
    "Distributed building blocks": ["#7a5af0", "🧩"],
    "Search and discovery": ["#0e9488", "🔍"],
    "Social and messaging": ["#d6336c", "💬"],
    "Media and storage": ["#e8590c", "🎬"],
    "Location and maps": ["#2f9e44", "🗺"],
    "Data pipelines and observability": ["#1098ad", "📊"],
    "Reservations and money": ["#b08900", "💳"],
    "Machine learning systems": ["#6741d9", "🤖"],
    "Off the beaten path": ["#868e96", "🧭"]
  };

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
      var meta = PALETTE[name] || ["#868e96", "•"];
      section.classList.add("cat-section");
      section.style.setProperty("--cat", meta[0]);
      if (h2 && !h2.querySelector(".cat-ico")) {
        var ico = document.createElement("span");
        ico.className = "cat-ico";
        ico.textContent = meta[1] + " ";
        h2.insertBefore(ico, h2.firstChild);
      }
      Array.prototype.forEach.call(ul.querySelectorAll("li"), function (li) {
        li.setAttribute("data-cat", name);
        li.style.setProperty("--cat", meta[0]);
      });
      cats.push({ name: name, color: meta[0], icon: meta[1], section: section });
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
    function makeChip(label, cat, color) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "syschip";
      b.textContent = label;
      if (color) b.style.setProperty("--cat", color);
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
    var allChip = makeChip("All", null, null);
    allChip.classList.add("active");
    cats.forEach(function (c) { makeChip(c.icon + " " + c.name, c.name, c.color); });

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
