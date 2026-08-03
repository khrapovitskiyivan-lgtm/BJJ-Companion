import { useMemo, useState } from "react";
import { useProfile, useProgress, useDiary, useReviewed } from "@/lib/bjj/store";
import { activePause } from "@/lib/bjj/pause";
import { dayKey } from "@/lib/bjj/plan";
import { BELT_LABEL, BELT_ORDER, STYLE_ORDER, STYLE_META, WEEKDAY_SHORT, DEFAULT_TRAINING_DAYS } from "@/lib/bjj/constants";
import { computeTotalXp, levelForXp } from "@/lib/bjj/xp";
import { TECHNIQUES } from "@/lib/bjj/data";
import { Sheet, Section, Toggle } from "@/components/bjj/ui";
import { STYLE_ICONS } from "@/lib/bjj/styleIcons";
import type { Belt, Frequency, Goal } from "@/lib/bjj/types";
import { Check, Shield, Trophy, Smile, Heart } from "lucide-react";

// Частота тренировок — те же варианты, что в онбординге; задаёт план дневника
const FREQ_OPTIONS: { value: Frequency; label: string; desc: string }[] = [
  { value: 1, label: "1-2 раза в неделю", desc: "Поддерживаю форму" },
  { value: 3, label: "3 раза", desc: "Стабильный прогресс" },
  { value: 4, label: "4+ раз", desc: "Интенсивные тренировки" },
];

// Цель — те же 4 варианта, что в онбординге; влияет на рекомендации подбора
const GOAL_OPTIONS: { value: Goal; label: string; Icon: typeof Shield }[] = [
  { value: "self-defense", label: "Самооборона", Icon: Shield },
  { value: "competition", label: "Соревнования", Icon: Trophy },
  { value: "hobby", label: "Для удовольствия", Icon: Smile },
  { value: "health", label: "Здоровье", Icon: Heart },
];

