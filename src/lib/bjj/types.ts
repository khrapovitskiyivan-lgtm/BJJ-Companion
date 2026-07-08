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

export interface StyleProfile {
  belt: Belt;
  gi: boolean;
  noGi: boolean;
  theme: "light" | "dark";
  locale: Locale;
  onboardingDone: boolean;
  flexibility?: boolean;
  pressure?: boolean;
  long_limbs?: boolean;
  speed?: boolean;
}

export interface WorkoutConfig {
  duration: 15 | 30 | 45 | 60;
  safety: SafetyMode;
  intensity: Intensity;
  focus: Group | "all";
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
