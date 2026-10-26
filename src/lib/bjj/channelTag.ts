// Хэштеги и распознавание техник в постах Telegram-канала тренера.
// Чистые функции: имя тега техники и разбор подписи -> id техник.
// Правила имён тегов совпадают с инструментом разметки (channel-tools/hashtags.py),
// иначе уже расставленные в канале теги перестанут распознаваться.
import type { Technique } from "./types";

// ручные правки неудачных тегов (грамматика, длина, общие слова)
const OVERRIDE: Record<string, string> = {
  спайдера: "спайдер",
  проход_гард: "проход_гарда",
  проход_халф: "проход_халфа",
  гард: "закрытый_гард",
  халф: "халф_гард",
  сайд: "сайд_контроль",
  колено: "колено_на_животе",
  обр_длр: "обратный_длр",
  dlr_свип: "длр_свип",
  переход_на_спину_из_халф_гарда: "спина_из_халфа",
  переход_на_спину_из_черепахи: "спина_из_черепахи",
  дип_халф_гард_в_x_гард: "дип_халф_в_икс_гард",
  халф_гард_в_дип_халф_гард: "халф_в_дип_халф",
  уход_бедрами_из_сайд_контроля: "креветка_из_сайда",
  дип_халф_гард_свип: "свип_из_дип_халфа",
};

// Свои теги владельца канала (синонимы): распознаются как тег той же техники
export const OWNER_ALIAS: Record<string, string> = {
  "#батерфляй": "#баттерфляй",
  "#ахилл": "#прямой_на_стопу",
  "#ахиллес": "#прямой_на_стопу",
  "#кимура_трэп": "#кимура_контроль",
  "#подъем_из_гарда": "#подъем_в_гарде",
  "#обратный_рычаг_локтя": "#уде_гатаме",
  // старые теги до переименования (knee = «ни», не «найф»)
  "#найф_слайс": "#нислайс",
  "#свип_через_найф_слайс": "#свип_через_нислайс",
};

