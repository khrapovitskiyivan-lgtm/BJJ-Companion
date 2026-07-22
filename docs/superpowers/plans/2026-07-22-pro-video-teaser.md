# PRO-видео тизер + сигнал спроса — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На карточке каждой техники без видео показать тизер платного видео с кнопкой «Мне интересно», собирающей сигнал спроса по технике в телеметрию.

**Architecture:** Чистый модуль состояния интереса (localStorage + одно событие телеметрии на технику, дедуп локальным множеством) + изолированный UI-компонент тизера + вставка в существующую точку рендера видео на карточке. Реальное видео/покупка вне scope; когда у техники появится `videoUrl`, карточка сама показывает готовый `VideoBlock` вместо тизера.

**Tech Stack:** TanStack Start (React 19), Tailwind CSS 4, TypeScript, vitest (jsdom), Supabase RPC (телеметрия).

## Global Constraints

- Без сырых эмодзи в исходниках (ломают iOS JavaScriptCore в webview Telegram) — только `String.fromCodePoint` при необходимости. Иконки — lucide-react.
- Без em-dash в коде и текстах UI; комментарии по-русски.
- Стор SSR-safe: не читать localStorage в useState-инициализаторе; первый рендер как на сервере, затем эффект/гидрация.
- Цвета по языку дизайн-системы: navy `--primary` = основное действие; золото `--brand-gold` (заливка) / `--brand-gold-ink` (текст/иконка) = бренд/PRO. Пояса не трогать.
- Телеметрия: только имя события + короткая метка (<=32 симв.) + device_id; гейтится `hasConsent()` (в локальном режиме ничего не уходит).
- Проверять рантайм после сборки (зелёный билд != рабочий webview); обе темы.
- Деплой вручную из `bjj-companion/`: `npx vercel --prod --yes --scope ivankhr`; после деплоя curl прода.

---

### Task 1: Модуль интереса `videoInterest` + событие телеметрии

**Files:**
- Modify: `src/lib/bjj/telemetry.ts` (добавить событие в union)
- Create: `src/lib/bjj/videoInterest.ts`
- Test: `src/lib/bjj/videoInterest.test.ts`

**Interfaces:**
- Consumes: `track(event, detail?)` из `./telemetry`.
- Produces:
  - `hasVideoInterest(id: number): boolean` — тапал ли уже (false на сервере).
  - `markVideoInterest(id: number): void` — записать интерес + одно событие `pro_video_interest` с `detail = String(id)`; повторный вызов на тот же id ничего не шлёт.

- [ ] **Step 1: Добавить событие в union телеметрии**

В `src/lib/bjj/telemetry.ts` в тип `TelemetryEvent` добавить строку после `"partner_opened"`:

```ts
  | "partner_opened"
  | "pro_video_interest";
```

- [ ] **Step 2: Написать падающий тест**

Создать `src/lib/bjj/videoInterest.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./telemetry", () => ({ track: vi.fn() }));
import { track } from "./telemetry";
import { hasVideoInterest, markVideoInterest } from "./videoInterest";

describe("videoInterest", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("false до тапа", () => {
    expect(hasVideoInterest(32)).toBe(false);
  });

  it("mark делает интерес true и шлёт событие с id", () => {
    markVideoInterest(32);
    expect(hasVideoInterest(32)).toBe(true);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("pro_video_interest", "32");
  });

  it("повторный mark того же id не шлёт событие (дедуп)", () => {
    markVideoInterest(32);
    markVideoInterest(32);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("разные техники независимы и переживают перезагрузку", () => {
    markVideoInterest(32);
    expect(hasVideoInterest(32)).toBe(true);
    expect(hasVideoInterest(33)).toBe(false);
    const raw = localStorage.getItem("bjj.videoInterest.v1");
    expect(JSON.parse(raw as string)).toEqual([32]);
  });
});
```

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/lib/bjj/videoInterest.test.ts`
Expected: FAIL (Cannot find module './videoInterest' / функции не определены).

- [ ] **Step 4: Реализовать модуль**

Создать `src/lib/bjj/videoInterest.ts`:

```ts
import { track } from "./telemetry";

