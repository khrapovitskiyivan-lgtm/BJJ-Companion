// === UI I18N (каркас) ===
// Контент техник локализуется в data-слое (Technique.content[locale]).
// Здесь — строки интерфейса. Полный перевод UI — отдельный этап; ключи добавляются по мере надобности.
import type { Locale } from "@/lib/bjj/types";

const DICT = {
  ru: {
    appName: "BJJ Companion",
    library: "Библиотека",
    map: "Карта",
    workout: "Тренировка",
    progress: "Прогресс",
    search: "Поиск техники…",
    notStarted: "Не начато",
    inProgress: "В процессе",
    done: "Изучено",
    difficulty: "Сложность",
    prerequisites: "Пререквизиты",
    setupFrom: "Заходы из",
    commonSetups: "Типичные сетапы",
    chainTo: "Продолжения",
    usedIn: "Используется в",
    backToLibrary: "К библиотеке",
    share: "Поделиться",
    concept: "Суть",
    mechanics: "Механика",
    keyPoints: "Ключевые моменты",
    when: "Когда применять",
    mistakes: "Типичные ошибки",
    drills: "Дриллы",
    injuryRisk: "Риск травмы",
    tapWarning: "Когда стучать",
    successRate: "Процент успеха",
    energyCost: "Энергозатраты",
  },
  en: {
    appName: "BJJ Companion",
    library: "Library",
    map: "Map",
    workout: "Workout",
    progress: "Progress",
    search: "Search technique…",
    notStarted: "Not started",
    inProgress: "In progress",
    done: "Mastered",
    difficulty: "Difficulty",
    prerequisites: "Prerequisites",
    setupFrom: "Entries from",
    commonSetups: "Common setups",
    chainTo: "Follow-ups",
    usedIn: "Used in",
    backToLibrary: "Back to library",
    share: "Share",
    concept: "Concept",
    mechanics: "Mechanics",
    keyPoints: "Key points",
    when: "When to use",
    mistakes: "Common mistakes",
    drills: "Drills",
    injuryRisk: "Injury risk",
    tapWarning: "When to tap",
    successRate: "Success rate",
    energyCost: "Energy cost",
  },
} as const;

export type UIKey = keyof (typeof DICT)["ru"];

export function t(locale: Locale, key: UIKey): string {
  return DICT[locale]?.[key] ?? DICT.ru[key];
}
