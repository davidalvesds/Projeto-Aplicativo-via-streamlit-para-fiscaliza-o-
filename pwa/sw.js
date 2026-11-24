const NOME_CACHE = "contratos-app-v1";

const ARQUIVOS_PARA_GUARDAR = [
  "./",
  "index.html",
  "style.css",
  "config.js",
  "db.js",
  "app.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(NOME_CACHE).then((cache) => cache.addAll(ARQUIVOS_PARA_GUARDAR))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== NOME_CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  if (evento.request.url.includes("script.google.com")) return;

  evento.respondWith(
    caches.match(evento.request).then((respostaEmCache) => {
      return respostaEmCache || fetch(evento.request);
    })
  );
});
