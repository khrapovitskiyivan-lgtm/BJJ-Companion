# Спека: Семена персонализации (goal-editable + промпт аспирации в «Разрыве»)

Дата: 2026-07-31
Статус: черновик на ревью пользователя
Процесс: brainstorming (Spec-First v2). Item «Дешёвые семена» дорожной карты
`docs/analysis/2026-07-30-personalization-roadmap.md`.

Направление уточнено независимой продуктовой оценкой: авто-засев `preferredStyles`
ОТКЛОНЁН (генератор уже покрыт effectiveStyle-фолбэком из step 2; засев из реальности
даёт тавтологию/ложную аспирацию). Вместо засева — осознанный промпт аспирации.

## Контекст и проблема

Два «семени» из карты. По ходу выяснилось (подтверждено кодом + независимой оценкой):

1. **`goal` неизменяем после онбординга** (единственная запись — `Onboarding.tsx`).
   При этом `goal` — живой тай-брейк подбора (`goalScore` в recommend.ts, используется в
   `nextToLearn`/`learningPath` и в `workoutCluster.ts` для якоря/кластера; `insights.ts`
   learn-next). В награды/статы/дневник/xp НЕ пишется (грепом подтверждено) — смена задним
   числом ничего не ломает, эффект только на будущие рекомендации. Чистая правка.

2. **`preferredStyles` (аспирация) почти у всех пусто** -> `GapCard` («Разрыв») спит
   (`return null`). Исходный мотив «засеять, чтобы подключить стиль к генератору» УСТАРЕЛ:
   step 2 уже использует `effectiveStyleSet = preferredStyles ?? выведенный topStyle`, то
   есть стиль-вес генератора работает у всех без засева. Единственная оставшаяся проблема —
   **дискаверабилити «Разрыва»**. Авто-засев из реальности её «решает» ценой тавтологии
   (`onTrack` гарантированно true в момент засева) и заморозки поля -> позже «расхождение с
   целью, которую не выбирал». Правильное решение — дать выбрать аспирацию осознанно.

## Решения (зафиксированы)

- **A. `goal` редактируемым** в листе игрока.
- **B. Промпт аспирации** в `GapCard`: при пройденном пороге и пустом `preferredStyles`
  вместо `null` показать выбор стиля; пик пишет `preferredStyles` -> активирует «Разрыв» и
  вес генератора. Дедуп через дисмисс (паттерн VideoInterestPrompt).
- **C. Событие показа** «Разрыва»/промпта (метрика: `reco_click` ловит клики, не показы).
- Авто-засев `preferredStyles` — НЕ делаем.

## Область

**В область:** A (goal-editable), B (промпт аспирации + дисмисс), C (телеметрия показа).
**Вне области:** step 3 (карточка-тренер); изменение логики генератора/иерархии сигналов
(step 2 не трогаем); онбординг-шаг стиля (промпт в «Разрыве» его заменяет).

## A. goal-editable (CharacterSheet)

Новая `<Section title="Цель">` в `src/components/bjj/CharacterSheet.tsx`, 4 опции
(`self-defense`/`competition`/`hobby`/`health`) кнопками в том же паттерне, что уже 4 раза
в этом файле (Пояс/Частота/Дни/Стиль): `border-2` + `color-mix` выбранного состояния. Иконки
и подписи как в `Onboarding.tsx::GoalStep` (Shield/Trophy/Smile/Heart). Клик:
`update({ goal: value })`. Разместить после «Формат тренировок», перед «Частота тренировок»
(цель — высокоуровневая настройка). `GOAL_OPTIONS` определить локально в файле (как
`FREQ_OPTIONS`).

## B. Промпт аспирации (GapCard)

### Состояния карточки (чистая функция для тестируемости)
`gapState(input): "hidden" | "prompt" | "ontrack" | "gap"`:
- `doneCount < ARCHETYPE_MIN_DONE || scores.length === 0` -> `"hidden"` (холодный старт).
- иначе если `preferredStyles` пусто: `mounted && !dismissed` -> `"prompt"`, иначе `"hidden"`.
- иначе (аспирация задана): `preferredStyles.includes(scores[0].style)` -> `"ontrack"`, иначе `"gap"`.

