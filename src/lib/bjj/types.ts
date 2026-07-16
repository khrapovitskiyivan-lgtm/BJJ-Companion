// === TYPES ===
// Источник данных: data/techniques.csv → scripts/build-data.mjs → generated/techniques.json
export type Belt = "white" | "blue" | "purple" | "brown" | "black";

export type Group =
  | "fundamentals"
  | "position"
  | "submission"
  | "sweep"
  | "guard_pass"
  | "takedown"
  | "transition"
  | "system"
  | "escape"
  | "retention";

export type Locale = "ru" | "en";

// Игровой стиль / архетип. Техника размечается 1–3 стилями (см. scripts/derive-styles.mjs).
export type Style =
  | "pressure_passer"
  | "speed_passer"
  | "closed_guard"
  | "open_guard"
  | "sweeper"
  | "leg_game"
  | "back_hunter"
  | "wrestler"
  | "top_control"
  | "defense_escape";

export type SafetyMode = "smart" | "safe" | "all";
export type Intensity = "light" | "medium" | "hard";
export type ProgressStatus = "not_started" | "in_progress" | "done";
export type EnergyCost = "Low" | "Med" | "High";

// Локализуемый контент техники (ru есть всегда; en добавляется этапом перевода)
export interface TechniqueContent {
  concept: string;      // зачем и почему работает
  mechanics: string;    // шаги "1) ...<br>2) ..."
  keyPoints: string;    // буллеты "• ...<br>• ..."
  when: string;         // когда применять
  mistakes: string;     // буллеты ошибок
  drills: string;       // дриллы для отработки
  injuryRisk: string;   // "Низкий" | "Средний (колено)" | "КРИТИЧНО (...)"
  tapWarning: string;   // когда стучать
}

export interface Technique {
  id: number;
  label: string;          // короткое разговорное имя (RU)
  title: string;          // полное имя "RU (EN)"
  nameRu: string;
  nameEn: string;
  group: Group;
  belt: Belt;
  styles: Style[];
  gi: boolean;
  noGi: boolean;
  legal_ibjjf_gi: boolean;
  legal_ibjjf_nogi: boolean;
  legal_adcc: boolean;
  points_ibjjf: number;
  points_adcc: number;
  tags: string[];
  prerequisites: number[];
  setup_from: number[];
  common_setups: number[];
  chain_to: number[];
  difficulty: number;
  successRate: string;    // "70%" | "N/A"
  energyCost: EnergyCost;
  content: Partial<Record<Locale, TechniqueContent>>;
  // Монетизация (появится с платной версией)
  videoUrl?: string;
  isPremium?: boolean;
}

// Цель тренировок и частота — из онбординга, влияют на рекомендации.
export type Goal = "self-defense" | "competition" | "hobby";
export type Frequency = 1 | 2 | 3 | 4;

export interface StyleProfile {
  belt: Belt;
  gi: boolean;
  noGi: boolean;
  theme: "light" | "dark";
  locale: Locale;
  onboardingDone: boolean;
  goal?: Goal;
  frequency?: Frequency;
  preferredStyles?: Style[]; // выбранные игроком стили игры (заменяют «качества»)
  // Устаревшее — «качества» (заменены на preferredStyles); поля оставлены для совместимости
  flexibility?: boolean;
  pressure?: boolean;
  long_limbs?: boolean;
  speed?: boolean;
  // Профиль пользователя (в т.ч. из Telegram)
  name?: string;
  avatarUrl?: string;
  // Игровой персонаж (составной аватар из public/avatars; avatarUrl выше - фото из Telegram)
  kimono?: "white" | "blue" | "black";
  headId?: "m1" | "m2" | "m3" | "m4" | "m5" | "m6" | "f1" | "f2" | "f3" | "f4" | "f5" | "f6";
  startedAt?: string;   // дата начала занятий BJJ (ISO)
  onboardedAt?: string; // дата прохождения онбординга (ISO)
}

export interface WorkoutConfig {
  duration: 15 | 30 | 45 | 60;
  safety: SafetyMode;
  intensity: Intensity;
  focus: Group | "all";
}

// Запись дневника тренировок — сердце «ежедневного» цикла.
export interface DiaryEntry {
  id: string;
  date: string;              // ISO (yyyy-mm-dd)
  techniqueIds: number[];    // отработанные техники (выбор из поиска)
  note?: string;             // заметка / как прошло
  intensity?: Intensity;     // интенсивность (light | medium | hard)
  wellbeing?: number;        // самочувствие 1..5
  rounds?: number;           // раундов спарринга
  injury?: string;           // заметка о травме / дискомфорте
}

export interface WarmupItem {
  name: string;
  desc: string;
  duration: number;
}

export interface WorkoutDrill {
  technique: Technique;
  minutes: number;
}

export interface Workout {
  belt: Belt;
  warmup: WarmupItem[];
  warmupMinutes: number;
  drills: WorkoutDrill[];
  mainMinutes: number;
  cooldown: WarmupItem[];
  cooldownMinutes: number;
  totalMinutes: number;
  message?: string;
}
