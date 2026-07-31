import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TECH_BY_ID, TECHNIQUES, contentFor } from "@/lib/bjj/data";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import { useProgress, useProfile, useReviewed, useFavorites, useDiary } from "@/lib/bjj/store";
import { track } from "@/lib/bjj/telemetry";
import { effectiveStyleSet } from "@/lib/bjj/workoutCluster";
import { knownCount, nextStep, cardReason } from "@/lib/bjj/coachCard";
import { haptic } from "@/lib/telegram";
import { legalStatus, legalLabel, type LegalValue } from "@/lib/bjj/legal";
import type { Belt, ProgressStatus, Technique } from "@/lib/bjj/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  CircleDot,
  Share2,
  ShieldAlert,
  Sparkles,
  History,
  Crown,
} from "lucide-react";

// Новые компоненты
import { Breadcrumbs } from "@/components/bjj/technique/Breadcrumbs";
import { VideoBlock } from "@/components/bjj/technique/VideoBlock";
import { VideoInterestPrompt } from "@/components/bjj/technique/VideoInterestPrompt";
import {
  MechanismSection,
  InsightSection,
  NeutralSection,
  WarningSection,
  PracticeSection,
} from "@/components/bjj/technique/TechniqueSections";
import { RelatedList } from "@/components/bjj/technique/RelatedList";
import { NotesSection } from "@/components/bjj/technique/NotesSection";
import { GlossaryProvider, GlossaryText } from "@/components/bjj/GlossaryText";
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

