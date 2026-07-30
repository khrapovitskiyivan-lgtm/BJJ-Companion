# Коронка + личный слой графа — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переименовать «избранное» в «коронку» (звезда -> корона, смысл «приём, на который ставишь») и оживить граф `/map` как личную карту: читаемый статус, метка рекомендации, корона на узлах-коронках.

**Architecture:** Коронка = существующее множество избранного, переиспользуем `useFavorites` без миграций (меняем только UI-копию и иконку). Личный слой графа вливается в `data` узлов React Flow (`crown`/`recommended`), рендерится в `TechniqueNode`. Логику подбора (`recommend.ts`/`workout.ts`) не трогаем — новых противоречий не вносим.

**Tech Stack:** TanStack Start (React 19), React Flow (@xyflow/react), lucide-react, Tailwind CSS 4, vitest.

## Global Constraints

- НЕ переименовывать внутренние идентификаторы избранного: `bjj.favorites.v1`, колонка `favorites_data`, событие `favorite_toggle`, хук `useFavorites`, тип `FavoritesMap`, `StatListKind="favorites"`, `openList="favorites"`. Меняется ТОЛЬКО пользовательская копия и иконка (иначе ломается облачная синхронизация и нужен SQL).
- Логику `recommend.ts` и `workout.ts` НЕ менять (этот заход только вводит и отражает коронку).
- Данные техник не меняются: `node scripts/build-data.mjs` не запускать.
- В коде и текстах: без эмодзи и без em-dash. Комментарии по-русски.
- Обе темы (светлая/тёмная) должны читаться.
- Граф проверяется через DOM (`javascript_tool`): скриншоты React Flow в превью стабильно таймаутят. Обязателен попарный детектор пересечений узлов (`getBoundingClientRect`).
- Компонентных (RTL) тестов в проекте нет — флоу и UI верифицируются рантаймом через DOM, не vitest. Это осознанное следование конвенции репозитория, а не пропуск тестов.
- Превью-сервер: launch-конфиг `bjj-companion` (порт 8080) в КОРНЕВОМ `.claude/launch.json` умбрелла-репо.

---

### Task 1: Ребрендинг коронки — иконка и копия (карточка техники + «Моя игра»)

**Files:**
- Modify: `src/routes/technique.$id.tsx` (импорт иконки, aria-label, иконка в шапке, комментарий)
- Modify: `src/components/bjj/ProgressTop.tsx` (импорт иконки, иконка + лейбл стата)
- Modify: `src/routes/progress.tsx` (заголовок списка, пустое состояние)

**Interfaces:**
- Consumes: `useFavorites()` -> `{ favorites, toggleFavorite }` (без изменений), `track("favorite_toggle", id)` (без изменений).
- Produces: ничего программного — только пользовательская копия/иконка. Внутренние идентификаторы не меняются.

- [ ] **Step 1: technique.$id.tsx — заменить иконку Star на Crown в импорте**

В блоке импорта из `lucide-react` (строки 11-22) заменить `  Star,` на `  Crown,`.

- [ ] **Step 2: technique.$id.tsx — обновить комментарий и aria-label**

Строка 111, заменить:
```tsx
  // Избранное: звезда в шапке карточки
```
на:
```tsx
  // Коронка: корона в шапке карточки (техника, на которую ставишь)
```
Строка 182, заменить:
```tsx
            aria-label={isFav ? "Убрать из избранного" : "В избранное"}
```
на:
```tsx
            aria-label={isFav ? "Убрать коронку" : "Отметить коронкой"}
```

- [ ] **Step 3: technique.$id.tsx — заменить иконку в разметке**

Строка 186, заменить:
```tsx
            <Star className="h-4 w-4" fill={isFav ? "var(--brand-gold-ink)" : "none"} />
```
на:
```tsx
            <Crown className="h-4 w-4" fill={isFav ? "var(--brand-gold-ink)" : "none"} />
```

- [ ] **Step 4: ProgressTop.tsx — импорт и стат-строка**

Строка 2: в импорте из `lucide-react` заменить `Star` на `Crown`.
Строки 197-198, заменить:
```tsx
            icon={<Star className="h-4 w-4 shrink-0" style={{ color: "var(--brand-gold-ink)" }} />}
            label="Избранное"
```
на:
```tsx
            icon={<Crown className="h-4 w-4 shrink-0" style={{ color: "var(--brand-gold-ink)" }} />}
            label="Коронки"
```

- [ ] **Step 5: progress.tsx — заголовок списка и пустое состояние**

Строка 148, заменить:
```tsx
                    : "Избранные техники"}{" "}
```
на:
```tsx
                    : "Твои коронки"}{" "}
```
Строка 160-161, заменить:
```tsx
                    : "Пока пусто. Отмечай техники звездой на карточке — они появятся здесь."}
```
на:
```tsx
                    : "Пока пусто. Отмечай коронкой (корона в шапке техники) те приёмы, на которые ставишь."}
```
(Опционально) строка 63, комментарий «.../ «В процессе» / «Избранное»» можно поправить на «Коронки» — не обязательно.

