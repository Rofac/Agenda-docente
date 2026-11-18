/* Guarda la app en el celular para que abra sin internet.
   Al cambiar VERSION, el celular baja la versión nueva la próxima vez que abre la app con internet. */
const VERSION = 'doc-1.0.0';
const ARCHIVOS = ['./', 'index.html', 'manifest.webmanifest', 'static/estilo.css', 'static/legal.js', 'static/app.js', 'static/datos.js', 'static/docente.js', 'static/cursos.js',
  'js/zip.js', 'js/legal_txt.js', 'js/lic.js', 'js/servidor.js', 'js/movil.js', 'lib/sql-wasm.js', 'lib/sql-wasm.wasm',
  'img/favicon.png', 'img/icono-180.png', 'img/icono-192.png', 'img/icono-512.png', 'img/icono-maskable.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
/* sólo se borran las versiones viejas DE ESTA APP (las otras apps de rofac.github.io comparten el mismo lugar) */
const PREFIJO = VERSION.split('-')[0] + '-';
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIJO) && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
/* si no está guardado y la señal es mala, no se queda colgada esperando: a los 8 segundos usa lo que haya */
const conTiempo = (p, ms) => Promise.race([p, new Promise(ok => setTimeout(() => ok(null), ms))]);
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const g = await c.match(e.request, { ignoreSearch: true }); if (g) return g;
    const red = fetch(e.request).then(x => { if (x.ok) c.put(e.request, x.clone()); return x; }).catch(() => null);
    const r = await conTiempo(red, 8000);
    return r || (await c.match('index.html')) || (await red) || Response.error();
  }));
});
