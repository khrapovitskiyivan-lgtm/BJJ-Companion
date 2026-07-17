import { useProfile } from "@/lib/bjj/store";
import { BELT_LABEL, BELT_ORDER, STYLE_ORDER, STYLE_META } from "@/lib/bjj/constants";
import { Sheet, Section, Toggle } from "@/components/bjj/ui";
import { STYLE_ICONS } from "@/lib/bjj/styleIcons";
import type { Belt, Frequency } from "@/lib/bjj/types";
import { Check } from "lucide-react";

// Частота тренировок — те же варианты, что в онбординге; задаёт план дневника
const FREQ_OPTIONS: { value: Frequency; label: string; desc: string }[] = [
  { value: 1, label: "1-2 раза", desc: "Поддерживаю форму" },
  { value: 3, label: "3 раза", desc: "Стабильный прогресс" },
  { value: 4, label: "4+ раз", desc: "Интенсивные тренировки" },
];

// Лист игрока: открывается тапом по кружку профиля в «Моей игре».
// Здесь всё, что определяет твою игру: пояс, формат Gi/No-Gi, стиль игры.
export function CharacterSheet({ onClose }: { onClose: () => void }) {
  const { profile, update } = useProfile();

  return (
    <Sheet
      title="Мой профиль игрока"
      subtitle={`${BELT_LABEL[profile.belt]} пояс · ${
        profile.gi && profile.noGi ? "Gi + No-Gi" : profile.gi ? "Gi" : "No-Gi"
      }`}
      onClose={onClose}
    >
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
