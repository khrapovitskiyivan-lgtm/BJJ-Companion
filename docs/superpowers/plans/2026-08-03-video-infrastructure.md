# Видео-инфраструктура (приёмник) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Приложение принимает и показывает своё видео с Bunny.net Stream: плеер + пайплайн данных + разметка демо/PRO (без коммерческого замка).

**Architecture:** Три изолированных куска. (1) Данные/пайплайн: `data/video-urls.json` формата `{id:{bunny,access?}}` -> `build-data` эмитит `Technique.videoId` и `Technique.videoAccess` (demo выводится из стартового набора, не дублируется). (2) Плеер: `VideoBlock` переписан на Bunny embed-iframe через чистый билдер URL. (3) Разводка на карточке техники: `videoId ? VideoBlock : VideoInterestPrompt`, с закладкой под будущий гейт Фазы 1. Коммерческий замок (token + Telegram Stars + entitlement) НЕ входит.

**Tech Stack:** TanStack Start (React 19, SSR), TypeScript, Node ESM build-скрипты (`scripts/*.mjs`), vitest, Bunny.net Stream (embed-iframe плеер).

## Global Constraints

- В коде и ответах: без эмодзи и без em-dash. Комментарии в коде на русском (как в проекте).
- Хирургические правки, держать стиль окружающего кода. DRY, YAGNI, TDD, частые коммиты.
- Не трогать поле `Technique.isPremium` (устаревает в пользу `videoAccess`, оставить как есть).
- Не угадывать API Bunny: точный формат embed-URL и атрибуты iframe сверить по докам Bunny (WebFetch) в Task 3 Step 1.
- `BUNNY_LIBRARY_ID` публичный (не секрет), читается из `import.meta.env.VITE_BUNNY_LIBRARY_ID` (паттерн VITE_SUPABASE_URL).
- `data/video-urls.json` сейчас пустой `{}`. Переход чистый на Bunny: YouTube-фолбэк из `VideoBlock` УБИРАЕТСЯ (резолвит открытый вопрос спеки #2). Поле `videoUrl?` в типе остаётся (не трогаем), но `build-data` его больше не заполняет.
- Новой телеметрии и SQL в этой фазе НЕТ.
- Тесты: `npx vitest run`. Сборка данных: `node scripts/build-data.mjs`.
- Проверка рантайма ТОЛЬКО через DOM/`javascript_tool` (скриншоты этого приложения таймаутят). Фактический порт превью сверять по `preview_logs` (lovable-vite может слушать 8081, а не назначенный 8080). Проверять обе темы (светлую и тёмную).
- Деплой (`npx vercel --prod --yes --scope ivankhr`) выполняет владелец по готовности; план заканчивается на merge-ready.

**Открытые вопросы спеки и их резолюция:**
- #1 (формат embed-URL/параметры) -> сверяется по докам Bunny в Task 3 Step 1, билдер строит базовый URL, параметры опциональны.
- #2 (судьба YouTube-фолбэка) -> УБИРАЕТСЯ, чистый Bunny (json пуст, потерь нет).
- #3 (первый тестовый ролик) -> для проверки ВИРИНГА используется фейковый guid + плейсхолдер library id (iframe рендерится с верным src и 16:9; реальное воспроизведение требует загрузки ролика в Bunny library, это делает владелец отдельно).

---

### Task 1: Данные и пайплайн (типы + чистая деривация access + build-data)

**Files:**
- Modify: `src/lib/bjj/types.ts` (добавить `videoId?`, `videoAccess?` в `Technique`, после `isPremium?`)
- Create: `scripts/deriveVideoAccess.mjs`
- Test: `src/lib/bjj/videoAccess.test.ts`
- Modify: `scripts/build-data.mjs` (импорт хелпера; множество id стартового набора; эмиссия `videoId`/`videoAccess`; валидатор video-urls)

**Interfaces:**
- Consumes: `data/starter-set.json` (массив бакетов `{title, ids:number[]}`), `data/video-urls.json` (`{ [id:string]: { bunny:string, access?:"demo"|"pro" } }`).
- Produces:
  - `deriveVideoAccess(accessOverride: string | undefined, isInStarter: boolean): "demo" | "pro"` (экспорт из `scripts/deriveVideoAccess.mjs`).
  - `Technique.videoId?: string` (Bunny guid), `Technique.videoAccess?: "demo" | "pro"` (в `types.ts`).
  - `build-data` эмитит эти поля в `generated/techniques.json` (при пустом json оба `undefined` -> в JSON не сериализуются).

- [ ] **Step 1: Добавить поля в тип `Technique`**

В `src/lib/bjj/types.ts`, блок монетизации (сейчас строки 78-80):

```ts
  // Монетизация (появится с платной версией)
  videoUrl?: string;
  isPremium?: boolean;
  // Bunny Stream: guid видео и уровень доступа. Заполняются build-data.
  // videoAccess: "demo" (бесплатно, выводится из стартового набора) | "pro".
  videoId?: string;
  videoAccess?: "demo" | "pro";
```

- [ ] **Step 2: Написать падающий тест деривации access**

Создать `src/lib/bjj/videoAccess.test.ts`. Хелпер лежит в `scripts/` (node-пайплайн; build-data не может импортировать TS, поэтому чистая функция вынесена в `.mjs` рядом с `derive-styles.mjs`). Импорт через относительный путь:

```ts
import { describe, it, expect } from "vitest";
// Пайплайн-хелпер лежит в scripts/ (импортируется build-data.mjs, который не читает TS).
import { deriveVideoAccess } from "../../../scripts/deriveVideoAccess.mjs";

describe("deriveVideoAccess", () => {
  it("нет override, техника в стартовом наборе -> demo", () => {
    expect(deriveVideoAccess(undefined, true)).toBe("demo");
  });
  it("нет override, техника вне набора -> pro", () => {
    expect(deriveVideoAccess(undefined, false)).toBe("pro");
  });
  it("override pro перебивает членство в наборе", () => {
    expect(deriveVideoAccess("pro", true)).toBe("pro");
  });
  it("override demo перебивает отсутствие в наборе", () => {
    expect(deriveVideoAccess("demo", false)).toBe("demo");
  });
  it("невалидный override игнорируется, падаем на членство", () => {
    expect(deriveVideoAccess("free", true)).toBe("demo");
  });
});
```

- [ ] **Step 3: Запустить тест, убедиться что падает**

Run: `npx vitest run src/lib/bjj/videoAccess.test.ts`
Expected: FAIL, ошибка резолва модуля `../../../scripts/deriveVideoAccess.mjs` (файл ещё не создан).

- [ ] **Step 4: Создать хелпер деривации**

Создать `scripts/deriveVideoAccess.mjs`:

```js
// Уровень доступа к видео. Явный override (demo|pro) из video-urls.json имеет
// приоритет; иначе demo если техника в стартовом наборе (уже курирован как
// «бесплатно новичку»), иначе pro. Single-source: демо не дублируется в json.
export function deriveVideoAccess(accessOverride, isInStarter) {
  if (accessOverride === 'demo' || accessOverride === 'pro') return accessOverride;
  return isInStarter ? 'demo' : 'pro';
}
```

- [ ] **Step 5: Запустить тест, убедиться что проходит**

Run: `npx vitest run src/lib/bjj/videoAccess.test.ts`
Expected: PASS (Test Files 1 passed, Tests 5 passed).

- [ ] **Step 6: Подключить деривацию и валидатор в build-data**

В `scripts/build-data.mjs`:

6a. Добавить импорт рядом с импортом derive-styles (после строки 7):

```js
import { deriveVideoAccess } from './deriveVideoAccess.mjs';
```

6b. После чтения `starterSet` (сейчас строка 53) добавить плоское множество id набора:

```js
// Множество id стартового набора (для вывода demo-доступа к видео)
const starterIds = new Set(starterSet.flatMap((b) => b.ids));
```

6c. В `techniques.map` заменить строку эмиссии видео. Было (строка 90):

```js
    videoUrl: videoUrls[r.id] || undefined,
```

Стало:

```js
    videoId: videoUrls[r.id]?.bunny || undefined,
    videoAccess: videoUrls[r.id]
      ? deriveVideoAccess(videoUrls[r.id].access, starterIds.has(parseInt(r.id, 10)))
      : undefined,
```

6d. Добавить валидатор video-urls в блок валидации, сразу после цикла валидации стартового набора (после строки 146, перед `--- Проверка циклических зависимостей ---`):

```js
// --- валидация видео-разметки (Bunny) ---
for (const [key, entry] of Object.entries(videoUrls)) {
  if (!validIds.has(parseInt(key, 10))) errs.push(`video-urls: неизвестный id ${key}`);
  if (!entry || typeof entry.bunny !== 'string' || !entry.bunny.trim())
    errs.push(`video-urls id ${key}: пустой bunny (guid)`);
  if (entry && entry.access !== undefined && entry.access !== 'demo' && entry.access !== 'pro')
    errs.push(`video-urls id ${key}: access должен быть demo|pro, а не «${entry.access}»`);
}
```

- [ ] **Step 7: Прогнать build-data (позитив + негатив), вернуть чистое состояние**

7a. Позитив. Run: `node scripts/build-data.mjs`
Expected: `✅ Все ссылки валидны`, `OK: 340 техник ...`, exit 0. Так как `video-urls.json` пуст, эмитированный `generated/techniques.json` не меняется (`videoId`/`videoAccess` = undefined, в JSON не попадают). Проверить отсутствие диффа:
Run: `git diff --stat src/lib/bjj/generated/techniques.json`
Expected: пусто (файл не изменился).

7b. Негатив (валидатор ловит мусор). Временно записать в `data/video-urls.json`:

```json
{ "999999": { "bunny": "x" }, "14": { "bunny": "" }, "1": { "bunny": "g", "access": "free" } }
```

Run: `node scripts/build-data.mjs`
Expected: exit 1, среди `ОШИБКИ ДАННЫХ` строки: `video-urls: неизвестный id 999999`, `video-urls id 14: пустой bunny (guid)`, `video-urls id 1: access должен быть demo|pro, а не «free»`.

7c. Вернуть пустой файл. Записать в `data/video-urls.json`:

```json
{}
```

Run: `node scripts/build-data.mjs`
Expected: exit 0, `OK: 340 техник`.

- [ ] **Step 8: Коммит**

```bash
git add src/lib/bjj/types.ts scripts/deriveVideoAccess.mjs src/lib/bjj/videoAccess.test.ts scripts/build-data.mjs
git commit -m "feat(video): пайплайн Bunny videoId/videoAccess + валидатор (демо из стартового набора)"
```

---

### Task 2: Конфиг Bunny и билдер embed-URL

**Files:**
- Create: `src/lib/bjj/videoConfig.ts`
- Test: `src/lib/bjj/videoConfig.test.ts`

**Interfaces:**
- Produces:
  - `BUNNY_LIBRARY_ID: string | undefined` (из `import.meta.env.VITE_BUNNY_LIBRARY_ID`).
  - `bunnyEmbedUrl(videoId: string, libraryId?: string): string` (чистая; `libraryId` по умолчанию `BUNNY_LIBRARY_ID`, параметризован для тестов).

- [ ] **Step 1: Написать падающий тест билдера URL**

Создать `src/lib/bjj/videoConfig.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bunnyEmbedUrl } from "./videoConfig";

describe("bunnyEmbedUrl", () => {
  it("строит embed-URL из library id и guid", () => {
    expect(bunnyEmbedUrl("abc-123", "42")).toBe(
      "https://iframe.mediadelivery.net/embed/42/abc-123",
    );
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `npx vitest run src/lib/bjj/videoConfig.test.ts`
Expected: FAIL, модуль `./videoConfig` не найден.

- [ ] **Step 3: Создать конфиг**

Создать `src/lib/bjj/videoConfig.ts`:

```ts
// Конфиг плеера Bunny.net Stream. LIBRARY_ID публичный (не секрет), из env.
export const BUNNY_LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID as
  | string
  | undefined;

// Строит embed-URL Bunny iframe-плеера. libraryId параметризован для тестов.
// Формат: https://iframe.mediadelivery.net/embed/{libraryId}/{guid}
// Токен-параметр (Фаза 1 монетизации) добавится здесь одной точкой.
export function bunnyEmbedUrl(
  videoId: string,
  libraryId: string | undefined = BUNNY_LIBRARY_ID,
): string {
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
}
```

- [ ] **Step 4: Запустить тест, убедиться что проходит**

Run: `npx vitest run src/lib/bjj/videoConfig.test.ts`
Expected: PASS (Test Files 1 passed, Tests 1 passed).

- [ ] **Step 5: Коммит**

```bash
git add src/lib/bjj/videoConfig.ts src/lib/bjj/videoConfig.test.ts
git commit -m "feat(video): конфиг Bunny library id + чистый билдер embed-URL"
```

---

### Task 3: Плеер VideoBlock на Bunny + разводка карточки + рантайм-проверка

**Files:**
- Modify: `src/components/bjj/technique/VideoBlock.tsx` (переписать на Bunny embed)
- Modify: `src/routes/technique.$id.tsx` (строка 106 `videoUrl` -> `videoId`; условие 314-318; коммент про Фазу 1)
- (Временно, для проверки, откатывается) `data/video-urls.json`, `bjj-companion/.env.local`

**Interfaces:**
- Consumes: `Technique.videoId` (Task 1), `bunnyEmbedUrl` (Task 2).
- Produces: `VideoBlock({ videoId, title }: { videoId: string; title: string })` рендерит Bunny iframe 16:9. `technique.$id` показывает `videoId ? VideoBlock : VideoInterestPrompt`.

- [ ] **Step 1: Сверить формат Bunny embed по докам (не угадывать API)**

WebFetch доков Bunny Stream по встраиванию плеера (`https://docs.bunny.net/docs/stream-embedding-videos` или актуальная страница из поиска). Подтвердить: (а) src iframe = `https://iframe.mediadelivery.net/embed/{libraryId}/{videoGuid}`; (б) рекомендуемый атрибут `allow` для iframe; (в) поддержку `loading="lazy"` / `allowfullscreen`. Если формат отличается от предположенного в Task 2 билдере, скорректировать `bunnyEmbedUrl` и его тест ДО правки VideoBlock. Опциональные query-параметры (autoplay/preload/responsive) в этой фазе НЕ добавляем (YAGNI).

- [ ] **Step 2: Переписать VideoBlock на Bunny embed**

Полностью заменить `src/components/bjj/technique/VideoBlock.tsx` (атрибут `allow` привести к подтверждённому в Step 1):

```tsx
import { Play } from "lucide-react";
import { bunnyEmbedUrl } from "@/lib/bjj/videoConfig";

// Плеер Bunny.net Stream (embed-iframe). Демо-фаза: видео открыто всем.
// Токен-защита подключится в Фазе 1 монетизации через bunnyEmbedUrl.
export function VideoBlock({ videoId, title }: { videoId: string; title: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={bunnyEmbedUrl(videoId)}
          title={`Видео: ${title}`}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border">
        <Play className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Видео-разбор техники</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Развести карточку техники на videoId**

В `src/routes/technique.$id.tsx`:

3a. Строка 106, было:

```ts
  const videoUrl = tech.videoUrl;
```

Стало:

```ts
  const videoId = tech.videoId;
```

3b. Блок 313-318, было:

```tsx
      {/* Под описанием: курированное видео (если есть) или тихий крючок «нужен видео-разбор» */}
      {videoUrl ? (
        <VideoBlock url={videoUrl} title={tech.nameRu} />
      ) : (
        <VideoInterestPrompt techniqueId={tech.id} />
      )}
```

Стало:

```tsx
      {/* Под описанием: видео-разбор Bunny (если снято) или тихий крючок «нужен видео-разбор».
          Демо-фаза: любое снятое видео открыто всем. Фаза 1 монетизации подключит здесь замок:
          videoId && (videoAccess === "demo" || userIsPro) ? VideoBlock : videoId ? Paywall : Prompt. */}
      {videoId ? (
        <VideoBlock videoId={videoId} title={tech.nameRu} />
      ) : (
        <VideoInterestPrompt techniqueId={tech.id} />
      )}
```

Импорты `VideoBlock`/`VideoInterestPrompt` (строки 28-29) не трогать.

- [ ] **Step 4: Прогнать тесты и сборку данных (нет регрессий/поломки компиляции)**

Run: `npx vitest run`
Expected: все тесты зелёные (включая новые `videoAccess`/`videoConfig`).

Run: `node scripts/build-data.mjs`
Expected: exit 0, `OK: 340 техник`.

- [ ] **Step 5: Рантайм-проверка через DOM (временный фикстур)**

5a. Временно записать в `data/video-urls.json` (id 14 «Крест сзади/контроль» в стартовом наборе -> demo; id 50 «Книбар» вне набора -> pro):

```json
{ "14": { "bunny": "test-guid" }, "50": { "bunny": "test-guid" } }
```

5b. В `bjj-companion/.env.local` добавить плейсхолдер (реальный id владелец впишет позже):

```
VITE_BUNNY_LIBRARY_ID=0
```

5c. Run: `node scripts/build-data.mjs`, затем проверить деривацию в сгенерированных данных:

```bash
node -e "const t=require('./src/lib/bjj/generated/techniques.json'); const f=id=>t.find(x=>x.id===id); console.log(14, f(14).videoId, f(14).videoAccess); console.log(50, f(50).videoId, f(50).videoAccess)"
```

Expected: `14 test-guid demo` и `50 test-guid pro`.

5d. Поднять превью (`preview_start` конфиг `bjj-companion`), СВЕРИТЬ фактический порт по `preview_logs` (lovable-vite может слушать 8081). На нужном порту:
- Навигация на `/technique/14`, через `javascript_tool` проверить DOM: есть `iframe` с `src`, содержащим `iframe.mediadelivery.net/embed/0/test-guid`, обёртка с `padding-bottom: 56.25%` (16:9). Скриншоты НЕ использовать (таймаутят).
- Навигация на `/technique/50`: тот же Bunny-iframe (в демо-фазе pro тоже показывается).
- Навигация на `/technique/2` (без видео): в DOM нет video-iframe, присутствует текст крючка «Видео скоро: снимаем разборы» (VideoInterestPrompt).
- Переключить тёмную тему (стаб/тумблер), убедиться что блок читаем в обеих темах (рамка/фон через токены border/card).
- `read_console_messages`: без ошибок из своего кода (известный tg-стаб и dev-шум data-tsd-source игнорировать).

- [ ] **Step 6: Откатить фикстур (не шипить фейковый guid)**

6a. Вернуть `data/video-urls.json` в `{}`:

```json
{}
```

6b. Run: `node scripts/build-data.mjs`
Expected: exit 0. Проверить, что видео-полей в данных нет:

```bash
node -e "const t=require('./src/lib/bjj/generated/techniques.json'); console.log('with video:', t.filter(x=>x.videoId).length)"
```

Expected: `with video: 0`.

6c. `git diff --stat src/lib/bjj/generated/techniques.json` -> пусто. Плейсхолдер `VITE_BUNNY_LIBRARY_ID=0` в `.env.local` можно оставить (файл не в git) или убрать; на прод env владелец задаёт реальный id отдельно.

- [ ] **Step 7: Коммит**

```bash
git add src/components/bjj/technique/VideoBlock.tsx src/routes/technique.$id.tsx
git commit -m "feat(video): плеер Bunny embed + разводка карточки (videoId), закладка под Фазу 1"
```

---

## Self-Review

**Spec coverage:**
- Хостинг Bunny -> Task 2 (конфиг/URL) + Task 3 (плеер). ✓
- Только приёмник, без замка -> замок явно вне scope; закладка-коммент в Task 3 Step 3b. ✓
- Плеер Bunny embed-iframe (1:1 замена YouTube) -> Task 3 Step 2. ✓
- Демо/PRO выводится из стартового набора, не дублируется, `access`-override -> Task 1 (deriveVideoAccess + starterIds). ✓
- Формат `video-urls.json` `{id:{bunny,access?}}` + валидатор -> Task 1 Step 6d, 7b. ✓
- Типы `videoId`/`videoAccess`, `isPremium` не трогать, `videoUrl` оставить в типе -> Task 1 Step 1 + Global Constraints. ✓
- Тестирование: валидатор (позитив+негатив), юнит деривации, рантайм demo+pro+без-видео, обе темы -> Task 1 Step 5/7, Task 3 Step 5. ✓
- Открытые вопросы #1/#2/#3 -> резолюции в шапке + Task 3 Step 1/5. ✓

**Placeholder scan:** запрещённых заглушек (TBD/«добавить обработку»/«тесты для вышеописанного») нет; весь код приведён.

**Type consistency:** `deriveVideoAccess(accessOverride, isInStarter)` вызывается в build-data (Step 6c) с `videoUrls[r.id].access` и `starterIds.has(...)` — совпадает с сигнатурой и тестом (Step 2). `bunnyEmbedUrl(videoId, libraryId?)` из Task 2 вызывается в VideoBlock как `bunnyEmbedUrl(videoId)` — совпадает. `VideoBlock({videoId, title})` вызывается в technique.$id как `<VideoBlock videoId={videoId} title=.../>` — совпадает. `Technique.videoId`/`videoAccess` объявлены в Task 1, читаются в Task 3. ✓
