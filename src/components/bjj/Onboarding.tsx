import { useMemo, useState } from "react";
import {
  BookOpen,
  Dumbbell,
  HelpCircle,
  NotebookPen,
  ChevronRight,
  ChevronLeft,
  Shield,
  Trophy,
  Smile,
  Check,
  Sparkles,
  Search,
} from "lucide-react";
import type { Belt, StyleProfile, Goal, Frequency, Technique } from "@/lib/bjj/types";
import { BELT_LABEL, BELT_LABEL_EN, BELT_ORDER, GROUP_LABEL } from "@/lib/bjj/constants";
import { TECHNIQUES } from "@/lib/bjj/data";
import { BrandLogo } from "./Logo";
import { Button, IconButton } from "@/components/bjj/ui";

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// === ONBOARDING: 7 шагов ===
// knownIds — техники, которые пользователь уже знает: помечаются «изучено», чтобы
// стартовый экран не был пустым и рекомендации сразу отталкивались от них.
export function Onboarding({
  onDone,
}: {
  onDone: (p: Partial<StyleProfile>, knownIds: number[]) => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [belt, setBelt] = useState<Belt>("white");
  // без предвыбора: пользователь выбирает формат сам (шаг не пройти, пока не выбран хотя бы один)
  const [gi, setGi] = useState(false);
  const [noGi, setNoGi] = useState(false);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [known, setKnown] = useState<number[]>([]);

  const totalSteps = 7;
  const progress = ((step + 1) / totalSteps) * 100;

  const canProceed = () => {
    if (step === 2) return gi || noGi;
    if (step === 3) return goal !== null;
    if (step === 4) return frequency !== null;
    return true;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Прогресс-бар сверху */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-between px-6 py-10">
        {/* Индикатор шага */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Шаг {step + 1} из {totalSteps}</span>
          {step > 0 && step < 6 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Назад
            </button>
          )}
        </div>

        {/* Контент шагов */}
        <div className="flex-1 flex flex-col justify-center py-8">
          {step === 0 && <WelcomeScreen />}

          {step === 1 && (
            <BeltStep belt={belt} setBelt={setBelt} />
          )}

          {step === 2 && (
            <StyleStep gi={gi} setGi={setGi} noGi={noGi} setNoGi={setNoGi} />
          )}

          {step === 3 && (
            <GoalStep goal={goal} setGoal={setGoal} />
          )}

          {step === 4 && (
            <FrequencyStep frequency={frequency} setFrequency={setFrequency} />
          )}

          {step === 5 && (
            <KnownStep belt={belt} known={known} setKnown={setKnown} />
          )}

          {step === 6 && (
            <FinalScreen belt={belt} gi={gi} noGi={noGi} goal={goal} knownCount={known.length} />
          )}
        </div>

        {/* Навигация */}
        <div className="mt-8 flex gap-2">
          {step > 0 && step < 6 && (
            <Button variant="secondary" size="lg" onClick={() => setStep((s) => (s - 1) as Step)} className="flex-1">
              Назад
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            disabled={!canProceed()}
            onClick={() => {
              if (step < 6) {
                setStep((s) => (s + 1) as Step);
              } else {
                onDone(
                  {
                    belt,
                    gi,
                    noGi,
                    goal: goal || undefined,
                    frequency: frequency || undefined,
                    onboardedAt: new Date().toISOString(),
                  },
                  known,
                );
              }
            }}
            className="flex-1"
          >
            {step === 6 ? "Начать" : step === 5 && known.length === 0 ? "Пропустить" : "Далее"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// === ШАГ 0: Welcome-слайдер ===
function WelcomeScreen() {
  const [slide, setSlide] = useState(0);
  // Первый слайд — дневник: приложение в первую очередь ежедневник
  const slides = [
    {
      icon: NotebookPen,
      title: "Дневник и план",
      description: "Отмечай тренировки — календарь покажет план недели, твой стиль и прогресс.",
      accent: "var(--brand-gold)",
    },
    {
      icon: BookOpen,
      title: "315 приёмов и позиций",
      description: "С механикой, рисками и пререквизитами. От белого до чёрного пояса.",
      accent: "var(--belt-blue)",
    },
    {
      icon: Dumbbell,
      title: "Умная отработка",
      description: "Готовый комплекс под твой уровень, время и записи дневника.",
      accent: "var(--belt-purple)",
    },
    {
      icon: HelpCircle,
      title: "Что делать, если…",
      description: "Быстрые решения для спарринга: выходы, свипы, сабмишены.",
      accent: "var(--belt-brown)",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <BrandLogo className="mb-4" />
        <h1 className="text-center text-xl font-bold tracking-tight">Добро пожаловать</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Пройдём короткую настройку — это займёт 30 секунд.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
        <div
          className="flex transition-transform duration-300"
          style={{ transform: `translateX(-${slide * 100}%)` }}
        >
          {slides.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="min-w-full px-2">
                <div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: `color-mix(in oklch, ${s.accent} 14%, transparent)` }}
                >
                  <Icon className="h-8 w-8" style={{ color: s.accent }} />
                </div>
                <h3 className="text-center text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {s.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Индикаторы слайдов */}
        <div className="mt-6 flex justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              className="h-2 rounded-full transition-all"
              style={{
                width: slide === i ? "24px" : "8px",
                background: slide === i ? "var(--color-primary)" : "var(--color-border)",
              }}
            />
          ))}
        </div>

        {/* Кнопки-стрелки */}
        <div className="mt-4 flex justify-between">
          <IconButton
            label="Предыдущий слайд"
            size="md"
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
            disabled={slide === 0}
          >
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <IconButton
            label="Следующий слайд"
            size="md"
            onClick={() => setSlide((s) => Math.min(slides.length - 1, s + 1))}
            disabled={slide === slides.length - 1}
          >
            <ChevronRight className="h-5 w-5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

// === ШАГ 1: Пояс ===
function BeltStep({ belt, setBelt }: { belt: Belt; setBelt: (b: Belt) => void }) {
  return (
    <section aria-label="Выбор пояса" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Твой пояс</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Покажем техники твоего уровня и следующие цели.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {BELT_ORDER.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBelt(b)}
            className="flex items-center justify-between rounded-xl border-2 p-3 text-left transition-all"
            style={{
              borderColor: belt === b ? "var(--color-primary)" : "var(--color-border)",
              background:
                belt === b
                  ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))"
                  : "var(--color-card)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-block h-6 w-10 rounded-md ring-1 ring-black/10"
                style={{ background: `var(--belt-${b})` }}
              />
              <span className="font-medium">
                {BELT_LABEL[b]}{" "}
                <span className="text-muted-foreground">({BELT_LABEL_EN[b]})</span>
              </span>
            </div>
            {belt === b && <Check className="h-5 w-5 text-primary" />}
          </button>
        ))}
      </div>
    </section>
  );
}

// === ШАГ 2: Gi / No-Gi ===
function StyleStep({
  gi, setGi, noGi, setNoGi,
}: {
  gi: boolean; setGi: (v: boolean) => void;
  noGi: boolean; setNoGi: (v: boolean) => void;
}) {
  return (
    <section aria-label="Формат" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Формат тренировок</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Выбери один или оба режима. Можно изменить позже.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ToggleTile
          label="Gi"
          sublabel="В кимоно"
          active={gi}
          onClick={() => setGi(!gi)}
        />
        <ToggleTile
          label="No-Gi"
          sublabel="Рашгард"
          active={noGi}
          onClick={() => setNoGi(!noGi)}
        />
      </div>

      {!gi && !noGi && (
        <p className="text-xs text-destructive">Выбери хотя бы один формат</p>
      )}
    </section>
  );
}

// === ШАГ 3: Цель ===
function GoalStep({
  goal, setGoal,
}: { goal: Goal | null; setGoal: (g: Goal) => void }) {
  const options: { value: Goal; label: string; desc: string; Icon: any }[] = [
    { value: "self-defense", label: "Самооборона", desc: "Защита на улице", Icon: Shield },
    { value: "competition", label: "Соревнования", desc: "Готовлюсь к турнирам", Icon: Trophy },
    { value: "hobby", label: "Для удовольствия", desc: "Тренируюсь в кайф", Icon: Smile },
  ];

  return (
    <section aria-label="Цель" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Твоя цель</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Это повлияет на рекомендации в тренировках.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {options.map(({ value, label, desc, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setGoal(value)}
            className="flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all"
            style={{
              borderColor: goal === value ? "var(--color-primary)" : "var(--color-border)",
              background:
                goal === value
                  ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))"
                  : "var(--color-card)",
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{
                background:
                  goal === value
                    ? "color-mix(in oklch, var(--color-primary) 15%, transparent)"
                    : "var(--color-muted)",
              }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
            {goal === value && <Check className="h-5 w-5 text-primary" />}
          </button>
        ))}
      </div>
    </section>
  );
}

// === ШАГ 4: Частота ===
function FrequencyStep({
  frequency, setFrequency,
}: { frequency: Frequency | null; setFrequency: (f: Frequency) => void }) {
  const options: { value: Frequency; label: string; desc: string }[] = [
    { value: 1, label: "1-2 раза в неделю", desc: "Поддерживаю форму" },
    { value: 3, label: "3 раза", desc: "Стабильный прогресс" },
    { value: 4, label: "4+ раз", desc: "Интенсивные тренировки" },
  ];

  return (
    <section aria-label="Частота" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Как часто тренируешься?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          От частоты считается план в календаре дневника и длина комплексов.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {options.map(({ value, label, desc }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFrequency(value)}
            className="flex items-center justify-between rounded-xl border-2 p-4 text-left transition-all"
            style={{
              borderColor:
                frequency === value ? "var(--color-primary)" : "var(--color-border)",
              background:
                frequency === value
                  ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))"
                  : "var(--color-card)",
            }}
          >
            <div>
              <div className="font-semibold">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
            {frequency === value && <Check className="h-5 w-5 text-primary" />}
          </button>
        ))}
      </div>
    </section>
  );
}

