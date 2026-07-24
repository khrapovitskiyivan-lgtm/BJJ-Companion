// === МАТЧЕР ТЕРМИНОВ СЛОВАРЯ В ТЕКСТЕ ===
// Находит в прозе термины словаря (концепты -> поповер) и названия техник
// (-> ссылка на карточку) с учётом русских склонений. Морфология эвристикой:
// основа = слово без финальной гласной/й/ь (если длиннее 4 букв) + до 3 доп. букв;
// нерегулярности (беглые гласные: угол/угла) через glossary.stems. Longest-first,
// первое вхождение на термин. Спек docs/superpowers/specs/2026-07-24-glossary-inline-tap-design.md.
import { GLOSSARY, type GlossaryTerm } from "./glossary";
import { TECHNIQUES } from "./data";

export type MatchKind = "glossary" | "technique";

export interface GlossaryMatch {
  start: number;
  end: number;
  text: string;
  kind: MatchKind;
  term?: GlossaryTerm;
  techId?: number;
}

export interface Target {
  key: string;
  kind: MatchKind;
  length: number; // длина фразы, для longest-first
  regex: RegExp;
  probe: string; // дешёвая предпроверка (гарантированно присутствующий префикс основы)
  term?: GlossaryTerm;
  techId?: number;
}

// Финальные гласные/й/ь, которые срезаются при авто-основе
const DROP = new Set("аеёиойуыэюяйь".split(""));
const BOUND_BEFORE = "(?<![а-яёa-z0-9])";
const BOUND_AFTER = "(?![а-яёa-z0-9])";
const SUFFIX = "[а-яё]{0,3}";

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function autoStem(word: string): string {
  let w = word.toLowerCase();
  // сбрасываем до 2 финальных гласных/й/ь (прилагательные -ый/-ого требуют двух),
  // не укорачивая основу короче 4 букв
  let dropped = 0;
  while (dropped < 2 && w.length > 4 && DROP.has(w[w.length - 1])) {
    w = w.slice(0, -1);
    dropped++;
  }
  return w;
}

function commonPrefix(arr: string[]): string {
  if (!arr.length) return "";
  let p = arr[0].toLowerCase();
  for (let k = 1; k < arr.length; k++) {
    const l = arr[k].toLowerCase();
    let i = 0;
    while (i < p.length && i < l.length && p[i] === l[i]) i++;
    p = p.slice(0, i);
  }
  return p;
}

function build(phrase: string, stems?: string[]): { pattern: string; probe: string } {
  if (stems && stems.length) {
    const alts = stems.map((s) => esc(s.toLowerCase())).join("|");
    return { pattern: `(?:${alts})${SUFFIX}`, probe: commonPrefix(stems).slice(0, 3) };
  }
  const tokens = phrase.trim().split(/\s+/);
  const pattern = tokens.map((t) => esc(autoStem(t)) + SUFFIX).join("\\s+");
  return { pattern, probe: autoStem(tokens[0]).slice(0, 3) };
}

function makeTarget(base: Pick<Target, "key" | "kind" | "term" | "techId">, phrase: string, stems?: string[]): Target {
  const { pattern, probe } = build(phrase, stems);
  return {
    ...base,
    length: phrase.length,
    probe,
    regex: new RegExp(BOUND_BEFORE + "(" + pattern + ")" + BOUND_AFTER, "gi"),
  };
}

export function buildTargets(
  glossary: GlossaryTerm[],
  techniques: { id: number; nameRu: string }[],
): Target[] {
  const targets: Target[] = [];
  for (const term of glossary) {
    // «Ги, кимоно» -> два варианта, оба на один термин (ключ общий -> дедуп first-occurrence)
    const variants = term.term.split(",").map((s) => s.trim()).filter(Boolean);
    for (const v of variants) {
      // stems заданы для термина целиком; применяем только когда вариант один
      targets.push(makeTarget({ key: term.term, kind: "glossary", term }, v, variants.length === 1 ? term.stems : undefined));
    }
  }
  for (const t of techniques) {
    if (!t.nameRu || t.nameRu.length < 4) continue;
    targets.push(makeTarget({ key: `tech:${t.id}`, kind: "technique", techId: t.id }, t.nameRu));
  }
  // длинная фраза раньше короткой: «Закрытый гард» перебивает «Гард»
  targets.sort((a, b) => b.length - a.length);
  return targets;
}

function overlaps(claimed: [number, number][], s: number, e: number): boolean {
  return claimed.some(([cs, ce]) => s < ce && e > cs);
}

export function findMatches(
  text: string,
  targets: Target[],
  opts: { excludeTechId?: number; seen?: Set<string> } = {},
): GlossaryMatch[] {
  const lower = text.toLowerCase();
  const claimed: [number, number][] = [];
  const out: GlossaryMatch[] = [];
  for (const t of targets) {
    if (opts.seen?.has(t.key)) continue;
    if (t.kind === "technique" && t.techId === opts.excludeTechId) continue;
    if (t.probe && !lower.includes(t.probe)) continue;
    t.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = t.regex.exec(text))) {
      const s = m.index;
      const e = s + m[0].length;
      if (!overlaps(claimed, s, e)) {
        claimed.push([s, e]);
        out.push({ start: s, end: e, text: m[0], kind: t.kind, term: t.term, techId: t.techId });
        opts.seen?.add(t.key);
        break; // первое непересекающееся вхождение на термин
      }
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

// Готовые цели на реальных данных (мемо), для компонента GlossaryText
let cached: Target[] | null = null;
export function defaultTargets(): Target[] {
  if (!cached) {
    cached = buildTargets(
      GLOSSARY,
      TECHNIQUES.map((t) => ({ id: t.id, nameRu: t.nameRu })),
    );
  }
  return cached;
}
