// Service worker BJJ Companion: оффлайн для зала без связи.
// Стратегия: данные техник вшиты в JS-бандлы, пользовательские данные в
// localStorage, поэтому оффлайн = кэш статики + посещённых страниц.
// - /assets/* (хэшированные имена, иммутабельны) — cache-first;
// - навигации — network-first с фоллбэком на кэш того же пути;
// - непосещённый путь без сети — встроенная страничка «Нет сети»;
// - кросс-доменное (Supabase, Telegram) не трогаем.
// При смене VERSION старые кэши вычищаются на activate.

const VERSION = "bjj-sw-v2";
const ASSETS = `${VERSION}-assets`;
const PAGES = `${VERSION}-pages`;

const OFFLINE_HTML = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BJJ Companion — нет сети</title>
<style>body{font-family:system-ui,sans-serif;background:#faf9f5;color:#1c1e2e;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}
div{padding:24px}h1{font-size:20px;margin:0 0 8px}p{font-size:14px;color:#666;margin:0 0 16px}
button{border:0;border-radius:12px;background:#2b2f6b;color:#fff;padding:10px 20px;font-size:14px;font-weight:600}</style></head>
<body><div><h1>Нет сети</h1><p>Этот раздел ещё не открывали онлайн.<br>Разделы, где ты уже бывал, работают без связи.</p>
<button onclick="location.reload()">Попробовать снова</button></div></body></html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Статика: хэшированные ассеты и файлы из public (включая intro.mp4 —
// 1 МБ заставки не должен качаться на каждую новую сессию)
function isStaticAsset(url) {
  if (url.pathname.startsWith("/assets/")) return true;
  return /\.(js|css|woff2?|webp|png|ico|svg|webmanifest|mp4)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase/Telegram мимо

  // Иммутабельная статика: cache-first. Матчим и фетчим по pathname без
  // заголовков запроса: видео браузер просит с Range, Cache API не хранит
  // 206-ответы — а полный 200 в ответ на Range валиден (сервер вправе игнорировать).
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(url.pathname).then(
        (hit) =>
          hit ??
          fetch(url.pathname).then((res) => {
            if (res.ok && res.status === 200) {
              const clone = res.clone();
              caches.open(ASSETS).then((c) => c.put(url.pathname, clone));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Навигации: network-first, фоллбэк на кэш того же пути, дальше — заглушка.
  // Чужой документ не подсовываем: гидрация другого роута — белый экран (грабля 2).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, clone));
          }
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(url.pathname);
          return hit ?? new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
        }),
    );
  }
});
