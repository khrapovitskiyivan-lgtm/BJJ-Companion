import { Search } from "lucide-react";
import { GROUP_LABEL } from "@/lib/bjj/constants";
import type { Technique } from "@/lib/bjj/types";
import type { Palette } from "./graphUtils";

interface GraphSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: Technique[];
  onSelect: (t: Technique) => void;
  theme: Palette;
  stats: { done: number; total: number; pct: number };
}

export function GraphSearchBar({
  query, onQueryChange, results, onSelect, theme, stats,
}: GraphSearchBarProps) {
  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">Карта техник</h2>
          <p className="text-[11px] text-muted-foreground">
            {stats.done}/{stats.total} изучено · {stats.pct}%
          </p>
        </div>
        <div className="relative w-44 sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Поиск техники…"
            className="w-full rounded-full border border-border bg-background py-1.5 pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          {results.length > 0 && (
            <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
              {results.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: theme.belts[t.belt] }} />
                  <span className="min-w-0 flex-1 truncate">{t.nameRu}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{GROUP_LABEL[t.group]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
