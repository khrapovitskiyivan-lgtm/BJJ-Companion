// === TECHNIQUES DATA ===
// Источник правды: data/techniques.csv → node scripts/build-data.mjs → generated/techniques.json
import raw from "./generated/techniques.json";
import type { Locale, Technique, TechniqueContent } from "./types";

export const TECHNIQUES: Technique[] = raw as unknown as Technique[];

export const TECH_BY_ID: Record<number, Technique> = Object.fromEntries(
  TECHNIQUES.map((t) => [t.id, t]),
);

// Контент с фолбэком локали: en пока частично → падаем на ru
export function contentFor(t: Technique, locale: Locale): TechniqueContent | undefined {
  return t.content[locale] ?? t.content.ru;
}

// Отображаемое имя по локали
export function nameFor(t: Technique, locale: Locale): string {
  return locale === "en" ? t.nameEn : t.nameRu;
}
