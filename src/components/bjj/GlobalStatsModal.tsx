import { useEffect, useState } from "react";
import { fetchGlobalStats, type GlobalStats } from "@/lib/bjj/globalStats";
import { BELT_LABEL, BELT_ORDER } from "@/lib/bjj/constants";
import type { Belt } from "@/lib/bjj/types";
import { Sheet } from "@/components/bjj/ui";
import { Users } from "lucide-react";

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

  const max = stats ? Math.max(1, ...BELT_ORDER.map((b: Belt) => stats.belts[b] ?? 0)) : 1;

  return (
    <Sheet kicker="Сообщество" title="Кто в игре" onClose={onClose}>
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
    </Sheet>
  );
}