- [ ] **Step 6: Прогнать тесты и типы**

Run: `cd bjj-companion && npx vitest run`
Expected: PASS, число тестов не изменилось (правки только по копии/иконке).

- [ ] **Step 7: Рантайм-проверка карточки и «Моей игры»**

Открыть превью (launch-конфиг `bjj-companion`, порт 8080). На карточке любой техники (`/technique/1`):
- в шапке иконка короны (не звезды); тап делает её золотой (`--brand-gold-ink`), `aria-label` меняется на «Убрать коронку».
Через `javascript_tool` проверить, что корона отмечена в сторе и стат обновился:
```js
document.querySelector('[aria-label="Убрать коронку"]') !== null
```
На «Моей игре» (`/progress`): стат называется «Коронки», тап раскрывает список «Твои коронки» с отмеченной техникой. Проверить в обеих темах.

- [ ] **Step 8: Commit**

```bash
cd bjj-companion && git add src/routes/technique.\$id.tsx src/components/bjj/ProgressTop.tsx src/routes/progress.tsx
git commit -m "feat(коронка): звезда -> корона в UI (избранное = коронка, вариант A)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Личный слой графа — статус читаемый, метка рекомендации, корона на узлах

**Files:**
- Modify: `src/components/bjj/flow/TechniqueNode.tsx` (тип узла + рендер тона статуса, метки «Следующее», короны)
- Modify: `src/components/bjj/flow/TechniqueFlow.tsx` (импорт `useFavorites`, `recommendedId`, инъекция `crown`/`recommended` в data узлов)

**Interfaces:**
- Consumes: `useFavorites()` -> `{ favorites }` (`FavoritesMap = Record<number, true>`); `nextToLearn(techniques, progress, belt, count, {goal,gi,noGi})` и `currentFocus(techniques, progress)` из `recommend.ts` (без изменений); `progress` из `useProgress()`.
- Produces: расширенный тип `TechNode` data с полями `crown?: boolean` и `recommended?: boolean`, потребляемый только внутри `TechniqueNode`.

- [ ] **Step 1: TechniqueNode.tsx — импорт иконки Crown**

Строка 3, заменить:
```tsx
import { ArrowUpRight } from "lucide-react";
```
на:
```tsx
import { ArrowUpRight, Crown } from "lucide-react";
```

- [ ] **Step 2: TechniqueNode.tsx — расширить тип и добавить карту тонов статуса**

Строка 34, заменить:
```tsx
export type TechNode = Node<TechNodeData & { status?: ProgressStatus; dimmed?: boolean }, "tech">;
```
на:
```tsx
export type TechNode = Node<
  TechNodeData & { status?: ProgressStatus; dimmed?: boolean; crown?: boolean; recommended?: boolean },
  "tech"
>;

// Мягкий тон фона узла по статусу прогресса — чтобы статус читался, а не только по 8px точке.
const STATUS_TINT: Record<ProgressStatus, string> = {
  done: "color-mix(in oklch, var(--status-done) 10%, var(--color-card))",
  in_progress: "color-mix(in oklch, var(--status-progress) 10%, var(--color-card))",
  not_started: "var(--color-card)",
};
```

- [ ] **Step 3: TechniqueNode.tsx — прочитать новые поля и затонировать фон**

В теле `TechniqueNode` после строки 58 (`const gc = GROUP_COLOR[t.group];`) добавить:
```tsx
  const crown = !!data.crown;
  const recommended = !!data.recommended;
```
В style корневого div (строка 71) заменить:
```tsx
        background: "var(--color-card)",
```
на:
```tsx
        background: STATUS_TINT[status],
```

- [ ] **Step 4: TechniqueNode.tsx — метки в строке группы (без абсолютного позиционирования)**

Заменить блок строки группы (строки 80-83):
```tsx
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-muted-foreground)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: gc, flex: "none" }} />
        <span style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}>{GROUP_LABEL[t.group]}</span>
      </div>
```
на:
```tsx
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-muted-foreground)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: gc, flex: "none" }} />
        <span
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {GROUP_LABEL[t.group]}
        </span>
        {(recommended || crown) && (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, flex: "none" }}>
            {recommended && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  color: "var(--color-primary)",
                  background: "color-mix(in oklch, var(--color-primary) 14%, transparent)",
                  borderRadius: 5,
                  padding: "1px 4px",
                  lineHeight: 1.3,
                }}
              >
                Следующее
              </span>
            )}
            {crown && (
              <Crown
                aria-label="Коронка"
                style={{ width: 13, height: 13, color: "var(--brand-gold-ink)", fill: "var(--brand-gold-ink)", flex: "none" }}
              />
            )}
          </span>
        )}
      </div>
```

- [ ] **Step 5: TechniqueFlow.tsx — импорт useFavorites и получение множества**

Строка 13, заменить:
```tsx
import { useProgress, useProfile } from "@/lib/bjj/store";
```
на:
```tsx
import { useProgress, useProfile, useFavorites } from "@/lib/bjj/store";
```
После строки 41 (`const { progress } = useProgress();`) добавить:
```tsx
  const { favorites } = useFavorites();
