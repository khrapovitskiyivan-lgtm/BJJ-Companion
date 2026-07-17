import { useState, useMemo } from "react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TECH_BY_ID, TECHNIQUES, contentFor } from "@/lib/bjj/data";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import { useProgress } from "@/lib/bjj/store";
import { haptic } from "@/lib/telegram";
import type { ProgressStatus, Technique } from "@/lib/bjj/types";
import {
  ArrowLeft,
  Check,
  Circle,
  CircleDot,
  Share2,
  ShieldAlert,
  Sparkles,
  History,
  Link2,
} from "lucide-react";

// Новые компоненты
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { Breadcrumbs } from "@/components/bjj/technique/Breadcrumbs";
import { VideoBlock } from "@/components/bjj/technique/VideoBlock";
import {
  MechanismSection,
  InsightSection,
  NeutralSection,
  WarningSection,
  PracticeSection,
} from "@/components/bjj/technique/TechniqueSections";
import { RelatedList } from "@/components/bjj/technique/RelatedList";
import { StyleBadges } from "@/components/bjj/StyleBadges";

import { Clock3, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/bjj/ui";

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
  const injury = content?.injuryRisk ?? "";
  // Уровень риска по вхождению (в данных бывает уточнение в скобках: «Средний (колено)»)
  const riskHigh = /КРИТИЧНО|Высок/i.test(injury);
  const riskCritical = /КРИТИЧНО/i.test(injury);
  const riskMed = !riskHigh && /Средн/i.test(injury);

  const videoUrl = (tech as any).videoUrl as string | undefined;

  const practiceHistory = useMemo(() => {
    const history: { date: string }[] = [];
    try {
      const raw = localStorage.getItem("bjj_practice_history");
      if (raw) {
        const all: Record<number, string[]> = JSON.parse(raw);
        (all[tech.id] || []).forEach((date) => history.push({ date }));
      }
    } catch {
      /* ignore */
    }
    return history.slice(-5).reverse();
  }, [tech.id]);

  const similar = useMemo(() => {
    return TECHNIQUES.filter(
      (t) => t.id !== tech.id && t.group === tech.group && t.belt === tech.belt,
    ).slice(0, 6);
  }, [tech]);

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
      /* ignore */
    }
  };

  return (
    <div className="space-y-5">
      <Breadcrumbs tech={tech} />

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

      {/* Шапка */}
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
            onClick={() => { haptic("medium"); cycleStatus(tech.id); }}
            aria-label={`Статус: ${STATUS_LABEL[status]}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-transform active:scale-95"
            style={{ borderColor: STATUS_COLOR[status], color: STATUS_COLOR[status] }}
          >
            <Icon className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <Badge>{GROUP_LABEL[tech.group]}</Badge>
          <Badge>{BELT_LABEL[tech.belt]}</Badge>
          {tech.gi && <Badge>Gi</Badge>}
          {tech.noGi && <Badge>No-Gi</Badge>}
          <Badge>Сложность {tech.difficulty}/5</Badge>
          {tech.successRate && tech.successRate !== "N/A" && <Badge>Успех ~{tech.successRate}</Badge>}
          {tech.energyCost && <Badge>Энергия: {tech.energyCost}</Badge>}
          {tech.legal_ibjjf_gi && <Badge>IBJJF Gi</Badge>}
          {tech.legal_ibjjf_nogi && <Badge>IBJJF No-Gi</Badge>}
          {tech.legal_adcc && <Badge>ADCC</Badge>}
        </div>
        {tech.styles?.length > 0 && (
          <div className="mt-3">
            <StyleBadges styles={tech.styles} />
          </div>
        )}
        {content && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{content.concept}</p>
        )}
      </header>

      {/* Под описанием: видео (платная) или фото (бесплатная — ассет добавится позже) */}
      {videoUrl && <VideoBlock url={videoUrl} title={tech.nameRu} />}

      {/* «Когда применять» — сразу под описанием */}
      {content?.when && (
        <NeutralSection icon={<Clock3 className="h-4 w-4" />} title="Когда применять" html={content.when} />
      )}

      {content && (content.injuryRisk || content.tapWarning !== "Нет") && (
  <div
    className={`flex gap-3 rounded-2xl border p-4 ${
      riskHigh
        ? "border-destructive/50 bg-destructive/10 text-destructive"
        : riskMed
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "border-border bg-muted text-muted-foreground"
    }`}
  >
    {riskHigh ? (
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
    ) : (
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
    )}
    <div className="text-xs leading-relaxed flex-1">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-semibold text-sm">
          {riskCritical
            ? "Опасная техника"
            : riskHigh
            ? "Высокий риск травмы"
            : riskMed
            ? "Будьте осторожны"
            : "Информация о технике"}
        </span>
      </div>
      {content.injuryRisk && (
        <p className="mb-1">
          <b>Риск травмы:</b> {content.injuryRisk}
        </p>
      )}
      {content.tapWarning !== "Нет" && (
        <p>
          <b>Когда стучать:</b> {content.tapWarning}
        </p>
      )}
    </div>
  </div>
)}

      {practiceHistory.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-primary" />
            История практики
          </h2>
          <div className="flex flex-wrap gap-2">
            {practiceHistory.map((h, i) => (
              <span
                key={i}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {new Date(h.date).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            ))}
          </div>
        </section>
      )}

      {content && (
        <>
          <MechanismSection html={content.mechanics} />
          <InsightSection html={content.keyPoints} />
          <WarningSection html={content.mistakes} />
          <PracticeSection html={content.drills} />
        </>
      )}

      {similar.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Похожие техники
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {similar.map((t) => (
              <TechniqueRow
                key={t.id}
                technique={t}
                inset
                right={<Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              />
            ))}
          </div>
        </section>
      )}

      <RelatedList title="Что изучить сначала" items={resolve(tech.prerequisites)} empty="Нет требований — можно изучать сразу." defaultOpen />
      <RelatedList title="Заходы из" items={resolve(tech.setup_from)} />
      <RelatedList title="Типичные сетапы" items={resolve(tech.common_setups)} />
      <RelatedList title="Продолжения" items={resolve(tech.chain_to)} />
      <RelatedList title="Используется в" items={usedBy} />
    </div>
  );
}

