// ============================================================================
// БАЗОВЫЕ ТИПЫ — пояса и группы техник
// ============================================================================

/**
 * Пояса BJJ в порядке возрастания.
 * Используются для:
 * - фильтрации техник по уровню
 * - раскладки графа (поясные полосы)
 * - визуализации (цвета через CSS-переменные --belt-*)
 * - расчёта прогресса и рекомендаций
 */
export type Belt = "white" | "blue" | "purple" | "brown" | "black";

/**
 * Группы техник — определяют позицию и тип приёма.
 * Используются для:
 * - группировки в библиотеке
 * - фильтрации в графе (колонки/полосы)
 * - рекомендации "похожих техник"
 */
export type TechniqueGroup =
  | "takedown"        // Тейкдауны (броски, проходы в ноги)
  | "guard_pass"      // Проходы гарда
  | "guard"           // Работа из гарда (закрытый, открытый)
  | "sweep"           // Свипы (перевороты из гарда)
  | "side_control"    // Сайд-контроль и переходы
  | "mount"           // Маунт и атаки из маунта
  | "back_control"    // Контроль спины и атаки
  | "half_guard"      // Полугард (атаки и защиты)
  | "turtle"          // Тартл (атаки и защиты)
  | "submission"      // Сабмишны (общая категория)
  | "escape"          // Побеги из позиций
  | "standing"        // Стойки и захваты
  | "self_defense";   // Самооборона

// ============================================================================
// ТЕХНИКА — основная сущность библиотеки
// ============================================================================

/**
 * Техника BJJ — единица контента библиотеки.
 * Загружается из CSV (src/data/techniques.csv) через build-скрипт.
 */
export interface Technique {
  /** Уникальный ID (числовой, соответствует id в CSV) */
  id: number;

  /** Название на русском */
  nameRu: string;

  /** Название на английском */
  nameEn: string;

  /** Короткая метка для отображения в графе (обычно ≤ 16 символов) */
  label: string;

  /** Пояс, на котором изучается техника */
  belt: Belt;

  /** Группа техники (позиция) */
  group: TechniqueGroup;

  /** Доступна в Gi (кимоно) */
  gi: boolean;

  /** Доступна в No-Gi (рашгард) */
  noGi: boolean;

  /** Сложность от 1 до 5 */
  difficulty: 1 | 2 | 3 | 4 | 5;

  /**
   * Примерный процент успешного выполнения.
   * Строка, т.к. может быть "N/A", "~60%", "высокий" и т.п.
   */
  successRate?: string;

  /** Затраты энергии: "низкие" / "средние" / "высокие" */
  energyCost?: string;

  /** Легальна в IBJJF Gi */
  legal_ibjjf_gi: boolean;

  /** Легальна в IBJJF No-Gi */
  legal_ibjjf_nogi: boolean;

  /** Легальна в ADCC */
  legal_adcc: boolean;

  /** Теги для поиска и фильтрации (например: "ручной замок", "ноги") */
  tags: string[];

  // === СВЯЗИ МЕЖДУ ТЕХНИКАМИ (граф) ===

  /** ID техник, которые нужно знать ПЕРЕД изучением этой */
  prerequisites: number[];

  /** ID техник, которые являются логическим ПРОДОЛЖЕНИЕМ этой */
  chain_to: number[];

  /** ID техник, из которых ТИПИЧНО заходят в эту */
  setup_from: number[];

  /** ID техник, в которые ТИПИЧНО заходят из этой */
  common_setups: number[];

  // === ОПЦИОНАЛЬНЫЕ ПОЛЯ (расширения) ===

  /** URL видео-разбора (YouTube embed) */
  videoUrl?: string;

  /** URL обложки/превью (для библиотеки) */
  thumbnailUrl?: string;

  /** Автор/источник техники (например: "Marcelo Garcia", "ATOS") */
  source?: string;

  /** Дата добавления в библиотеку (ISO-строка) */
  addedAt?: string;
}

// ============================================================================
// КОНТЕНТ ТЕХНИКИ — локализованные описания
// ============================================================================

/**
 * Контент техники на конкретном языке.
 * Хранится отдельно от Technique, чтобы поддерживать i18n.
 * Возвращается функцией `contentFor(tech, lang)`.
 */
export interface TechniqueContent {
  /** Краткая концепция (1-2 предложения) */
  concept: string;

  /** Механика выполнения (шаги через <br> или нумерация) */
  mechanics: string;

