import { useEffect } from "react";
import { useProfile } from "@/lib/bjj/store";
import { BELT_LABEL, BELT_ORDER, STYLE_ORDER, STYLE_META } from "@/lib/bjj/constants";
import { Toggle } from "@/components/bjj/ui";
import { STYLE_ICONS } from "@/lib/bjj/styleIcons";
import type { Belt } from "@/lib/bjj/types";
import { X, Check } from "lucide-react";

// Лист игрока: открывается тапом по кружку профиля в «Моей игре».
// Здесь всё, что определяет твою игру: пояс, формат Gi/No-Gi, стиль игры.
export function CharacterSheet({ onClose }: { onClose: () => void }) {
  const { profile, update } = useProfile();

  // Esc закрывает
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Закрыть" onClick={onClose} />

      <div className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:rounded-3xl">
        {/* Шапка */}
        <div className="flex items-center gap-4 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold tracking-tight">Мой профиль игрока</p>
            <p className="text-xs text-muted-foreground">
              {BELT_LABEL[profile.belt]} пояс ·{" "}
              {profile.gi && profile.noGi ? "Gi + No-Gi" : profile.gi ? "Gi" : "No-Gi"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* Пояс */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Пояс</h3>
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
          </section>

          {/* Формат тренировок */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Формат тренировок</h3>
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Gi (в кимоно)" active={profile.gi} onClick={() => (profile.noGi || !profile.gi) && update({ gi: !profile.gi })} />
              <Toggle label="No-Gi" active={profile.noGi} onClick={() => (profile.gi || !profile.noGi) && update({ noGi: !profile.noGi })} />
            </div>
          </section>

          {/* Стиль игры (аспирация — влияет на «Разрыв» и рекомендации) */}
          <section>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Стиль игры</h3>
            <p className="mb-2 text-[11px] text-muted-foreground">Отметь свои стили — приложение учтёт их в рекомендациях и «Моей игре».</p>
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
          </section>
        </div>
      </div>
    </div>
  );
}