// === ШАГ 5: Что уже знаешь ===
// Отмеченные техники станут «изучено»: стартовый экран не пустой, рекомендации
// сразу отталкиваются от них. Показываем базовые по поясу + поиск по всей базе.
function KnownStep({
  belt, known, setKnown,
}: {
  belt: Belt;
  known: number[];
  setKnown: React.Dispatch<React.SetStateAction<number[]>>;
}) {
  const [query, setQuery] = useState("");
  const maxBeltIdx = BELT_ORDER.indexOf(belt);

  const pool = useMemo(
    () => TECHNIQUES.filter((t) => BELT_ORDER.indexOf(t.belt) <= maxBeltIdx),
    [maxBeltIdx],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? pool.filter(
          (t) =>
            t.nameRu.toLowerCase().includes(q) ||
            t.nameEn.toLowerCase().includes(q) ||
            t.label.toLowerCase().includes(q),
        )
      : [...pool].sort(
          (a, b) =>
            a.difficulty - b.difficulty ||
            BELT_ORDER.indexOf(a.belt) - BELT_ORDER.indexOf(b.belt),
        );
    return base.slice(0, 24);
  }, [pool, query]);

  // Выбранные, но выпавшие из текущей выдачи — показываем отдельно, чтобы не потерялись
  const selectedOutside = useMemo(
    () =>
      known
        .filter((id) => !shown.some((t) => t.id === id))
        .map((id) => pool.find((t) => t.id === id))
        .filter((t): t is Technique => Boolean(t)),
    [known, shown, pool],
  );

  const toggle = (id: number) =>
    setKnown((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <section aria-label="Знакомые техники" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Что уже знаешь?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Отметь знакомые техники — от них оттолкнёмся в рекомендациях.
          Необязательно — можно пропустить.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти технику…"
          className="w-full rounded-xl border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {selectedOutside.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOutside.map((t) => (
            <TechChip key={t.id} tech={t} active onClick={() => toggle(t.id)} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {shown.map((t) => (
          <TechChip key={t.id} tech={t} active={known.includes(t.id)} onClick={() => toggle(t.id)} />
        ))}
      </div>

      {shown.length === 0 && (
        <p className="text-xs text-muted-foreground">Ничего не найдено — попробуй другой запрос.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Выбрано: <span className="font-semibold text-foreground">{known.length}</span>
      </p>
    </section>
  );
}

function TechChip({
  tech, active, onClick,
}: { tech: Technique; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-all"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        borderLeft: `3px solid var(--belt-${tech.belt})`,
        background: active
          ? "color-mix(in oklch, var(--color-primary) 10%, var(--color-card))"
          : "var(--color-card)",
      }}
      title={`${GROUP_LABEL[tech.group]} · ${BELT_LABEL[tech.belt]}`}
    >
      {tech.nameRu}
      {active && <Check className="h-3 w-3 text-primary" />}
    </button>
  );
}