// Локальная отметка «интересно видео по технике» + одно событие спроса на технику.
// Дедуп множеством в localStorage: одно устройство = один интерес на технику,
// повторный тап не шлёт событие и не перезаписывает.

const KEY = "bjj.videoInterest.v1";

function read(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as number[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function hasVideoInterest(id: number): boolean {
  if (typeof window === "undefined") return false;
  return read().has(id);
}

export function markVideoInterest(id: number): void {
  if (typeof window === "undefined") return;
  const set = read();
  if (set.has(id)) return;
  set.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    // молча: интерес не важнее пользователя
  }
  track("pro_video_interest", String(id));
}
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/lib/bjj/videoInterest.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 6: Коммит**

```bash
git add src/lib/bjj/telemetry.ts src/lib/bjj/videoInterest.ts src/lib/bjj/videoInterest.test.ts
git commit -m "feat: модуль videoInterest + событие pro_video_interest"
```

---

### Task 2: Компонент `ProVideoTeaser`

Компонентных unit-тестов в проекте нет (тестируется чистая логика). Проверка — сборка типов + рантайм на Task 4. Здесь только создать компонент и убедиться, что типы/сборка зелёные.

**Files:**
- Create: `src/components/bjj/technique/ProVideoTeaser.tsx`

**Interfaces:**
- Consumes: `hasVideoInterest`, `markVideoInterest` из `@/lib/bjj/videoInterest`; `Button` из `@/components/bjj/ui`; иконки `Play`, `Lock`, `Check` из `lucide-react`.
- Produces: именованный экспорт `ProVideoTeaser({ techniqueId }: { techniqueId: number })`.

- [ ] **Step 1: Создать компонент**

Создать `src/components/bjj/technique/ProVideoTeaser.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Play, Lock, Check } from "lucide-react";
import { Button } from "@/components/bjj/ui";
import { hasVideoInterest, markVideoInterest } from "@/lib/bjj/videoInterest";

// Тизер платного видео на карточке техники без реального медиа.
// Крючок «Мне интересно» шлёт сигнал спроса по технике (см. videoInterest.ts).
// Когда у техники появится videoUrl, вместо тизера рендерится VideoBlock.
export function ProVideoTeaser({ techniqueId }: { techniqueId: number }) {
  // SSR-safe: первый рендер как на сервере (интереса нет), затем читаем локально.
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(hasVideoInterest(techniqueId));
  }, [techniqueId]);

  function onWant() {
    markVideoInterest(techniqueId);
    setDone(true);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative flex h-24 items-center justify-center gap-2 border-b border-dashed border-border bg-muted/40">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
          <Play className="h-5 w-5 text-muted-foreground" />
        </div>
        <span
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            background: "color-mix(in oklch, var(--brand-gold) 18%, transparent)",
            color: "var(--brand-gold-ink)",
          }}
        >
          <Lock className="h-3 w-3" />
          Скоро в PRO
        </span>
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold">Детальный видео-разбор техники</p>
        {done ? (
          <div className="mt-3">
            <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              Интерес учтён
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Поможет решить, что снять первым.
            </p>
          </div>
        ) : (
          <Button variant="primary" size="md" fullWidth className="mt-3" onClick={onWant}>
            Мне интересно
          </Button>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Проверить сборку типов**

Run: `npx tsc --noEmit`
Expected: без ошибок в `ProVideoTeaser.tsx` (проверить, что `Button` принимает `variant`/`size`/`fullWidth`/`className`/`onClick`; если проп называется иначе — привести к сигнатуре из `src/components/bjj/ui.tsx`).

- [ ] **Step 3: Коммит**

```bash
git add src/components/bjj/technique/ProVideoTeaser.tsx
git commit -m "feat: компонент ProVideoTeaser (тизер + крючок спроса)"
```

---

### Task 3: Заготовка пайплайна видео (`videoUrl` из карты)

**Files:**
- Create: `data/video-urls.json`
- Modify: `scripts/build-data.mjs` (проставить `videoUrl` из карты)
- Modify: `src/routes/technique.$id.tsx` (убрать `as any` у чтения videoUrl)

**Interfaces:**
- Produces: у техник в `src/lib/bjj/generated/techniques.json` появляется поле `videoUrl?: string` (только если id есть в карте).

- [ ] **Step 1: Создать пустую карту**

Создать `data/video-urls.json`:

```json
{}
```

- [ ] **Step 2: Читать карту в build-data и проставлять videoUrl**

В `scripts/build-data.mjs` рядом с чтением CSV (после строки `const csv = readFileSync(...)`) добавить чтение карты:

```js
const videoUrls = JSON.parse(
  readFileSync(join(ROOT, 'data', 'video-urls.json'), 'utf8'),
);
```

В объекте техники (в `.map((r) => { ... return { ... } })`, где формируется запись) добавить поле в возвращаемый объект (например сразу после `energyCost`):

```js
    videoUrl: videoUrls[r.id] || undefined,
```

(Если ключа нет — `undefined`, поле не сериализуется в JSON.)

- [ ] **Step 3: Пересобрать данные и проверить, что пусто не ломает**

Run: `node scripts/build-data.mjs`
Expected: `OK: 310 техник ...`, валидатор чист. `videoUrl` ни у одной техники нет (карта пустая).

- [ ] **Step 4: Проверить, что заполнение карты проставляет URL (временно)**

Временно вписать в `data/video-urls.json`: `{ "32": "https://youtu.be/test" }`, затем:

Run: `node scripts/build-data.mjs && grep -c '"videoUrl":"https://youtu.be/test"' src/lib/bjj/generated/techniques.json`
Expected: `1`.

Вернуть карту к `{}` и пересобрать:

Run: `printf '{}' > data/video-urls.json && node scripts/build-data.mjs`
Expected: снова `OK: 310 техник`.

- [ ] **Step 5: Убрать `as any` у чтения videoUrl**

В `src/routes/technique.$id.tsx` заменить строку `const videoUrl = (tech as any).videoUrl as string | undefined;` на:

```ts
  const videoUrl = tech.videoUrl;
```

(Тип `Technique.videoUrl?: string` уже есть в `types.ts`.)

- [ ] **Step 6: Проверить сборку типов**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 7: Коммит**

```bash
git add data/video-urls.json scripts/build-data.mjs src/lib/bjj/generated/techniques.json src/routes/technique.$id.tsx
git commit -m "feat: пайплайн videoUrl из data/video-urls.json (заготовка)"
```

---

### Task 4: Вставка тизера в карточку + рантайм-проверка

**Files:**
- Modify: `src/routes/technique.$id.tsx` (условный рендер тизера)

**Interfaces:**
- Consumes: `ProVideoTeaser` из `@/components/bjj/technique/ProVideoTeaser`.

- [ ] **Step 1: Импортировать компонент**

В `src/routes/technique.$id.tsx` рядом с импортом `VideoBlock` добавить:

```ts
import { ProVideoTeaser } from "@/components/bjj/technique/ProVideoTeaser";
```

- [ ] **Step 2: Заменить условный рендер видео на тизер-фоллбэк**

Найти (около строки 217):

```tsx
      {/* Под описанием: видео (платная) или фото (бесплатная — ассет добавится позже) */}
      {videoUrl && <VideoBlock url={videoUrl} title={tech.nameRu} />}
```

Заменить на:

```tsx
      {/* Под описанием: реальное видео (если есть) или тизер PRO с крючком спроса */}
      {videoUrl ? (
        <VideoBlock url={videoUrl} title={tech.nameRu} />
      ) : (
        <ProVideoTeaser techniqueId={tech.id} />
      )}
```

- [ ] **Step 3: Запустить превью и проверить рантайм**

- Запустить дев-сервер: `preview_start` с именем из `.claude/launch.json` (или создать конфиг с `npm run dev` и портом).
- Открыть `/technique/32` (Кимура из гарда).
- Ожидается: под описанием виден тизер «Детальный видео-разбор техники» с бейджем «Скоро в PRO» и кнопкой «Мне интересно».

- [ ] **Step 4: Проверить тап и отправку ровно одного события**

- Перехватить `window.fetch` через `javascript_tool` (обёртка с логом; помнить про двойной лог панели — считать вызовы).
- Тапнуть «Мне интересно».
- Ожидается: кнопка сменилась на «Интерес учтён»; ушёл РОВНО один запрос `rpc/bjj_track` с `p_event=pro_video_interest`, `p_detail="32"` (при пройденном гейте согласия; в локальном режиме запроса нет — это норма).
- Повторно тапа нет (кнопки нет). Перезагрузить страницу (`window.location.reload()`), снова открыть `/technique/32`: состояние «Интерес учтён» держится, новых запросов нет.

- [ ] **Step 5: Проверить апгрейд на плеер**

- Временно вписать в `data/video-urls.json` `{ "32": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }`, `node scripts/build-data.mjs`, обновить страницу `/technique/32`.
- Ожидается: вместо тизера рендерится `VideoBlock` (iframe). Вернуть карту к `{}` и пересобрать.

- [ ] **Step 6: Проверить тёмную тему**

- `resize_window` c `colorScheme: "dark"` (или тумблер темы), открыть `/technique/32`.
- Ожидается: тизер читаем, золотой бейдж и navy-кнопка контрастны в обеих темах.

- [ ] **Step 7: Прогнать тесты и типы**

Run: `npx vitest run && npx tsc --noEmit`
Expected: все тесты зелёные (существующие + 4 новых), типов-ошибок нет.

- [ ] **Step 8: Коммит**

```bash
git add src/routes/technique.$id.tsx
git commit -m "feat: тизер PRO-видео на карточке техники без видео"
```

---

### Task 5: SQL белого списка телеметрии (применяет пользователь)

**Files:**
- Create: `docs/sql/2026-07-22-video-interest-telemetry.sql`

- [ ] **Step 1: Создать SQL-файл**

Создать `docs/sql/2026-07-22-video-interest-telemetry.sql`:

```sql
-- Расширение белого списка телеметрии: событие спроса на PRO-видео.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- Только create or replace функции bjj_track (таблица bjj_events уже есть,
-- docs/sql/2026-07-18-telemetry.sql). Приватность прежняя: имя события +
-- короткая метка (technique_id) + device_id, без содержимого.

create or replace function public.bjj_track(p_device uuid, p_event text, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event not in (
    'app_open', 'onboarding_done', 'entry_saved', 'caught_logged', 'workout_run',
    'workout_filter', 'scenario_run', 'section_open', 'reco_click', 'note_saved',
    'consent', 'invite_created', 'invite_accepted', 'partner_opened',
    'pro_video_interest'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;

-- Чтение спроса (что снимать первым):
-- select detail as technique_id, count(*) as interest
-- from public.bjj_events
-- where event = 'pro_video_interest'
-- group by detail order by interest desc;
```

- [ ] **Step 2: Коммит**

```bash
git add docs/sql/2026-07-22-video-interest-telemetry.sql
git commit -m "docs(sql): белый список телеметрии для pro_video_interest"
```

- [ ] **Step 3: Напомнить пользователю применить SQL и задеплоить**

Сообщить пользователю: применить `docs/sql/2026-07-22-video-interest-telemetry.sql` в Supabase SQL Editor (без него событие молча отбрасывается, приложение работает). Затем деплой: `npx vercel --prod --yes --scope ivankhr`, после — curl прода и проверка, что карточка техники отдаёт тизер.

---

## Итоговая проверка (после всех задач)
- `npx vitest run` — все зелёные (включая 4 новых).
- `npx tsc --noEmit` — без ошибок.
- `node scripts/build-data.mjs` — 310 техник, валидатор чист.
- Рантайм в обеих темах: тизер виден, тап шлёт одно событие, состояние персистентно, апгрейд на плеер работает.
- SQL готов к применению; деплой и curl прода после согласия пользователя.
