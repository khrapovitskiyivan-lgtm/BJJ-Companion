import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueCard } from "@/components/bjj/TechniqueCard";
import { Progress } from "@/components/ui/progress";
import { TECHNIQUES } from "@/lib/bjj/data";
import { BELT_LABEL, BELT_ORDER, GROUP_LABEL } from "@/lib/bjj/constants";
import { useProgress } from "@/lib/bjj/store";
import type { Belt, Group, ProgressStatus } from "@/lib/bjj/types";
import { Check, CircleDot, Circle, Trophy } from "lucide-react";

export const Route = createFileRoute("/progress")({
  component: ProgressPage,
});

type Filter = "all" | ProgressStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "in_progress", label: "В процессе" },
  { value: "done", label: "Изучено" },
  { value: "not_started", label: "Не начато" },
];

function ProgressPage() {
  return (
    <AppShell>
      <ProgressView />
    </AppShell>
  );
}

function ProgressView() {
  const { progress, cycleStatus, hydrated } = useProgress();
  const [filter, setFilter] = useState<Filter>("in_progress");

  const stats = useMemo(() => {
    const total = TECHNIQUES.length;
    let done = 0;
    let inProgress = 0;
    for (const t of TECHNIQUES) {
      const s = progress[t.id];
      if (s === "done") done++;
      else if (s === "in_progress") inProgress++;
    }
    return { total, done, inProgress, notStarted: total - done - inProgress };
  }, [progress]);

  const beltStats = useMemo(
    () =>
      BELT_ORDER.map((belt) => {
        const items = TECHNIQUES.filter((t) => t.belt === belt);
        const done = items.filter((t) => progress[t.id] === "done").length;
        return { belt, total: items.length, done };
      }),
    [progress],
  );

  const groupStats = useMemo(() => {
    const map = new Map<Group, { total: number; done: number }>();
    for (const t of TECHNIQUES) {
      const cur = map.get(t.group) ?? { total: 0, done: 0 };
      cur.total++;
      if (progress[t.id] === "done") cur.done++;
      map.set(t.group, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].done - a[1].done);
  }, [progress]);

  const filtered = useMemo(() => {
    if (filter === "all") return TECHNIQUES;
    return TECHNIQUES.filter((t) => (progress[t.id] ?? "not_started") === filter);
  }, [progress, filter]);

  const donePercent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  if (!hydrated) return <div className="py-10 text-center text-sm text-muted-foreground">Загрузка…</div>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Прогресс</h1>
        <p className="text-xs text-muted-foreground">Отмечайте изученное — данные хранятся локально</p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Всего изучено</p>
            <p className="mt-0.5 text-2xl font-bold">
              {stats.done}
              <span className="text-sm font-normal text-muted-foreground"> / {stats.total}</span>
            </p>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "color-mix(in oklch, var(--status-done) 15%, var(--color-card))", color: "var(--status-done)" }}>
            <Trophy className="h-5 w-5" />
          </div>
        </div>
        <Progress value={donePercent} className="mt-3" />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          <MiniStat icon={<Check className="h-3.5 w-3.5" />} label="Готово" value={stats.done} color="var(--status-done)" />
          <MiniStat icon={<CircleDot className="h-3.5 w-3.5" />} label="В процессе" value={stats.inProgress} color="var(--status-progress)" />
          <MiniStat icon={<Circle className="h-3.5 w-3.5" />} label="Не начато" value={stats.notStarted} color="var(--status-idle)" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">По поясам</h2>
        <ul className="space-y-2">
          {beltStats.map((b) => (
            <BeltRow key={b.belt} belt={b.belt} done={b.done} total={b.total} />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">По категориям</h2>
        <ul className="grid grid-cols-2 gap-2">
          {groupStats.map(([group, s]) => {
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <li key={group} className="rounded-xl border border-border bg-card p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{GROUP_LABEL[group]}</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {s.done}<span className="text-xs font-normal text-muted-foreground"> / {s.total}</span>
                </p>
                <Progress value={pct} className="mt-2 h-1.5" />
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Техники</h2>
          <span className="text-xs text-muted-foreground">{filtered.length}</span>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              style={{
                borderColor: filter === f.value ? "var(--color-primary)" : "var(--color-border)",
                background: filter === f.value ? "color-mix(in oklch, var(--color-primary) 12%, var(--color-card))" : "var(--color-card)",
                color: filter === f.value ? "var(--color-primary)" : "var(--color-foreground)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Пусто. Отметьте техники в библиотеке или после тренировки.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.slice(0, 60).map((t) => (
              <li key={t.id}>
                <TechniqueCard
                  technique={t}
                  status={progress[t.id] ?? "not_started"}
                  onCycleStatus={cycleStatus}
                />
              </li>
            ))}
            {filtered.length > 60 && (
              <li className="pt-1 text-center text-xs text-muted-foreground">
                Показано 60 из {filtered.length}
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-muted px-2 py-2">
      <div className="flex items-center justify-center gap-1" style={{ color }}>
        {icon}
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function BeltRow({ belt, done, total }: { belt: Belt; done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <li className="rounded-xl border border-border bg-card p-3" style={{ borderLeft: `4px solid var(--belt-${belt})` }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{BELT_LABEL[belt]} пояс</span>
        <span className="text-xs text-muted-foreground">
          {done} / {total} · {pct}%
        </span>
      </div>
      <Progress value={pct} className="mt-2 h-1.5" />
    </li>
  );
}
