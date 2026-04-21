// Applies the saved theme before Angular boots to avoid a light→dark flash.
(function () {
  try {
    var saved = localStorage.getItem('dominion-theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (_) { /* localStorage unavailable — fall through to default (light) */ }
})();