  /** Ключевые моменты (маркер • или нумерация) */
  keyPoints: string;

  /** Когда применять (ситуации, тайминг) */
  when: string;

  /** Типичные ошибки */
  mistakes: string;

  /** Дриллы для отработки */
  drills: string;

  /** Уровень риска травмы: "Низкий" / "Средний" / "КРИТИЧНО" */
  injuryRisk: string;

  /** Когда стучать (сигналы для tap): "Нет" или описание */
  tapWarning: string;

  /** Дополнительные заметки (опционально) */
  notes?: string;
}

/** Поддерживаемые языки */
export type Lang = "ru" | "en";

/** Контент по языкам для техники */
export type TechniqueContentMap = Partial<Record<Lang, TechniqueContent>>;

// ============================================================================
// ПРОГРЕСС И СТАТУСЫ
// ============================================================================

/**
 * Статус изучения техники.
 * Циклически переключается: not_started → in_progress → done → not_started
 */
export type ProgressStatus = "not_started" | "in_progress" | "done";

export type PrerequisiteLevel = 'required' | 'recommended' | 'optional';

export interface Technique {
  id: number;
  nameEn: string;
  nameRu: string;
  category: string;
  subcategory?: string;
  difficulty: number;
  description: string;
  keyPoints: string[];
  commonMistakes: string[];
  prerequisites: number[];
  prerequisiteLevels?: Record<number, PrerequisiteLevel>; // НОВОЕ ПОЛЕ
  beltLevel?: 'white' | 'blue' | 'purple' | 'brown' | 'black';
  giSpecific?: boolean;
}

/**
 * Карта прогресса: techniqueId → статус.
 * Хранится в localStorage под ключом STORAGE_KEYS.PROGRESS.
 */
export type ProgressMap = Record<number, ProgressStatus>;

// ============================================================================
// ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
// ============================================================================

/** Цель тренировок — влияет на рекомендации */
export type Goal = "self-defense" | "competition" | "hobby";

/** Частота тренировок в неделю — влияет на длину комплексов */
export type Frequency = 1 | 2 | 3 | 4;

/**
 * Профиль пользователя.
 * Заполняется в онбординге, редактируется в профиле.
 * Влияет на:
 * - фильтрацию техник (пояс, gi/nogi)
 * - рекомендации (цель, частота)
 * - генератор тренировок (длительность, фокус)
 */
export interface StyleProfile {
  /** Текущий пояс пользователя */
  belt: Belt;

  /** Тренируется в Gi */
  gi: boolean;

  /** Тренируется в No-Gi */
  noGi: boolean;

  /** Цель тренировок */
  goal?: Goal;

  /** Частота тренировок в неделю */
  frequency?: Frequency;

  /** Дата прохождения онбординга (ISO-строка) */
  onboardedAt?: string;

  /** Тема интерфейса (light/dark) */
  theme?: "light" | "dark";

  /** Имя пользователя (опционально, для облачной синхронизации) */
  name?: string;

  /** Email (для Supabase auth) */
  email?: string;

  /** ID пользователя в Supabase */
  userId?: string;

  /** Дата начала занятий BJJ (для статистики "В BJJ с ...") */
  startedAt?: string;
}

// ============================================================================
// ИСТОРИЯ И АКТИВНОСТЬ
// ============================================================================

/**
 * История активности пользователя.
 * Ключ — дата в формате YYYY-MM-DD, значение — массив timestamps.
 * Используется для:
 * - расчёта streak (дни подряд)
 * - тепловой карты активности
 * - графика прогресса
 */
export type ActivityHistory = Record<string, number[]>;

/**
 * История практики конкретных техник.
 * Ключ — ID техники, значение — массив дат (YYYY-MM-DD).
 * Используется для отображения "когда последний раз делали".
 */
export type PracticeHistory = Record<number, string[]>;

// ============================================================================
// ТРЕНИРОВКИ
// ============================================================================

/** Тип упражнения в тренировке */
export type ExerciseType = "warmup" | "drill" | "sparring" | "cooldown" | "mobility";

/** Интенсивность тренировки */
export type Intensity = "low" | "medium" | "high";

/** Упражнение в тренировке */
export interface WorkoutExercise {
  techniqueId: number;
  type: ExerciseType;
  duration: number; // в секундах
  rounds?: number;
  restBetweenRounds?: number; // в секундах
  notes?: string;
  requiresPartner?: boolean;
}

