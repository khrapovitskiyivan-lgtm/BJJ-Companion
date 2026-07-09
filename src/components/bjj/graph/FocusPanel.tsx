import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { TECH_BY_ID, contentFor } from "@/lib/bjj/data";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import { learningPath } from "@/lib/bjj/recommend";
import type { ProgressMap } from "@/lib/bjj/store";
import type { Technique } from "@/lib/bjj/types";
import type { FocusDir } from "./graphUtils";

interface FocusPanelProps {
  tech: Technique;
  progress: ProgressMap;
  dir: FocusDir;
  onDir: (d: FocusDir) => void;
  onClose: () => void;
  onJump: (id: number) => void;
}

export function FocusPanel({ tech, progress, dir, onDir, onClose, onJump }: FocusPanelProps) {
  const status = progress[tech.id] ?? "not_started";
  const content = contentFor(tech, "ru");
  const path = dir === "path" ? learningPath(tech, progress) : null;
  const chains = tech.chain_to.map((i) => TECH_BY_ID[i]).filter(Boolean).slice(0, 6);

  return (
    <div className="border-t border-border bg-muted/40 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {GROUP_LABEL[tech.group]} · {BELT_LABEL[tech.belt]} ·{" "}
            {status === "done" ? "Изучено" : status === "in_progress" ? "В процессе" : "Не начато"}
          </p>
          <h3 className="mt-0.5 truncate text-base font-semibold">{tech.nameRu}</h3>
          {content && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{content.concept}</p>}
        </div>
        <button
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
          aria-label="Снять фокус"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(
          [
            ["both", "Соседи"],
            ["up", "← Что раньше"],
            ["down", "Дальше →"],
            ["path", "Путь изучения"],
          ] as [FocusDir, string][]
        ).map(([d, label]) => (
          <button
            key={d}
            onClick={() => onDir(d)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              dir === d
                ? "border-ring bg-primary/15 text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {path && path.length > 1 ? (
        <div className="mt-2">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Путь изучения — {path.length} шагов
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {path.map((t, i) => (
              <span key={t.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <button
                  onClick={() => onJump(t.id)}
                  className={`rounded-md border border-border px-2 py-0.5 text-[11px] transition hover:bg-muted ${
                    t.id === tech.id ? "font-semibold" : ""
                  }`}
                >
                  {t.label}
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        chains.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {chains.map((t) => (
              <button
                key={t.id}
                onClick={() => onJump(t.id)}
                className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted"
              >
                → {t.label}
              </button>
            ))}
          </div>
        )
      )}

      <Link
        to="/technique/$id"
        params={{ id: String(tech.id) }}
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
      >
        Открыть технику
      </Link>
    </div>
  );
}