// Тег техники: короткое имя, «Играешь/Держишь X» -> X, «Проходишь X» -> проход_X
export function techniqueTag(t: Pick<Technique, "label">): string {
  const short = t.label.split(" - ").pop()!.trim();
  let s = short.toLowerCase().replace(/ё/g, "е");
  s = s.replace(/^(играешь|держишь)\s+/, "");
  s = s.replace(/^проходишь\s+(.*)$/, "проход_$1");
  s = s.replace(/[^a-zа-я0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return "#" + (OVERRIDE[s] ?? s);
}

const norm = (s: string) =>
  s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
// грубый стемминг под русские окончания: «омоплату» = «омоплата»
const stem = (w: string) => (w.length <= 4 ? w : w.slice(0, Math.max(4, w.length - 2)));

// Одиночные общие слова не засчитываем без хэштега: слишком часто встречаются
// в подписях не как название приёма («выход за спину», «из гарда»).
const GENERIC = new Set(["спина", "гард", "сайд", "маунт", "халф", "стойка", "колено", "черепаха", "проход", "свип"].map(stem));

export interface ChannelIndex {
  byTag: Map<string, number>;
  phrases: { stems: string[]; id: number }[];
}

export function buildChannelIndex(techniques: Technique[]): ChannelIndex {
  const byTag = new Map<string, number>();
  // при совпадении тегов побеждает меньший id (базовая карточка, не «система»)
  for (const t of [...techniques].sort((a, b) => a.id - b.id)) {
    const tag = techniqueTag(t);
    if (!byTag.has(tag)) byTag.set(tag, t.id);
  }
  // теги, которые владелец канала ставит сам, -> наш тег той же техники
  for (const [own, canon] of Object.entries(OWNER_ALIAS)) {
    const id = byTag.get(canon);
    if (id !== undefined && !byTag.has(own)) byTag.set(own, id);
  }
  const phrases: ChannelIndex["phrases"] = [];
  for (const t of techniques) {
    const names = new Set([t.nameRu, t.nameEn, t.label.split(" - ")[0], ...(t.aliases ?? [])]);
    for (const n of names) {
      const toks = norm(n ?? "");
      if (!toks.length || toks.join(" ").length < 4) continue;
      const stems = toks.map(stem);
      if (stems.length === 1 && GENERIC.has(stems[0])) continue;
      phrases.push({ stems, id: t.id });
    }
  }
  // длинные фразы первыми: «треугольник из гарда» важнее «треугольник»
  phrases.sort((a, b) => b.stems.length - a.stems.length);
  return { byTag, phrases };
}

export interface ChannelMatch {
  ids: number[];
  fromTags: number[];
  fromText: number[];
}

// Разбор подписи: сначала явные хэштеги, потом названия и алиасы в тексте
export function matchCaption(text: string, idx: ChannelIndex): ChannelMatch {
  const fromTags: number[] = [];
  for (const m of text.toLowerCase().replace(/ё/g, "е").matchAll(/#[a-zа-я0-9_]+/g)) {
    const id = idx.byTag.get(m[0]);
    if (id !== undefined && !fromTags.includes(id)) fromTags.push(id);
  }
  const body = text.replace(/#[\p{L}\p{N}_]+/gu, " ");
  const toks = norm(body).map(stem);
  const used = new Array(toks.length).fill(false);
  const fromText: number[] = [];
  for (const { stems, id } of idx.phrases) {
    const L = stems.length;
    for (let i = 0; i + L <= toks.length; i++) {
      if (used.slice(i, i + L).some(Boolean)) continue;
      if (stems.every((s, k) => toks[i + k] === s)) {
        for (let k = i; k < i + L; k++) used[k] = true;
        if (!fromTags.includes(id) && !fromText.includes(id)) fromText.push(id);
      }
    }
  }
  return { ids: [...fromTags, ...fromText], fromTags, fromText };
}

// Строка под видео со ссылками на карточки техник в приложении (до 3), без техник — на бота
const BOT_URL = "https://t.me/companionminiapp_bot";
export const APP_LINE_PREFIX = "Смотреть в приложении: ";
const OLD_LINE_PREFIX = "Все техники и дневник тренировок:";

export interface AppLine {
  line: string;
  links: { offset: number; length: number; url: string }[]; // смещения внутри line (UTF-16)
}

export function buildAppLine(ids: number[], techById: Record<number, Technique>): AppLine {
  const techs = [...new Set(ids)].map((id) => techById[id]).filter(Boolean).slice(0, 3);
  const items = techs.length
    ? techs.map((t) => ({ name: t.title.split(" (")[0], url: `${BOT_URL}?startapp=t${t.id}` }))
    : [{ name: "BJJ Companion", url: BOT_URL }];
  let line = APP_LINE_PREFIX;
  const links: AppLine["links"] = [];
  items.forEach((it, i) => {
    if (i) line += " · ";
    links.push({ offset: line.length, length: it.name.length, url: it.url });
    line += it.name;
  });
  return { line, links };
}

// Снять нашу строку-ссылку (новую или старую) с конца подписи
export function stripAppLine(text: string): string {
  const parts = text.trimEnd().split("\n");
  const last = parts[parts.length - 1] ?? "";
  if (!last.startsWith(APP_LINE_PREFIX) && !last.startsWith(OLD_LINE_PREFIX)) return text;
  return parts.slice(0, -1).join("\n").trimEnd();
}

// Каких тегов не хватает в подписи (для авто-дописывания ботом)
export function missingTags(text: string, ids: number[], techById: Record<number, Technique>): string[] {
  const have = text.toLowerCase().replace(/ё/g, "е");
  const tags = [...new Set(ids.map((id) => techById[id]).filter(Boolean).map((t) => techniqueTag(t)))];
  const present = (tg: string) => new RegExp(`${tg}(?![a-zа-я0-9_])`).test(have);
  // синоним владельца уже стоит: не дописываем наш тег, иначе задвоение
  const viaAlias = (tg: string) => Object.entries(OWNER_ALIAS).some(([own, c]) => c === tg && present(own));
  return tags.filter((tg) => !present(tg) && !viaAlias(tg));
}
