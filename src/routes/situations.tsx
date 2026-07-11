import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniquesTabs } from "@/components/bjj/TechniquesTabs";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import type { Technique } from "@/lib/bjj/types";
import { ChevronLeft, Search } from "lucide-react";

export const Route = createFileRoute("/situations")({
  component: SituationsPage,
});

// Позиции-ситуации «Что делать, если…» (перенесено из «Решений»).
const SITUATIONS: { id: number; label: string; group: string }[] = [
  { id: 1, label: "Я в закрытом гарде снизу", group: "Гард снизу" },
  { id: 3, label: "Я в халф-гарде снизу", group: "Гард снизу" },
  { id: 5, label: "Я в баттерфляе снизу", group: "Гард снизу" },
  { id: 7, label: "Я в паук-гарде снизу", group: "Гард снизу" },
  { id: 8, label: "Я в де-ла-Рива снизу", group: "Гард снизу" },
  { id: 10, label: "Я в X-гарде снизу", group: "Гард снизу" },
  { id: 11, label: "Я в 50/50 гарде", group: "Гард снизу" },
  { id: 300, label: "Я в Single Leg X", group: "Гард снизу" },
  { id: 2, label: "Я в закрытом гарде сверху", group: "Гард сверху / проход" },
  { id: 4, label: "Я в халф-гарде сверху", group: "Гард сверху / проход" },
  { id: 6, label: "Я в баттерфляе сверху", group: "Гард сверху / проход" },
  { id: 13, label: "Я в сайд-контроле снизу", group: "Доминирующие позиции" },
  { id: 14, label: "Я в сайд-контроле сверху", group: "Доминирующие позиции" },
  { id: 15, label: "Я в маунте снизу", group: "Доминирующие позиции" },
  { id: 16, label: "Я в маунте сверху", group: "Доминирующие позиции" },
  { id: 24, label: "Колено на животе сверху", group: "Доминирующие позиции" },
  { id: 25, label: "Колено на животе снизу", group: "Доминирующие позиции" },
  { id: 22, label: "Я в север-юг сверху", group: "Доминирующие позиции" },
  { id: 23, label: "Я в север-юг снизу", group: "Доминирующие позиции" },
  { id: 17, label: "Я контролирую спину", group: "Спина и черепаха" },
  { id: 18, label: "Соперник взял мою спину", group: "Спина и черепаха" },
  { id: 19, label: "Соперник в черепахе", group: "Спина и черепаха" },
  { id: 20, label: "Я в черепахе снизу", group: "Спина и черепаха" },
  { id: 610, label: "Я во фронт-хедлоке", group: "Спина и черепаха" },
  { id: 21, label: "Мы в стойке", group: "Стойка" },
];

function SituationsPage() {
  return (
    <AppShell>
      <div className="space-y-3">
        <header className="flex items-end justify-between px-1">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Разбор ситуаций</p>
            <h1 className="text-xl font-bold tracking-tight">Что если…</h1>
          </div>
          <TechniquesTabs />
        </header>
        <Decide />
      </div>
    </AppShell>
  );
}

function Decide() {
  const [situationId, setSituationId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const situation = situationId != null ? TECH_BY_ID[situationId] : null;

  const options = useMemo(() => {
    if (situationId == null) return null;
    const out: Record<string, Technique[]> = { attacks: [], sweeps: [], transitions: [], escapes: [] };
    const src = TECH_BY_ID[situationId];
    if (!src) return out;
    const targets = new Set<number>(src.chain_to);
    for (const t of TECHNIQUES) if (t.setup_from.includes(situationId)) targets.add(t.id);
    for (const id of targets) {
      const t = TECH_BY_ID[id];
      if (!t || t.id === situationId) continue;
      if (t.group === "submission" || t.group === "guard_pass" || t.group === "takedown") out.attacks.push(t);
      else if (t.group === "sweep") out.sweeps.push(t);
      else if (t.group === "escape" || t.group === "retention") out.escapes.push(t);
      else out.transitions.push(t);
    }
    return out;
  }, [situationId]);

  if (situation && options) {
    const empty =
      !options.attacks.length && !options.sweeps.length && !options.transitions.length && !options.escapes.length;
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSituationId(null)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          К ситуациям
        </button>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ваша ситуация</p>
          <h2 className="mt-0.5 text-base font-semibold">
            {SITUATIONS.find((s) => s.id === situationId)?.label ?? situation.nameRu}
          </h2>
        </div>
        {empty ? (
          <p className="px-1 text-xs text-muted-foreground">Для этой позиции пока нет размеченных вариантов.</p>
        ) : (
          <>
            <OptionSection title="Атаки" items={options.attacks} />
            <OptionSection title="Свипы" items={options.sweeps} />
            <OptionSection title="Переходы" items={options.transitions} />
            <OptionSection title="Выходы и защита" items={options.escapes} />
          </>
        )}
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const groups = [...new Set(SITUATIONS.map((s) => s.group))];

  return (
    <div className="space-y-4">
      <p className="px-1 text-xs text-muted-foreground">
        Выберите позицию — покажем, что из неё делать: атаки, свипы, переходы и выходы.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти позицию…"
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {groups.map((g) => {
        const items = SITUATIONS.filter((s) => s.group === g && (!q || s.label.toLowerCase().includes(q)));
        if (!items.length) return null;
        return (
          <section key={g}>
            <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{g}</h3>
            <div className="grid grid-cols-2 gap-2">
              {items.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSituationId(s.id)}
                  className="rounded-xl border border-border bg-card p-3 text-left text-xs font-medium transition hover:bg-muted"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function OptionSection({ title, items }: { title: string; items: Technique[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">
        {title} <span className="text-muted-foreground">({items.length})</span>
      </h3>
      <ul className="space-y-1.5">
        {items.map((t) => (
          <li key={t.id}>
            <Link
              to="/technique/$id"
              params={{ id: String(t.id) }}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5 transition hover:bg-muted"
              style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{t.nameRu}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {GROUP_LABEL[t.group]} · {BELT_LABEL[t.belt]} · сложность {t.difficulty}/5
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