/** Тренировка */
export interface Workout {
  id: string;
  createdAt: string;
  duration: number; // общая длительность в секундах
  intensity: Intensity;
  focus?: TechniqueGroup;
  exercises: WorkoutExercise[];
  completed?: boolean;
  completedAt?: string;
  notes?: string;
}

/** Конфигурация генератора тренировок */
export interface WorkoutConfig {
  duration: number; // желаемая длительность в минутах
  intensity: Intensity;
  safetyFirst: boolean; // избегать техник с высоким риском
  focus?: TechniqueGroup;
  goal?: Goal;
  frequency?: Frequency;
}

// ============================================================================
// СИТУАЦИИ И РЕШЕНИЯ (solutions.tsx)
// ============================================================================

/** Категория ситуации в спарринге */
export type SituationCategory =
  | "attack"        // Атаки
  | "sweep"         // Свипы
  | "transition"    // Переходы
  | "escape"        // Побеги
  | "submission";   // Сабмишны

/** Позиция в ситуации */
export type SituationPosition =
  | "standing"
  | "closed_guard_top"
  | "closed_guard_bottom"
  | "open_guard_top"
  | "open_guard_bottom"
  | "half_guard_top"
  | "half_guard_bottom"
  | "side_control_top"
  | "side_control_bottom"
  | "mount_top"
  | "mount_bottom"
  | "back_control"
  | "back_defense"
  | "turtle_top"
  | "turtle_bottom";

/** Ситуация в спарринге */
export interface Situation {
  id: string;
  title: string;
  description: string;
  category: SituationCategory;
  position: SituationPosition;
  techniqueIds: number[]; // рекомендуемые техники
  minBelt?: Belt; // минимальный пояс для показа
  tags?: string[];
}

/** Сценарий для спарринга */
export interface Scenario {
  id: string;
  title: string;
  description: string;
  startPosition: SituationPosition;
  goal: string;
  duration: number; // в секундах
  situationIds: string[];
}

// ============================================================================
// ГРАФ — типы для раскладки и рендеринга
// ============================================================================

/** Ориентация графа */
export type Orientation = "horizontal" | "vertical";

/** Полоса в графе (пояс или группа) */
export interface GraphBand {
  type: "belt" | "group";
  key: string;
  y0: number;
  y1: number;
}

/** Lane — колонка/ряд в графе */
export interface GraphLane {
  type: "belt" | "group";
  key: string;
  x0: number;
  x1: number;
}

/** Результат раскладки графа */
export interface GraphLayout {
  positions: Map<number, { x: number; y: number }>;
  bands: GraphBand[];
  lanes: GraphLane[];
  xMin: number;
  xMax: number;
}

// ============================================================================
// РЕКОМЕНДАЦИИ
// ============================================================================

/** Результат расчёта готовности пререквизитов */
export interface ReadinessResult {
  /** Доля выполненных пререквизитов (0..1) */
  frac: number;
  /** Количество выполненных пререквизитов */
  done: number;
  /** Общее количество пререквизитов */
  total: number;
  /** ID невыполненных пререквизитов */
  missing: number[];
}

// ============================================================================
// УТИЛИТАРНЫЕ ТИПЫ
// ============================================================================

/** Partial-тип для обновления профиля в онбординге */
export type ProfileUpdate = Partial<StyleProfile>;

/** Фильтры для библиотеки техник */
export interface LibraryFilters {
  query?: string;
  belt?: Belt | "all";
  group?: TechniqueGroup | "all";
  status?: ProgressStatus | "all";
  gi?: boolean | null;
  noGi?: boolean | null;
  legalOnly?: boolean;
}

/** Параметры сортировки библиотеки */
export type SortField = "name" | "belt" | "group" | "difficulty";
export type SortOrder = "asc" | "desc";

export interface LibrarySort {
  field: SortField;
  order: SortOrder;
}

// ============================================================================
// ОБЛАЧНАЯ СИНХРОНИЗАЦИЯ (Supabase)
// ============================================================================

/** Данные для резервного копирования / синхронизации */
export interface BackupData {
  version: number;
  exportedAt: string;
  progress: ProgressMap;
  profile: StyleProfile;
  activity: ActivityHistory;
  practice: PracticeHistory;
  workouts?: Workout[];
}

/** Статус облачной синхронизации */
export type SyncStatus = "idle" | "syncing" | "success" | "error" | "offline";
