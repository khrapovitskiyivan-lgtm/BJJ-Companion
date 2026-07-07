// === CONSTANTS === (перенесено 1-в-1 из bjj-map/index.html)
import type { Belt, Group, WarmupItem } from "./types";

export const BELT_ORDER: Belt[] = ["white", "blue", "purple", "brown", "black"];

export const BELT_LABEL: Record<Belt, string> = {
  white: "Белый",
  blue: "Синий",
  purple: "Фиолетовый",
  brown: "Коричневый",
  black: "Чёрный",
};

export const BELT_LABEL_EN: Record<Belt, string> = {
  white: "White",
  blue: "Blue",
  purple: "Purple",
  brown: "Brown",
  black: "Black",
};

export const GROUP_LABEL: Record<Group, string> = {
  position: "Позиция",
  submission: "Сабмишн",
  sweep: "Свип",
  guard_pass: "Проход гарда",
  takedown: "Тейкдаун",
  transition: "Переход",
  system: "Система",
  escape: "Побег",
  retention: "Ретеншн",
};

export const GROUP_LABEL_EN: Record<Group, string> = {
  position: "Position",
  submission: "Submission",
  sweep: "Sweep",
  guard_pass: "Guard Pass",
  takedown: "Takedown",
  transition: "Transition",
  system: "System",
  escape: "Escape",
  retention: "Guard Retention",
};

// Максимальная сложность по поясу — из оригинала
export const MAX_DIFFICULTY_BY_BELT: Record<Belt, number> = {
  white: 2,
  blue: 3,
  purple: 4,
  brown: 5,
  black: 5,
};

// === РАЗМИНКА ПО ПОЯСУ (оригинал) ===
export const WARMUP_BY_BELT: Record<Belt, WarmupItem[]> = {
  white: [
    { name: "Суставная гимнастика", desc: "Вращения шеи, плеч, локтей, кистей, таза, коленей, голеностопов", duration: 3 },
    { name: "Креветка", desc: "20 повторений в каждую сторону", duration: 2 },
    { name: "Мост", desc: "20 повторений с захватом пальцев", duration: 2 },
    { name: "Технический подъём", desc: "10 повторений в каждую сторону", duration: 2 },
  ],
  blue: [
    { name: "Суставная гимнастика", desc: "Вращения всех суставов + растяжка шеи и плеч", duration: 3 },
    { name: "Креветка + вставка колена", desc: "20 повторений с последующим закрытием гарда", duration: 2 },
    { name: "Мост с переворотом", desc: "15 повторений", duration: 2 },
    { name: "Технический подъём + спрол", desc: "10 технических подъёмов + 5 спролов", duration: 2 },
    { name: "Проходы гарда стоя", desc: "Проход тореадор + проход коленом — 5 повторений", duration: 2 },
  ],
  purple: [
    { name: "Суставная гимнастика + мобильность", desc: "Вращения + работа с резинкой", duration: 3 },
    { name: "Креветка + инверсия", desc: "15 креветок + 5 инверсий", duration: 2 },
    { name: "Перекат Гранби", desc: "10 перекатов в каждую сторону", duration: 2 },
    { name: "Беримболо", desc: "10 повторений движения ногами", duration: 2 },
    { name: "Технический подъём + спрол + стойка", desc: "Комплекс", duration: 2 },
  ],
  brown: [
    { name: "Динамическая разминка", desc: "Суставы + мобильность + работа с партнёром", duration: 3 },
    { name: "Креветка + инверсия + Перекат Гранби", desc: "Комплекс", duration: 3 },
    { name: "Беримболо + роллинг взятие спины", desc: "10 повторений", duration: 2 },
    { name: "Тейкдауны", desc: "Арм-драг → взятие спины", duration: 2 },
    { name: "Стойка + перемещения", desc: "Перемещения, спролы, уровни", duration: 2 },
  ],
  black: [
    { name: "Профессиональная разминка", desc: "Суставы + мобильность + теневой грэпплинг", duration: 3 },
    { name: "Комплекс креветка + инверсия", desc: "Серия проходов — 3 минуты", duration: 3 },
    { name: "Тейкдауны + серия проходов", desc: "5 повторов", duration: 2 },
    { name: "Входы в захваты ног", desc: "10 повторов", duration: 2 },
    { name: "Стойка + борцовские перемещения", desc: "2 минуты", duration: 2 },
  ],
};

export const COOLDOWN_BY_BELT: Record<Belt, WarmupItem[]> = {
  white: [
    { name: "Растяжка шеи и плеч", desc: "Медленные наклоны — 30 сек на сторону", duration: 2 },
    { name: "Растяжка бёдер и паха", desc: "Бабочка, голубь — 30 сек", duration: 2 },
    { name: "Растяжка спины", desc: "Поза ребёнка, кошка-корова — 1 мин", duration: 1 },
    { name: "Дыхательные упражнения", desc: "4-7-8 — 5 циклов", duration: 2 },
  ],
  blue: [
    { name: "Растяжка шеи, плеч, спины", desc: "Комплекс", duration: 2 },
    { name: "Растяжка бёдер", desc: "Выпад, голубь, бабочка", duration: 3 },
    { name: "Растяжка подколенных сухожилий", desc: "Наклоны", duration: 2 },
    { name: "Растяжка голеностопов", desc: "Вращения", duration: 1 },
    { name: "Дыхание и восстановление", desc: "4-7-8 — 2 мин", duration: 2 },
  ],
  purple: [
    { name: "Глубокая растяжка плечевого пояса", desc: "3 мин", duration: 3 },
    { name: "Растяжка бёдер и паха", desc: "3 мин", duration: 3 },
    { name: "Растяжка спины", desc: "2 мин", duration: 2 },
    { name: "Растяжка голеностопов", desc: "2 мин", duration: 2 },
    { name: "Медитация", desc: "2 мин", duration: 2 },
  ],
  brown: [
    { name: "Глубокая растяжка всего тела", desc: "5 мин", duration: 5 },
    { name: "ПНФ-растяжка бёдер", desc: "3 мин", duration: 3 },
    { name: "Работа с массажным роликом", desc: "3 мин", duration: 3 },
    { name: "Восстановление дыхания", desc: "3 мин", duration: 3 },
  ],
  black: [
    { name: "Профессиональное восстановление", desc: "5 мин", duration: 5 },
    { name: "ПНФ + растяжка с партнёром", desc: "4 мин", duration: 4 },
    { name: "Массажный ролик + мобильность", desc: "3 мин", duration: 3 },
    { name: "Ментальное восстановление", desc: "3 мин", duration: 3 },
  ],
};
