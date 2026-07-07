import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TECH_BY_ID, TECHNIQUES } from "@/lib/bjj/data";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import { useProgress } from "@/lib/bjj/store";
import type { ProgressStatus, Technique } from "@/lib/bjj/types";
import { ArrowLeft, Check, Circle, CircleDot, Link2 } from "lucide-react";

export const Route = createFileRoute("/technique/$id")({
  component: TechniquePage,
  notFoundComponent: () => (
    <AppShell>
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">Техника не найдена</p>
        <Link to="/library" className="mt-3 inline-block text-sm text-primary underline">
          К библиотеке
        </Link>
      </div>
    </AppShell>
  ),
});

const STATUS_ICON = { not_started: Circle, in_progress: CircleDot, done: Check } as const;
const STATUS_COLOR: Record<ProgressStatus, string> = {
  not_started: "var(--status-idle)",
  in_progress: "var(--status-progress)",
  done: "var(--status-done)",
};
const STATUS_LABEL: Record<ProgressStatus, string> = {
  not_started: "Не начато",
  in_progress: "В процессе",
  done: "Готово",
};

function TechniquePage() {
  const { id } = Route.useParams();
  const tech = TECH_BY_ID[Number(id)];
  if (!tech) throw notFound();
  return (
    <AppShell>
      <TechniqueDetail tech={tech} />
    </AppShell>
  );
}

function TechniqueDetail({ tech }: { tech: Technique }) {
  const { progress, cycleStatus } = useProgress();
  const status = progress[tech.id] ?? "not_started";
  const Icon = STATUS_ICON[status];

  const resolve = (ids: number[]) =>
    ids.map((i) => TECH_BY_ID[i]).filter((x): x is Technique => Boolean(x));

  const usedBy = TECHNIQUES.filter(
    (t) =>
      t.id !== tech.id &&
      (t.prerequisites.includes(tech.id) ||
        t.common_setups.includes(tech.id) ||
        t.setup_from.includes(tech.id)),
  ).slice(0, 20);

  return (
    <div className="space-y-5">
      <Link
        to="/library"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        К библиотеке
      </Link>

      <header
        className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        style={{ borderLeft: `4px solid var(--belt-${tech.belt})` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">{tech.nameRu}</h1>
            <p className="text-xs text-muted-foreground">{tech.nameEn}</p>
          </div>
          <button
            type="button"
            onClick={() => cycleStatus(tech.id)}
            aria-label={`Статус: ${STATUS_LABEL[status]}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2"
            style={{ borderColor: STATUS_COLOR[status], color: STATUS_COLOR[status] }}
          >
            <Icon className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <Chip>{GROUP_LABEL[tech.group]}</Chip>
          <Chip>{BELT_LABEL[tech.belt]}</Chip>
          {tech.gi && <Chip>Gi</Chip>}
          {tech.noGi && <Chip>No-Gi</Chip>}
          <Chip>Сложность {tech.difficulty}/5</Chip>
          {tech.legal_ibjjf_gi && <Chip>IBJJF Gi</Chip>}
          {tech.legal_ibjjf_nogi && <Chip>IBJJF No-Gi</Chip>}
          {tech.legal_adcc && <Chip>ADCC</Chip>}
          {tech.points_ibjjf > 0 && <Chip>{tech.points_ibjjf} очков IBJJF</Chip>}
        </div>
      </header>

      {tech.tags.length > 0 && (
        <Section title="Теги">
          <div className="flex flex-wrap gap-1.5">
            {tech.tags.map((t) => (
              <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        </Section>
      )}

      <RelatedList title="Пререквизиты" items={resolve(tech.prerequisites)} empty="Нет требований — можно изучать сразу." />
      <RelatedList title="Заходы из" items={resolve(tech.setup_from)} />
      <RelatedList title="Типичные сетапы" items={resolve(tech.common_setups)} />
      <RelatedList title="Продолжения (chain)" items={resolve(tech.chain_to)} />
      <RelatedList title="Используется в" items={usedBy} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function RelatedList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Technique[];
  empty?: string;
}) {
  if (items.length === 0 && !empty) return null;
  return (
    <Section title={title}>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                to="/technique/$id"
                params={{ id: String(t.id) }}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5 transition-colors hover:bg-muted"
                style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.nameRu}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {GROUP_LABEL[t.group]} · {BELT_LABEL[t.belt]}
                  </span>
                </span>
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{children}</span>;
}
