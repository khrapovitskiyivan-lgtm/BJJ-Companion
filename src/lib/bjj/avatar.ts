// Составной аватар: тело (кимоно + пояс) и голова - отдельные слои.
// Пояс в пути тела берётся из профиля на лету: повышение пояса
// автоматически переодевает персонажа.
import type { StyleProfile } from "./types";

export const HEAD_IDS = ["m1", "m2", "m3", "m4", "m5", "m6", "f1", "f2", "f3", "f4", "f5", "f6"] as const;
export type HeadId = (typeof HEAD_IDS)[number];

export function bodySrc(p: StyleProfile): string {
  return `/avatars/body-${p.kimono ?? "white"}-${p.belt}.webp`;
}

export function headSrc(p: StyleProfile): string {
  return `/avatars/head-${p.headId ?? "m1"}.webp`;
}
