import { useEffect, useState } from "react";
import { fetchGlobalStats, type GlobalStats } from "@/lib/bjj/globalStats";
import { BELT_LABEL, BELT_ORDER } from "@/lib/bjj/constants";
import type { Belt } from "@/lib/bjj/types";
import { X, Users } from "lucide-react";

// Окно глобальной статистики: открывается тапом по логотипу в шапке.
// Сколько человек в игре и распределение по цвету пояса.

function peopleWord(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d100 >= 11 && d100 <= 14) return "человек";
  if (d10 >= 2 && d10 <= 4) return "человека";
  return "человек";
}

export function GlobalStatsModal({ onClose }: { onClose: () => void }) {
  // undefined = загрузка, null = не получилось
  const [stats, setStats] = useState<GlobalStats | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetchGlobalStats().then((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Esc закрывает
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const max = stats ? Math.max(1, ...BELT_ORDER.map((b: Belt) => stats.belts[b] ?? 0)) : 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Закрыть" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-4 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Сообщество</p>
            <p className="text-base font-bold tracking-tight">Кто в игре</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {stats === undefined && <p className="py-6 text-center text-sm text-muted-foreground">Загружаем…</p>}
          {stats === null && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Не удалось загрузить статистику. Попробуйте позже.
            </p>
          )}
          {stats && (
            <>
              <p className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                В игре{" "}
                <span className="text-base font-bold tabular-nums">{stats.players}</span> {peopleWord(stats.players)}
              </p>
              <div className="space-y-1.5">
                {BELT_ORDER.map((b: Belt) => {
                  const cnt = stats.belts[b] ?? 0;
                  return (
                    <div key={b} className="flex items-center gap-2.5">
                      <span className="block h-3.5 w-7 shrink-0 rounded ring-1 ring-black/10" style={{ background: `var(--belt-${b})` }} />
                      <span className="w-24 shrink-0 text-xs">{BELT_LABEL[b]}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.round((cnt / max) * 100)}%`, background: "var(--color-primary)" }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{cnt}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
