/* Theme toggle. The anti-FOUC init (reading localStorage and setting
   data-theme) runs inline in each page's <head> before first paint; this
   file only builds the nav control and handles clicks. The site defaults to
   light; a stored choice of "light" or "dark" overrides that. */
(function () {
  "use strict";

  var SUN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function current() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  }

  function apply(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}
  }

  function build() {
    var links = document.querySelector("nav.top .links");
    if (!links || links.querySelector(".theme-toggle")) return;

    var btn = document.createElement("button");
    btn.className = "theme-toggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle light and dark theme");
    btn.title = "Toggle theme";

    function refresh() {
      // show the icon for the theme you would switch TO
      btn.innerHTML = current() === "light" ? MOON : SUN;
    }
    refresh();

    btn.addEventListener("click", function () {
      apply(current() === "light" ? "dark" : "light");
      refresh();
    });

    // sit just before the GitHub link if present, else at the end
    var gh = links.querySelector('a[href*="github.com"]');
    if (gh) links.insertBefore(btn, gh);
    else links.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