`mounted`/`dismissed` — клиентские (SSR-safe): хуки `useState`/`useEffect` вызываются
БЕЗУСЛОВНО в начале компонента (rules-of-hooks), до ранних `return`. `mounted` через
`useEffect(() => setMounted(true), [])`; `dismissed` через `useState` + чтение
`isStyleAspirationDismissed()` только после mount.

### Дисмисс-флаг: новый модуль `src/lib/bjj/styleAspiration.ts`
Паттерн videoInterest.ts (SSR-guard, try/catch):
```ts
const KEY = "bjj.styleAspiration.dismissed.v1";
export function isStyleAspirationDismissed(): boolean // typeof window guard; getItem === "1"
export function dismissStyleAspiration(): void        // typeof window guard; setItem "1"
```

### UI промпта
Когда `gapState === "prompt"`: заголовок «Каким стилем хочешь играть?» + компактный список
10 стилей (`STYLE_ORDER`, `STYLE_META[s].ru`, `STYLE_ICONS[s]`) как чипы/строки; клик по
стилю -> `onPickStyle(s)`; ссылка «Не сейчас» -> `dismissStyleAspiration()` + `setDismissed(true)`.
Тон и рамка как у существующего GapCard (`border border-ring/50 bg-primary/5`).

### Проводка
`GapCard` получает новый проп `onPickStyle?: (s: Style) => void`. В `progress.tsx`
(`useProfile()` уже даёт `profile`; добавить `update`) передать
`onPickStyle={(s) => update({ preferredStyles: [s] })}`. После пика `preferredStyles`
непусто -> карточка перерисуется в реальный «Разрыв» (промпт исчезнет естественно).

## C. Телеметрия показа

Новое событие `gap_shown` (union в `telemetry.ts`), detail = состояние
(`"prompt"` | `"ontrack"` | `"gap"`), дедуп раз в сутки (`dailyDedup`). Шлётся из `GapCard`
эффектом при `mounted`, когда `gapState !== "hidden"`. Whitelist:
`docs/sql/2026-07-31-telemetry-gap-shown.sql` (полный текущий whitelist + `gap_shown`;
применяет пользователь). До применения событие глотается catch.

## Данные / типы

- Новый модуль `styleAspiration.ts`. Никаких изменений схемы данных/техник.
- `GapCard` +проп `onPickStyle`. Событие `gap_shown` в union телеметрии.

## Тестирование

- **Юнит (vitest):** `gapState` — таблица переходов: холодный старт -> hidden; пусто+mounted
  -> prompt; пусто+dismissed -> hidden; аспирация совпала с топом -> ontrack; не совпала -> gap.
- **Рантайм через DOM** (превью `bjj-companion`, порт 8080; это список/лист игрока, не граф —
  скриншоты работают):
  - CharacterSheet: секция «Цель» меняет `goal` (проверить запись в профиль).
  - «Моя игра»: при doneCount>=5 и пустом `preferredStyles` виден промпт «Каким стилем...»;
    клик по стилю -> появляется реальный «Разрыв» с этой аспирацией; «Не сейчас» -> промпт
    исчезает и не возвращается после перезагрузки.
  - Обе темы.
- **Сборка:** `npx vitest run` зелёный; данные техник не трогаются.

## Риски

- **Rules-of-hooks:** хуки в GapCard — безусловно в начале, до ранних return (иначе краш).
- **SSR-mismatch:** промпт/дисмисс — только после mount (паттерн VideoInterestPrompt), иначе
  гидрация разойдётся (GapCard рендерится и на сервере).
- **Плотность «Моей игры»** (экран под UX-наблюдением): промпт заменяет `null`, нового
  постоянного слота не добавляет; дисмисс гасит навсегда.
- **Инвариант step 2:** пик аспирации меняет только вес (effectiveStyle), якорь по-прежнему
  из избранного/в-процессе — логику подбора не трогаем.

## Критерий готовности

- `goal` меняется в листе игрока, влияет на будущие рекомендации, ничего ретроактивно не ломает.
- Пустая аспирация при пройденном пороге -> промпт; пик активирует «Разрыв» и вес генератора;
  дисмисс гасит навсегда. Подтверждено рантаймом в обеих темах.
- `gap_shown` уходит; SQL-whitelist подготовлен.
- Авто-засев `preferredStyles` НЕ добавлен. Логика step 2 не изменена.
- Тесты и сборка зелёные.
