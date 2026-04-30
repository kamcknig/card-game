// Applies the saved theme before Angular boots to avoid a light↔dark flash.
// Defaults to dark when nothing valid is persisted so the boot screen matches
// the in-app default.
(function () {
  var theme = 'dark';
  try {
    var saved = localStorage.getItem('dominion-theme');
    if (saved === 'dark' || saved === 'light') {
      theme = saved;
    }
  } catch (_) { /* localStorage unavailable — fall through to default (dark) */ }
  document.documentElement.setAttribute('data-theme', theme);
})();