```

- [ ] **Step 6: TechniqueFlow.tsx — memo recommendedId**

После memo `startId` (после строки 53) добавить:
```tsx
  // Постоянная метка «Следующее» на графе: та же рекомендация, что и точка входа,
  // но пересчитывается при смене прогресса (метка съезжает, когда рекомендованное освоил).
  const recommendedId = useMemo(() => {
    const rec =
      nextToLearn(TECHNIQUES, progress, profile.belt, 1, { goal: profile.goal, gi: profile.gi, noGi: profile.noGi })[0] ??
      currentFocus(TECHNIQUES, progress);
    return rec?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.belt, profile.goal, profile.gi, profile.noGi, progress]);
```

- [ ] **Step 7: TechniqueFlow.tsx — инъекция crown/recommended в data узлов**

Заменить эффект инъекции статуса (строки 101-113):
```tsx
  useEffect(() => {
    setRfNodes(
      layoutData.nodes.map((n) =>
        n.type === "tech"
          ? {
              ...n,
              selected: Number(n.id) === activeId,
              data: { ...n.data, status: progress[Number(n.id)] ?? "not_started" },
            }
          : n,
      ),
    );
  }, [layoutData.nodes, progress, activeId, setRfNodes]);
```
на:
```tsx
  useEffect(() => {
    setRfNodes(
      layoutData.nodes.map((n) =>
        n.type === "tech"
          ? {
              ...n,
              selected: Number(n.id) === activeId,
              data: {
                ...n.data,
                status: progress[Number(n.id)] ?? "not_started",
                crown: !!favorites[Number(n.id)],
                recommended: Number(n.id) === recommendedId,
              },
            }
          : n,
      ),
    );
  }, [layoutData.nodes, progress, favorites, recommendedId, activeId, setRfNodes]);
```

- [ ] **Step 8: Прогнать тесты**

Run: `cd bjj-companion && npx vitest run`
Expected: PASS, число тестов не изменилось (логика подбора не тронута; изменения — рендер узлов).

- [ ] **Step 9: Рантайм-проверка графа через DOM**

Открыть превью (`bjj-companion`, порт 8080), перейти на `/map`. Через `javascript_tool`:
- Корона на узле-коронке: отметить технику коронкой на её карточке, вернуться на `/map`, навести фокус на эту технику (поиск), проверить `document.querySelector('.react-flow__node svg[aria-label="Коронка"]')` не null; снять коронку -> исчезает.
- Метка «Следующее»: найти узел с id == рекомендации и убедиться, что в нём есть текст «Следующее». Проверка: узнать рекомендованный id и найти его узел:
```js
[...document.querySelectorAll('.react-flow__node')].some(n => n.textContent.includes('Следующее'))
```
- Тон статуса: у изученной техники фон узла отличается от не начатой (сравнить `getComputedStyle(node).backgroundColor`).
- Непересечение: попарный детектор по узлам:
```js
const r=[...document.querySelectorAll('.react-flow__node')].map(n=>n.getBoundingClientRect());
let hit=false;for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){const a=r[i],b=r[j];if(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)hit=true;}hit
```
Ожидание: `false` (наложений нет — метки внутри границ узла, раскладка не поехала).
- Повторить в тёмной теме (тумблер темы), проверить читаемость короны/метки/тона.

- [ ] **Step 10: Commit**

```bash
cd bjj-companion && git add src/components/bjj/flow/TechniqueNode.tsx src/components/bjj/flow/TechniqueFlow.tsx
git commit -m "feat(граф): личный слой — статус читаемый, метка рекомендации, корона на коронках

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Ребрендинг коронки (копия + иконка, вариант A, внутренние идентификаторы не тронуты) -> Task 1. Покрыто.
- Личный слой графа: (a) статус читаемый -> Task 2 Step 2-3 (STATUS_TINT); (b) метка рекомендации -> Task 2 Step 4/6/7 (recommended + «Следующее»); (c) корона на узлах -> Task 2 Step 4/7 (crown). Покрыто.
- «Логику подбора не трогаем» -> ни одна задача не правит `recommend.ts`/`workout.ts`. Покрыто.
- Ограничение «локальная окрестность» -> отражено в Step 9 (проверка через фокус/поиск), новых требований к коду не создаёт.
- Верификация через DOM + попарный детектор -> Task 2 Step 9. Покрыто.
- Модель данных без миграций -> Global Constraints + Task 1 Interfaces. Покрыто.

**2. Placeholder scan:** плейсхолдеров нет — каждый шаг содержит точный текущий фрагмент и его замену.

**3. Type consistency:** новые поля `crown`/`recommended` объявлены в `TechNode` (Task 2 Step 2), читаются в том же файле (Step 3-4), инъектируются в `TechniqueFlow` (Step 7) с теми же именами. `recommendedId: number | null`, сравнение `Number(n.id) === recommendedId` — типы согласованы. `favorites: FavoritesMap = Record<number, true>`, доступ `favorites[Number(n.id)]` -> `true | undefined`, обёрнут в `!!`. Согласовано.