// === ШАГ 6: Финальный экран ===
function FinalScreen({
  belt, gi, noGi, goal, knownCount,
}: {
  belt: Belt; gi: boolean; noGi: boolean; goal: Goal | null; knownCount: number;
}) {
  const goalLabel = {
    "self-defense": "самообороне",
    competition: "соревнованиям",
    hobby: "удовольствию",
  }[goal || "hobby"];

  return (
    <section className="space-y-6 text-center">
      <div
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: "color-mix(in oklch, var(--color-primary) 15%, transparent)" }}
      >
        <Sparkles className="h-10 w-10 text-primary" />
      </div>

      <div>
        <h2 className="text-xl font-bold">Всё готово!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Библиотека настроена под твой уровень.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 text-left space-y-2">
        <SummaryRow label="Пояс" value={`${BELT_LABEL[belt]} (${BELT_LABEL_EN[belt]})`} />
        <SummaryRow
          label="Формат"
          value={[gi && "Gi", noGi && "No-Gi"].filter(Boolean).join(" + ")}
        />
        <SummaryRow label="Фокус" value={goalLabel} />
        {knownCount > 0 && (
          <SummaryRow label="Уже знаешь" value={`${knownCount} техн.`} />
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Всё можно изменить в профиле в любой момент.
      </p>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// === Компонент плитки ===
function ToggleTile({
  label, sublabel, active, onClick,
}: { label: string; sublabel?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative rounded-xl border-2 p-4 text-left transition-all"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        background: active
          ? "color-mix(in oklch, var(--color-primary) 10%, var(--color-card))"
          : "var(--color-card)",
      }}
    >
      <div className="font-semibold">{label}</div>
      {sublabel && (
        <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
      )}
      {active && (
        <Check
          className="absolute top-2 right-2 h-4 w-4 text-primary"
        />
      )}
    </button>
  );
}
