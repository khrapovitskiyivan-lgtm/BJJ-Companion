import { useState, useMemo } from "react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TECH_BY_ID, TECHNIQUES, contentFor } from "@/lib/bjj/data";
import { BELT_LABEL, BELT_ORDER, GROUP_LABEL } from "@/lib/bjj/constants";
import { useProgress } from "@/lib/bjj/store";
import { learningPath } from "@/lib/bjj/recommend";
import type { ProgressStatus, Technique } from "@/lib/bjj/types";
import {
  ArrowLeft,
  Check,
  Circle,
  CircleDot,
  Link2,
  Share2,
  ListOrdered,
  KeyRound,
  Clock3,
  AlertTriangle,
  Dumbbell,
  ShieldAlert,
  Route as RouteIcon,
  Play,
  Lightbulb,
  Timer,
  Sparkles,
  Home,
  BookOpen,
  ChevronRight,
  Trophy,
  History,
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

  // Видео (если есть в данных)
  const videoUrl = (tech as any).videoUrl as string | undefined;

  // История практики — когда статус менялся на "done"
  // В реальном приложении это должно быть в store, здесь — заглушка
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

  // Похожие техники — из той же группы и пояса
  const similar = useMemo(() => {
    return TECHNIQUES.filter(
      (t) =>
        t.id !== tech.id &&
        t.group === tech.group &&
        t.belt === tech.belt,
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
      /* пользователь отменил шеринг */
    }
  };

  return (
    <div className="space-y-5">
      {/* Хлебные крошки */}
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

      {/* Шапка техники */}
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
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-transform active:scale-95"
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

      {/* Видео */}
      {videoUrl && <VideoBlock url={videoUrl} title={tech.nameRu} />}

      {/* Предупреждение о риске */}
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

      {/* История практики */}
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

      {/* Интерактивный путь изучения */}
      {path.length > 1 && (
        <InteractiveLearningPath path={path} currentId={tech.id} />
      )}

      {/* Контент из базы — разные стили для разных секций */}
      {content && (
        <>
          <MechanismSection html={content.mechanics} />
          <InsightSection icon={<KeyRound className="h-4 w-4" />} title="Ключевые моменты" html={content.keyPoints} />
          <NeutralSection icon={<Clock3 className="h-4 w-4" />} title="Когда применять" html={content.when} />
          <WarningSection icon={<AlertTriangle className="h-4 w-4" />} title="Типичные ошибки" html={content.mistakes} />
          <PracticeSection icon={<Dumbbell className="h-4 w-4" />} title="Дриллы" html={content.drills} />
        </>
      )}

      {/* Похожие техники */}
      {similar.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Похожие техники
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {similar.map((t) => (
              <Link
                key={t.id}
                to="/technique/$id"
                params={{ id: String(t.id) }}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:bg-muted"
                style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.nameRu}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {GROUP_LABEL[t.group]} · сложность {t.difficulty}/5
                  </div>
                </div>
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Теги */}
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

      {/* Связанные техники */}
      <RelatedList title="Пререквизиты" items={resolve(tech.prerequisites)} empty="Нет требований — можно изучать сразу." />
      <RelatedList title="Заходы из" items={resolve(tech.setup_from)} />
      <RelatedList title="Типичные сетапы" items={resolve(tech.common_setups)} />
      <RelatedList title="Продолжения (chain)" items={resolve(tech.chain_to)} />
      <RelatedList title="Используется в" items={usedBy} />
    </div>
  );
}

// === Хлебные крошки ===
function Breadcrumbs({ tech }: { tech: Technique }) {
  return (
    <nav aria-label="Навигация" className="flex items-center gap-1 text-xs text-muted-foreground">
      <Link to="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
        <Home className="h-3 w-3" />
        Главная
      </Link>
      <ChevronRight className="h-3 w-3" />
      <Link to="/library" className="flex items-center gap-1 hover:text-foreground transition-colors">
        <BookOpen className="h-3 w-3" />
        Библиотека
      </Link>
      <ChevronRight className="h-3 w-3" />
      <span className="text-foreground font-medium truncate max-w-[120px] sm:max-w-none">
        {tech.nameRu}
      </span>
    </nav>
  );
}

// === Видео-блок ===
function VideoBlock({ url, title }: { url: string; title: string }) {
  // Поддержка YouTube embed
  const embedUrl = url.includes("youtube.com")
    ? url.replace("watch?v=", "embed/")
    : url.includes("youtu.be")
    ? url.replace("youtu.be/", "youtube.com/embed/")
    : url;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={embedUrl}
          title={`Видео: ${title}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border">
        <Play className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Видео-разбор техники</span>
      </div>
    </section>
  );
}

// === Интерактивный путь изучения ===
function InteractiveLearningPath({
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

      {/* Прогресс-бар */}
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Шаги */}
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
              {/* Номер шага */}
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

              {/* Контент */}
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

              {/* Статус */}
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

// === Механика — главный акцентный блок ===
function MechanismSection({ html }: { html: string }) {
  if (!html || !html.trim()) return null;
  const items = parseHtmlList(html);

  return (
    <section className="rounded-2xl border-l-4 border-l-primary border-y border-r border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ListOrdered className="h-4 w-4 text-primary" />
        Механика
      </h2>
      {items.length > 1 ? (
        <ol className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </div>
              <p className="flex-1 pt-0.5 text-sm leading-relaxed">{it}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm leading-relaxed">{items[0]}</p>
      )}
    </section>
  );
}

// === Инсайт — светлый акцент ===
function InsightSection({
  icon,
  title,
  html,
}: {
  icon: React.ReactNode;
  title: string;
  html: string;
}) {
  if (!html || !html.trim()) return null;
  const items = parseHtmlList(html);

  return (
    <section className="rounded-2xl border-l-4 border-l-primary/50 border-y border-r border-border bg-primary/5 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      {items.length > 1 ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <Lightbulb className="mt-1 h-3 w-3 shrink-0 text-primary" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed">{items[0]}</p>
      )}
    </section>
  );
}

// === Нейтральная секция ===
function NeutralSection({
  icon,
  title,
  html,
}: {
  icon: React.ReactNode;
  title: string;
  html: string;
}) {
  if (!html || !html.trim()) return null;
  const items = parseHtmlList(html);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-foreground">{icon}</span>
        {title}
      </h2>
      {items.length > 1 ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed">{items[0]}</p>
      )}
    </section>
  );
}

// === Предупреждение — красный акцент ===
function WarningSection({
  icon,
  title,
  html,
}: {
  icon: React.ReactNode;
  title: string;
  html: string;
}) {
  if (!html || !html.trim()) return null;
  const items = parseHtmlList(html);

  return (
    <section className="rounded-2xl border-l-4 border-l-destructive border-y border-r border-destructive/20 bg-destructive/5 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-destructive">{icon}</span>
        {title}
      </h2>
      {items.length > 1 ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed">{items[0]}</p>
      )}
    </section>
  );
}

// === Практика — зелёный акцент ===
function PracticeSection({
  icon,
  title,
  html,
}: {
  icon: React.ReactNode;
  title: string;
  html: string;
}) {
  if (!html || !html.trim()) return null;
  const items = parseHtmlList(html);

  return (
    <section className="rounded-2xl border-l-4 border-l-success border-y border-r border-success/20 bg-success/5 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-success">{icon}</span>
        {title}
      </h2>
      {items.length > 1 ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <Timer className="mt-0.5 h-3 w-3 shrink-0 text-success" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed">{items[0]}</p>
      )}
    </section>
  );
}

// === Вспомогательные компоненты ===

function parseHtmlList(html: string): string[] {
  return html
    .split(/<br\s*\/?>/i)
    .map((s) => s.replace(/^\s*(\d+\)|•)\s*/, "").trim())
    .filter(Boolean);
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
