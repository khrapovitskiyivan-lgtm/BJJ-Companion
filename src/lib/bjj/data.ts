// === TECHNIQUES DATA ===
// Источник правды: data/techniques.csv → node scripts/build-data.mjs → generated/techniques.json
import { useEffect, useState } from "react";
import raw from "./generated/techniques.json";
import type { Locale, Technique, TechniqueContent } from "./types";

export const TECHNIQUES: Technique[] = raw as unknown as Technique[];

export const TECH_BY_ID: Record<number, Technique> = Object.fromEntries(
  TECHNIQUES.map((t) => [t.id, t]),
);

// Слитые дубли (2026-10-23): старый id -> оставленная карточка. Только для поиска по
// id (старые ссылки /technique/385, отметки прогресса); в списках и графе их нет.
const MERGED: Record<number, number> = { 385: 49, 306: 49, 502: 368, 333: 415, 404: 57, 405: 58, 462: 71 };
for (const [oldId, newId] of Object.entries(MERGED)) TECH_BY_ID[Number(oldId)] = TECH_BY_ID[newId];

// Полные тексты разборов: отдельный чанк (около 660 КБ), грузится один раз по требованию.
type ContentMap = Record<number, Partial<Record<Locale, TechniqueContent>>>;
let contentPromise: Promise<ContentMap> | null = null;
let contentCache: ContentMap | null = null;

export function loadTechniqueContent(): Promise<ContentMap> {
  contentPromise ??= import("./generated/technique-content.json").then((m) => {
    contentCache = m.default as unknown as ContentMap;
    return contentCache;
  });
  return contentPromise;
}

// Контент с фолбэком локали: en пока частично → падаем на ru
function pickLocale(c: Partial<Record<Locale, TechniqueContent>> | undefined, locale: Locale) {
  return c?.[locale] ?? c?.ru;
}

// Хук страницы техники: null, пока чанк не загружен. Первый рендер всегда null
// (и на сервере, и на клиенте) — расхождения гидрации нет.
export function useTechniqueContent(id: number, locale: Locale): TechniqueContent | null {
  const [content, setContent] = useState<TechniqueContent | null>(null);
  useEffect(() => {
    let alive = true;
    if (contentCache) {
      setContent(pickLocale(contentCache[id], locale) ?? null);
      return;
    }
    void loadTechniqueContent().then((map) => {
      if (alive) setContent(pickLocale(map[id], locale) ?? null);
    });
    return () => {
      alive = false;
    };
  }, [id, locale]);
  return content;
}

// Отображаемое имя по локали
export function nameFor(t: Technique, locale: Locale): string {
  return locale === "en" ? t.nameEn : t.nameRu;
}