// Бейдж легальности: нейтральный если легально для пояса, янтарный «с <пояса>» если
// ограничено по поясу, и скрыт если не применимо/запрещено (как раньше при ✗).
function LegalBadge({ value, base, belt }: { value: LegalValue; base: string; belt: Belt }) {
  const st = legalStatus(value, belt);
  if (st.kind === "never") return null;
  return <Badge tone={st.kind === "from" ? "warn" : "default"}>{legalLabel(base, st)}</Badge>;
}

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
  const { progress, cycleStatus, hydrated: progressHydrated } = useProgress();
  const { profile, hydrated: profileHydrated } = useProfile();
  const { entries, practiceCount, hydrated: diaryHydrated } = useDiary();
  const personalReady = progressHydrated && profileHydrated && diaryHydrated;
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

  const videoUrl = tech.videoUrl;

  // Открыл карточку = разобрал показанное (уводит технику из блока «Разбери показанное»)
  const { markReviewed, hydrated: reviewedHydrated } = useReviewed();
  useEffect(() => {
    if (reviewedHydrated) markReviewed(tech.id);
  }, [reviewedHydrated, tech.id, markReviewed]);

  // Избранное: корона в шапке карточки
  const { favorites, toggleFavorite } = useFavorites();
  const isFav = !!favorites[tech.id];

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

  // Персональные сигналы карточки-тренера (за гейтом гидратации)
  const byId = useMemo(() => new Map(TECHNIQUES.map((t) => [t.id, t])), []);
  const styleSet = useMemo(
    () => effectiveStyleSet(profile, progress, practiceCount()),
    [profile, progress, practiceCount],
  );
  const reason = useMemo(
    () =>
      personalReady
        ? cardReason({ tech, entries, styleSet, goal: profile.goal, gi: profile.gi, noGi: profile.noGi, byId })
        : null,
    [personalReady, tech, entries, styleSet, profile, byId],
  );
  const step = useMemo(
    () =>
      personalReady
        ? nextStep({ tech, byId, progress, styleSet, goal: profile.goal, gi: profile.gi, noGi: profile.noGi })
        : null,
    [personalReady, tech, byId, progress, styleSet, profile],
  );
  const prereqKnown = knownCount(tech.prerequisites, progress);
  const setupKnown = knownCount(tech.setup_from, progress);

  // Телеметрия показа тренера (раз в сутки на вид причины)
  useEffect(() => {
    if (personalReady && (reason || step)) track("coach_shown", reason?.kind ?? "next", { dailyDedup: true });
  }, [personalReady, reason, step]);

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
    <GlossaryProvider className="space-y-5">
      <Breadcrumbs tech={tech} />

      <div className="flex items-center justify-between">
        {/* «Назад» заметнее share: заливка primary + крупнее (поступали жалобы на невидимость) */}
        <button
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/15"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              haptic();
              toggleFavorite(tech.id);
              track("favorite_toggle", String(tech.id));
            }}
            aria-label={isFav ? "Убрать из избранного" : "В избранное"}
            className="inline-flex items-center justify-center rounded-full border border-border p-2 transition hover:bg-muted"
            style={isFav ? { color: "var(--brand-gold-ink)" } : { color: "var(--color-muted-foreground)" }}
          >
            <Crown className="h-4 w-4" fill={isFav ? "var(--brand-gold-ink)" : "none"} />
          </button>
          <button
            onClick={share}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Share2 className="h-3.5 w-3.5" />
            {shared ? "Ссылка скопирована!" : "Поделиться"}
          </button>
        </div>
      </div>

      {/* Шапка */}
      <header
        className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        style={{ borderLeft: `4px solid var(--belt-${tech.belt})` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">{tech.nameRu}</h1>
            <p className="text-xs text-muted-foreground">{tech.nameEn}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic("medium");
              cycleStatus(tech.id);
            }}
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
          {tech.successRate && tech.successRate !== "N/A" && (
            <Badge>Успех ~{tech.successRate}</Badge>
          )}
          {tech.energyCost && <Badge>Энергия: {tech.energyCost}</Badge>}
          <LegalBadge value={tech.legal_ibjjf_gi} base="IBJJF Gi" belt={profile.belt} />
          <LegalBadge value={tech.legal_ibjjf_nogi} base="IBJJF No-Gi" belt={profile.belt} />
          <LegalBadge value={tech.legal_adcc} base="ADCC" belt={profile.belt} />
        </div>
        {tech.styles?.length > 0 && (
          <div className="mt-3">
            <StyleBadges styles={tech.styles} />
          </div>
        )}
        {content && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <GlossaryText text={content.concept} excludeTechId={tech.id} />
          </p>
        )}
        {personalReady && reason && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            {reason.text}
          </p>
        )}
      </header>

      {personalReady && step && (
        <Link
          to="/technique/$id"
          params={{ id: String(step.id) }}
          onClick={() => track("reco_click", "next_step")}
          className="flex items-center justify-between gap-2 rounded-xl border border-ring/50 bg-primary/5 px-4 py-2.5 text-sm"
        >
          <span className="text-muted-foreground">
            Дальше: <span className="font-medium text-foreground">{step.nameRu}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
        </Link>
      )}

      {/* Под описанием: курированное видео (если есть) или тихий крючок «нужен видео-разбор» */}
      {videoUrl ? (
        <VideoBlock url={videoUrl} title={tech.nameRu} />
      ) : (
        <VideoInterestPrompt techniqueId={tech.id} />
      )}

      {/* Личные заметки — сразу после описания/видео: свои детали ценнее справочных */}
      <NotesSection techniqueId={tech.id} />

      {/* «Когда применять» — сразу под описанием */}
      {content?.when && (
        <NeutralSection
          icon={<Clock3 className="h-4 w-4" />}
          title="Когда применять"
          html={content.when}
        />
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
          <MechanismSection html={content.mechanics} techId={tech.id} />
          <InsightSection html={content.keyPoints} techId={tech.id} />
          <WarningSection html={content.mistakes} />
          <PracticeSection html={content.drills} />
        </>
      )}

      <RelatedList
        title="Что изучить сначала"
        items={resolve(tech.prerequisites)}
        empty="Нет требований — можно изучать сразу."
        defaultOpen
        badge={personalReady && prereqKnown.total > 0 ? `${prereqKnown.done}/${prereqKnown.total}` : undefined}
      />
      <RelatedList
        title="Заходы из"
        items={resolve(tech.setup_from)}
        badge={personalReady && setupKnown.total > 0 ? `${setupKnown.done}/${setupKnown.total}` : undefined}
      />
      <RelatedList title="Типичные сетапы" items={resolve(tech.common_setups)} />
      <RelatedList title="Продолжения" items={resolve(tech.chain_to)} highlightId={step?.id} />
      <RelatedList title="Используется в" items={usedBy} />
    </GlossaryProvider>
  );
}
