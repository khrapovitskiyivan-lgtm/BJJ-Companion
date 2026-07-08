import { useState } from "react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TECH_BY_ID, TECHNIQUES, contentFor } from "@/lib/bjj/data";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import { useProgress } from "@/lib/bjj/store";
import { learningPath } from "@/lib/bjj/recommend";
import type { ProgressStatus, Technique } from "@/lib/bjj/types";
import {
  ArrowLeft, Check, Circle, CircleDot, Link2, Share2,
  ListOrdered, KeyRound, Clock3, AlertTriangle, Dumbbell, ShieldAlert, Route as RouteIcon,
} from "lucide-react";

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
  done: "Изучено",
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
  const router = useRouter();
  const [shared, setShared] = useState(false);
  const status = progress[tech.id] ?? "not_started";
  const Icon = STATUS_ICON[status];
  const content = contentFor(tech, "ru");
  const path = learningPath(tech, progress);
  const riskCritical = /КРИТИЧНО/i.test(content?.injuryRisk ?? "");

  const resolve = (ids: number[]) =>
    ids.map((i) => TECH_BY_ID[i]).filter((x): x is Technique => Boolean(x));

  const usedBy = TECHNIQUES.filter(
    (t) =>
      t.id !== tech.id &&
      (t.prerequisites.includes(tech.id) ||
        t.common_setups.includes(tech.id) ||
        t.setup_from.includes(tech.id)),
  ).slice(0, 20);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `${tech.nameRu} (${tech.nameEn}) — BJJ Companion`;
    try {
      if (navigator.share) {
        await navigator.share({ title: text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      /* пользователь отменил шеринг */
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Назад
        </button>
        <button
          onClick={share}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Share2 className="h-3.5 w-3.5" />
          {shared ? "Ссылка скопирована!" : "Поделиться"}
        </button>
      </div>

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
          {tech.successRate && tech.successRate !== "N/A" && <Chip>Успех ~{tech.successRate}</Chip>}
          {tech.energyCost && <Chip>Энергия: {tech.energyCost}</Chip>}
          {tech.legal_ibjjf_gi && <Chip>IBJJF Gi</Chip>}
          {tech.legal_ibjjf_nogi && <Chip>IBJJF No-Gi</Chip>}
          {tech.legal_adcc && <Chip>ADCC</Chip>}
        </div>
        {content && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{content.concept}</p>
        )}
      </header>

      {/* Предупреждение о риске — всегда на виду, это фишка продукта */}
      {content && (content.injuryRisk !== "Низкий" || content.tapWarning !== "Нет") && (
        <div
          className={`flex gap-3 rounded-2xl border p-3 ${
            riskCritical
              ? "border-destructive/50 bg-destructive/10"
              : "border-amber-500/40 bg-amber-500/10"
          }`}
        >
          <ShieldAlert
            className={`mt-0.5 h-5 w-5 shrink-0 ${riskCritical ? "text-destructive" : "text-amber-600"}`}
          />
          <div className="text-xs leading-relaxed">
            <p>
              <b>Риск травмы:</b> {content.injuryRisk}
            </p>
            {content.tapWarning !== "Нет" && (
              <p className="mt-0.5">
                <b>Когда стучать:</b> {content.tapWarning}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Контент из базы */}
      {content && (
        <>
          <ContentSection icon={<ListOrdered className="h-4 w-4" />} title="Механика" html={content.mechanics} numbered />
          <ContentSection icon={<KeyRound className="h-4 w-4" />} title="Ключевые моменты" html={content.keyPoints} />
          <ContentSection icon={<Clock3 className="h-4 w-4" />} title="Когда применять" html={content.when} />
          <ContentSection icon={<AlertTriangle className="h-4 w-4" />} title="Типичные ошибки" html={content.mistakes} />
          <ContentSection icon={<Dumbbell className="h-4 w-4" />} title="Дриллы" html={content.drills} />
        </>
      )}

      {/* Путь изучения */}
      {path.length > 1 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <RouteIcon className="h-4 w-4 text-primary" />
            Путь изучения — {path.length} шагов
          </h2>
          <div className="flex flex-wrap items-center gap-1">
            {path.map((t, i) => (
              <span key={t.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-xs text-muted-foreground">→</span>}
                <Link
                  to="/technique/$id"
                  params={{ id: String(t.id) }}
                  className={`rounded-md border border-border px-2 py-0.5 text-[11px] transition hover:bg-muted ${
                    t.id === tech.id ? "bg-primary/10 font-semibold" : ""
                  }`}
                >
                  {t.label}
                </Link>
              </span>
            ))}
          </div>
        </section>
      )}

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

// Секция контента: разбивает "1) ...<br>2) ..." / "• ...<br>• ..." на список
function ContentSection({
  icon,
  title,
  html,
  numbered,
}: {
  icon: React.ReactNode;
  title: string;
  html: string;
  numbered?: boolean;
}) {
  if (!html || !html.trim()) return null;
  const items = html
    .split(/<br\s*\/?>/i)
    .map((s) => s.replace(/^\s*(\d+\)|•)\s*/, "").trim())
    .filter(Boolean);
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      {items.length > 1 ? (
        numbered ? (
          <ol className="list-inside list-decimal space-y-1.5 text-sm leading-relaxed text-foreground/90">
            {items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ol>
        ) : (
          <ul className="space-y-1.5 text-sm leading-relaxed text-foreground/90">
            {items.map((it, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {it}
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="text-sm leading-relaxed text-foreground/90">{items[0]}</p>
      )}
    </section>
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
