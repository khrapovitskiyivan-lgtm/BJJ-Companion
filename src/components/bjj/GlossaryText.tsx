import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { defaultTargets, findMatches } from "@/lib/bjj/glossaryMatch";
import type { GlossaryTerm } from "@/lib/bjj/glossary";
import { track } from "@/lib/bjj/telemetry";

// Подсветка терминов словаря в тексте: концепт -> поповер с определением,
// название техники -> ссылка на карточку. Матчинг словоформ в glossaryMatch.ts.
// Один поповер на страницу держит GlossaryProvider (позиционирование без position:fixed).

const POP_W = 264;
const TERM_CLASS =
  "cursor-pointer bg-transparent p-0 text-primary underline decoration-dotted decoration-primary/50 underline-offset-2 [text-decoration-thickness:1px]";

interface Ctx {
  open: (term: GlossaryTerm, el: HTMLElement) => void;
}
const GlossaryCtx = createContext<Ctx | null>(null);

export function GlossaryProvider({ children, className = "" }: { children: ReactNode; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState<{ term: GlossaryTerm; left: number; top: number } | null>(null);

  const open = useCallback((term: GlossaryTerm, el: HTMLElement) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const left = Math.max(0, Math.min(er.left - wr.left, wrap.clientWidth - POP_W));
    const top = er.bottom - wr.top + 6;
    setPop({ term, left, top });
    track("glossary_open", term.term);
  }, []);

  useEffect(() => {
    if (!pop) return;
    const close = () => setPop(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPop(null);
    };
    // отложенная подписка: текущий клик по термину не должен сразу закрыть поповер
    const id = window.setTimeout(() => {
      document.addEventListener("click", close);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [pop]);

  return (
    <GlossaryCtx.Provider value={{ open }}>
      <div ref={wrapRef} className={`relative ${className}`}>
        {children}
        {pop && (
          <div
            className="absolute z-20 rounded-xl border border-border bg-card p-3 text-left shadow-lg"
            style={{ left: pop.left, top: pop.top, width: POP_W }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">{pop.term.term}</p>
            {pop.term.en && <p className="text-[11px] text-muted-foreground">{pop.term.en}</p>}
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{pop.term.definition}</p>
          </div>
        )}
      </div>
    </GlossaryCtx.Provider>
  );
}

// Оборачивает простой текст: термины -> кнопки/ссылки, остальное как есть.
// Дедуп на первое вхождение внутри одной строки (findMatches). Общий seen между
// строками НЕ используем: мутация во время рендера ломается на двойном рендере
// StrictMode. Повтор термина между пунктами списка приемлем.
export function GlossaryText({
  text,
  excludeTechId,
}: {
  text: string;
  excludeTechId?: number;
}) {
  const ctx = useContext(GlossaryCtx);
  if (!ctx) return <>{text}</>;
  const matches = findMatches(text, defaultTargets(), { excludeTechId });
  if (!matches.length) return <>{text}</>;

  const parts: ReactNode[] = [];
  let cur = 0;
  matches.forEach((m, i) => {
    if (m.start > cur) parts.push(text.slice(cur, m.start));
    if (m.kind === "technique" && m.techId != null) {
      parts.push(
        <Link key={i} to="/technique/$id" params={{ id: String(m.techId) }} className={TERM_CLASS}>
          {m.text}
        </Link>,
      );
    } else if (m.term) {
      const term = m.term;
      parts.push(
        <button
          key={i}
          type="button"
          className={TERM_CLASS}
          onClick={(e) => {
            e.stopPropagation();
            ctx.open(term, e.currentTarget);
          }}
        >
          {m.text}
        </button>,
      );
    }
    cur = m.end;
  });
  if (cur < text.length) parts.push(text.slice(cur));
  return <>{parts}</>;
}
