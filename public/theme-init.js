// Applies the theme before first paint. The app's module scripts run after
// the page has painted, so without this a dark-mode page flashes light.
// A plain file rather than an inline script, so the CSP needs no hash.
// Same rule as src/lib/theme.ts: the saved choice, else the system's.
(function () {
  var saved = null;
  try {
    saved = localStorage.getItem("sidebench:site:theme");
  } catch (e) {}
  var dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
})();
