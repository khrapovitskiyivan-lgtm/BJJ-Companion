# Видео-инфраструктура (приёмник) — дизайн

Дата: 2026-08-03. Статус: дизайн согласован, ждёт плана реализации (writing-plans) в следующей сессии.

## Проблема и рамка

Принято решение отснять все техники профессионально в фирменном кимоно (собственная видео-библиотека = главный продаваемый актив под exit-стратегию; см. память bjj-exit-strategy, bjj-monetization-model). Приложение должно быть готово принять и красиво показать своё видео к приходу первых роликов. Съёмка идёт параллельно; порядок в docs/analysis/2026-08-02-video-shooting-order.md (+.xlsx), партия 1 = стартовый набор.

Текущее состояние: `videoUrl?`/`isPremium?` в types (isPremium не задействован), `data/video-urls.json` пустой `{}` -> build-data -> `Technique.videoUrl` -> `technique.$id` (строка ~314): `videoUrl ? <VideoBlock url/> : <VideoInterestPrompt/>`. VideoBlock — YouTube-iframe. Своего хостинга нет.

## Решения (согласованы с владельцем)

1. **Хостинг — Bunny.net Stream.** Дёшево (~$1-2/мес на старте, ~$8/мес при росте; хранение $0.01/GB, доставка ~$0.01/GB, кодирование/CDN/плеер/token-защита встроены), реальная token-защита под будущий PRO, чистый managed-актив (важно под продажу — без техдолга self-hosted и риска буферинга). Сравнение: Cloudflare Stream дороже в разы (минутная модель × рендеры ~$34/мес хранение); self-hosted дёшев деньгами, но дорог усилиями/риском UX/продаваемостью. Bunny выбран.
2. **Объём пункта 1 — только ПРИЁМНИК.** Плеер + пайплайн + разметка демо/PRO. Коммерческий замок (token + Telegram Stars + entitlement + locked-UI) — отдельный цикл, Фаза 1 монетизации, не раньше чем видео снято и метрики собраны.
3. **Плеер — Bunny embed-iframe** (не свой HLS). Минимум кода, 1:1 замена YouTube-iframe, Bunny-плеер даёт адаптив/качество/скорость/субтитры из коробки, token подключится параметром URL в Фазе 1. VideoBlock изолирован — при необходимости кастомного UX заменить точечно позже (YAGNI).
4. **Разметка демо/PRO выводится из стартового набора, не дублируется.** Демо = техника в `starter-set.json` (уже курирован как «бесплатно новичку»); всё остальное по умолчанию PRO; `access` в `video-urls.json` — опциональный override для единичных исключений. Single-source, DRY.

## Архитектура (три изолированных куска)

### 1. Данные и пайплайн
Формат `data/video-urls.json` (курируется вручную, паттерн aliases/starter-set):
```json
{ "14": { "bunny": "<video-guid>" },
  "1":  { "bunny": "<video-guid>", "access": "demo" } }
```
- `bunny` — GUID видео в Bunny Stream library. `access` — опциональный override ("demo" | "pro").
- `scripts/build-data.mjs`: читает video-urls.json; для техники с `bunny` эмитит `Technique.videoId` (guid) и `Technique.videoAccess` = `access` из json, иначе "demo" если id в стартовом наборе, иначе "pro". Валидатор: `bunny` непустой; `access` (если задан) из двух значений; id существует.
- Обратная совместимость: поле `videoUrl` (внешняя ссылка) оставить как фолбэк-путь; основной — Bunny `videoId`.
- Типы: `Technique.videoId?: string`, `Technique.videoAccess?: "demo" | "pro"` (добавить в types.ts; `isPremium` устаревает в пользу videoAccess — оставить пока, не трогать).

### 2. Плеер (VideoBlock)
- Переписать `VideoBlock` на Bunny embed: iframe `https://iframe.mediadelivery.net/embed/{BUNNY_LIBRARY_ID}/{videoId}` (точный формат/параметры сверить по докам Bunny при реализации), 16:9 адаптивный контейнер как сейчас.
- `BUNNY_LIBRARY_ID` — константа/env (публичный library id, не секрет).
- Токен НЕ подключается (демо-фаза, видео открыты); код писать так, чтобы в Фазе 1 добавить token-параметр одной точкой.
- Фолбэк: если у техники старый внешний `videoUrl` (не Bunny) — показать как раньше (YouTube-логику можно сохранить в отдельной ветке или убрать, если внешних не будет; решить при реализации, video-urls.json пуст -> чистый переход).

### 3. Разметка/гейт (задел, без замка)
- `videoAccess` живёт в Technique уже сейчас (заполнен из пайплайна). `technique.$id` СЕЙЧАС показывает любое снятое видео всем (демо-фаза) — замок не подключается.
- Точка будущего гейта: `technique.$id` строка ~314, условие расширится в Фазе 1 до `videoId && (videoAccess==="demo" || userIsPro) ? VideoBlock : (videoId ? PaywallBlock : VideoInterestPrompt)`. Сейчас — просто `videoId ? VideoBlock : VideoInterestPrompt`.

## Состояния экрана (без изменений структуры)
Есть видео (`videoId`) → VideoBlock (Bunny). Нет → VideoInterestPrompt («снимаем разборы» — уже переформулирован). PRO-locked — Фаза 1.

## Что НЕ входит (Фаза 1 монетизации, отдельный цикл)
Token-защита Bunny, Telegram Stars (createInvoiceLink + вебхук successful_payment), entitlement на сервере, locked/paywall-UI, месячный тариф/founder-lifetime. Гейт подключится к готовой точке (videoAccess + условие в technique.$id).

## Тестирование
- build-data: валидатор нового формата (bunny непустой, access валиден, демо выводится из стартового набора) — прогон + негативный кейс.
- Юнит (если чистая функция вывода access вынесена): демо для id из набора, pro для прочих, override перебивает.
- Рантайм (DOM, скриншоты таймаутят): у техники с тестовым Bunny-guid рендерится Bunny-iframe 16:9; без видео — VideoInterestPrompt; проверить одну демо (из набора) и одну pro-технику (обе показываются в демо-фазе).
- Обе темы.

## Открытые (уточнить при реализации, не блокеры)
1. Точный формат Bunny embed URL и параметры (autoplay/preload) — по докам Bunny.
2. Судьба YouTube-фолбэка в VideoBlock (оставить ветку или чистый Bunny) — решить, video-urls.json пуст.
3. Первый тестовый ролик для проверки плеера — загрузить один в Bunny library вручную.
