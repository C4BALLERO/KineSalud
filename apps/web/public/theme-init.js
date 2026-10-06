/* global localStorage, window, document */
// Aplica el tema guardado antes del primer pintado, para que el modo oscuro no
// parpadee en claro al cargar. Archivo externo (no en línea) por la CSP.
// Misma lógica que src/lib/theme.ts (clave "kinesalud:theme": system | light | dark).
(function () {
  var preference = 'system';
  try {
    preference = localStorage.getItem('kinesalud:theme') || 'system';
  } catch {
    // Sin almacenamiento: se sigue al sistema.
  }
  var dark =
    preference === 'dark' ||
    (preference !== 'light' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