// Лист игрока: открывается тапом по кружку профиля в «Моей игре».
// Здесь всё, что определяет твою игру: пояс, формат Gi/No-Gi, стиль игры.
export function CharacterSheet({ onClose }: { onClose: () => void }) {
  const { profile, update } = useProfile();
  const { progress } = useProgress();
  const { entries } = useDiary();
  const { reviewed } = useReviewed();

  const lvl = useMemo(
    () => levelForXp(computeTotalXp({ entries, progress, belt: profile.belt, techniques: TECHNIQUES, reviewed })),
    [entries, progress, profile.belt, reviewed],
  );

  // Пауза тренировок: активная = без `to` (и без прошедшей даты возврата)
  const todayKey = dayKey(new Date());
  const pause = activePause(profile.pauses, todayKey);
  const [pauseUntil, setPauseUntil] = useState("");
  // Ставит паузу: закрывает любую «застрявшую» активную (авто-снятую по дате),
  // затем добавляет новую (открытую или с датой возврата until).
  const startPause = (until?: string) => {
    const prev = (profile.pauses ?? []).map((p) =>
      !p.to && p !== pause ? { ...p, to: p.until ?? todayKey } : p,
    );
    update({ pauses: [...prev, until ? { from: todayKey, until } : { from: todayKey }] });
  };
  // Снимает активную паузу: проставляет фактическую дату снятия.
  const endPause = () => {
    update({ pauses: (profile.pauses ?? []).map((p) => (p === pause ? { ...p, to: todayKey } : p)) });
  };

  return (
    <Sheet
      title="Мой профиль игрока"
      subtitle={`${BELT_LABEL[profile.belt]} пояс · ${
        profile.gi && profile.noGi ? "Gi + No-Gi" : profile.gi ? "Gi" : "No-Gi"
      }`}
      onClose={onClose}
    >
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Уровень</p>
          <span className="text-2xl font-bold tabular-nums text-primary">{lvl.level}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.round((lvl.xpIntoLevel / lvl.xpForLevel) * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {lvl.xpIntoLevel} / {lvl.xpForLevel} XP до LVL {lvl.level + 1}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Растёт от тренировок в дневнике, разбора и отработки. Зеркало твоей регулярности.
        </p>
      </div>

      <Section title="Пояс">
        <div className="grid grid-cols-5 gap-2">
          {BELT_ORDER.map((b: Belt) => (
            <button
              key={b}
              onClick={() => update({ belt: b })}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all"
              style={{
                borderColor: profile.belt === b ? "var(--color-primary)" : "var(--color-border)",
                background:
                  profile.belt === b
                    ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))"
                    : "var(--color-card)",
              }}
            >
              <span className="block h-4 w-8 rounded ring-1 ring-black/10" style={{ background: `var(--belt-${b})` }} />
              <span className="text-[10px] font-medium">{BELT_LABEL[b]}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Формат тренировок">
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Gi (в кимоно)" active={profile.gi} onClick={() => (profile.noGi || !profile.gi) && update({ gi: !profile.gi })} />
          <Toggle label="No-Gi" active={profile.noGi} onClick={() => (profile.gi || !profile.noGi) && update({ noGi: !profile.noGi })} />
        </div>
      </Section>

      {/* Цель — редактируемая (была заморожена после онбординга); влияет на подбор */}
      <Section title="Цель" hint="Влияет на рекомендации в отработке и следующих техниках.">
        <div className="grid grid-cols-2 gap-2">
          {GOAL_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => update({ goal: value })}
              className="flex items-center gap-2 rounded-xl border-2 p-2.5 text-left transition-all"
              style={{
                borderColor: profile.goal === value ? "var(--color-primary)" : "var(--color-border)",
                background:
                  profile.goal === value
                    ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))"
                    : "var(--color-card)",
              }}
            >
              <Icon className="h-4 w-4 shrink-0 text-foreground/80" strokeWidth={1.9} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Частота тренировок — план для календаря дневника */}
      <Section title="Частота тренировок" hint="Сколько раз в неделю тренируешься — от этого считается план в дневнике.">
        <div className="grid grid-cols-3 gap-2">
          {FREQ_OPTIONS.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => update({ frequency: value })}
              className="flex flex-col items-center gap-0.5 rounded-xl border-2 p-2.5 text-center transition-all"
              style={{
                borderColor: profile.frequency === value ? "var(--color-primary)" : "var(--color-border)",
                background:
                  profile.frequency === value
                    ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))"
                    : "var(--color-card)",
              }}
            >
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-[10px] text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Дни тренировок" hint="Из выбранных дней считается план недели и «до плана осталось». Невыбранные — выходные.">
        <div className="flex gap-1.5">
          {WEEKDAY_SHORT.map((label, d) => {
            const days = profile.trainingDays ?? DEFAULT_TRAINING_DAYS;
            const active = days.includes(d);
            return (
              <button
                key={d}
                onClick={() => {
                  const next = active ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b);
                  if (next.length === 0) return; // не даём убрать последний тренировочный день
                  update({ trainingDays: next });
                }}
                className="flex-1 rounded-xl border-2 py-2 text-center text-xs font-semibold transition-all"
                style={{
                  borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                  background: active
                    ? "color-mix(in oklch, var(--color-primary) 12%, var(--color-card))"
                    : "var(--color-card)",
                  color: active ? "var(--color-primary)" : "var(--color-muted-foreground)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Пауза" hint="Травма, отпуск, перерыв? План и серия замрут, напоминания выключатся. Это не провал.">
        {pause ? (
          <div
            className="rounded-xl border-2 p-3"
            style={{ borderColor: "var(--color-primary)", background: "color-mix(in oklch, var(--color-primary) 6%, var(--color-card))" }}
          >
            <p className="text-sm font-semibold text-primary">
              На паузе с {pause.from}
              {pause.until ? ` · до ${pause.until}` : " · без срока"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">План и серия заморожены. Вернёшься — встретим.</p>
            <button
              onClick={endPause}
              className="mt-3 rounded-xl border border-input bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted"
            >
              Снять паузу
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => startPause()}
              className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.99]"
            >
              Поставить на паузу
            </button>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={pauseUntil}
                onChange={(e) => setPauseUntil(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Дата возврата"
              />
              <button
                onClick={() => pauseUntil && startPause(pauseUntil)}
                disabled={!pauseUntil}
                className="rounded-xl border border-input bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-40"
              >
                До даты
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Стиль игры (аспирация — влияет на «Разрыв» и рекомендации) */}
      <Section title="Стиль игры" hint="Отметь свои стили — приложение учтёт их в рекомендациях и «Моей игре».">
        <div className="space-y-1.5">
          {STYLE_ORDER.map((s) => {
            const meta = STYLE_META[s];
            const Icon = STYLE_ICONS[s];
            const selected = profile.preferredStyles?.includes(s) ?? false;
            const toggle = () => {
              const cur = profile.preferredStyles ?? [];
              update({ preferredStyles: selected ? cur.filter((x) => x !== s) : [...cur, s] });
            };
            return (
              <button
                key={s}
                onClick={toggle}
                className="flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-all"
                style={{
                  borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
                  background: selected ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))" : "var(--color-card)",
                }}
              >
                <Icon className="h-4 w-4 shrink-0 text-foreground/80" strokeWidth={1.9} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{meta.ru}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{meta.desc}</span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </Section>
    </Sheet>
  );
}
