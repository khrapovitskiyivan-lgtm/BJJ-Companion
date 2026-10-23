// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Деплой на Vercel: Nitro собирает вывод в .vercel/output (Build Output API v3),
  // который Vercel подхватывает автоматически. Пресет закреплён явно, чтобы не зависеть
  // от авто-детекта. (В Lovable-сборке это переопределение игнорируется и остаётся Cloudflare.)
  nitro: {
    preset: "vercel",
    // Функции во Франкфурте: аудитория в РФ, из США (iad1) первая загрузка была на ~0.5 с дольше.
    // @ts-expect-error тип обёртки Lovable не знает vercel-опций Nitro, но передаёт их (проверено по .vc-config.json)
    vercel: { functions: { regions: ["fra1"] } },
    // Заголовки безопасности (аудит 2026-10-23). frame-ancestors: Telegram Web открывает
    // приложение в iframe — его домены разрешены, чужие сайты встроить не смогут.
    routeRules: {
      "/**": {
        headers: {
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
          "Content-Security-Policy": "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
        },
      },
    },
  },
});
