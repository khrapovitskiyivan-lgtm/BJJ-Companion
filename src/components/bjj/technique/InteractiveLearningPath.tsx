import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Route as RouteIcon, Check } from "lucide-react";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import type { Technique } from "@/lib/bjj/types";

export function InteractiveLearningPath({
  path,
  currentId,
}: {
  path: Technique[];
  currentId: number;
}) {
  const [completed, setCompleted] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(`bjj_path_${currentId}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggle = (id: number) => {
    const next = new Set(completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCompleted(next);
    localStorage.setItem(`bjj_path_${currentId}`, JSON.stringify([...next]));
  };

  const progressPct = (completed.size / path.length) * 100;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <RouteIcon className="h-4 w-4 text-primary" />
          Путь изучения
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {completed.size} из {path.length}
        </span>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {path.map((t, i) => {
          const isDone = completed.has(t.id);
          const isCurrent = t.id === currentId;

          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                isCurrent
                  ? "border-primary bg-primary/5"
                  : isDone
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                  isDone
                    ? "bg-success text-white"
                    : isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-sm font-medium ${
                    isDone ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {t.nameRu}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {GROUP_LABEL[t.group]} · {BELT_LABEL[t.belt]}
                </div>
              </div>

              {isCurrent && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Сейчас
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
