import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { useProfile, useProgress } from "@/lib/bjj/store";
import { TECHNIQUES } from "@/lib/bjj/data";
import { BELT_LABEL, BELT_ORDER } from "@/lib/bjj/constants";
import type { Belt } from "@/lib/bjj/types";
import { Info, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, update } = useProfile();
  const { progress } = useProgress();

  const done = TECHNIQUES.filter((t) => progress[t.id] === "done").length;
  const inProgress = TECHNIQUES.filter((t) => progress[t.id] === "in_progress").length;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Карточка профиля */}
        <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <span
            className="block h-14 w-14 shrink-0 rounded-full ring-2 ring-border"
            style={{ background: `var(--belt-${profile.belt})` }}
            aria-hidden
          />
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">{BELT_LABEL[profile.belt]} пояс</h1>
            <p className="text-xs text-muted-foreground">
              {profile.gi && profile.noGi ? "Gi + No-Gi" : profile.gi ? "Gi" : "No-Gi"} · {done} изучено ·{" "}
              {inProgress} в процессе
            </p>
          </div>
        </section>

        {/* Настройки: пояс */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Пояс</h2>
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
                <span
                  className="block h-4 w-8 rounded ring-1 ring-black/10"
                  style={{ background: `var(--belt-${b})` }}
                />
                <span className="text-[10px] font-medium">{BELT_LABEL[b]}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Настройки: формат */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Формат тренировок</h2>
          <div className="grid grid-cols-2 gap-2">
            <ToggleTile
              label="Gi (в кимоно)"
              active={profile.gi}
              onClick={() => (profile.noGi || !profile.gi) && update({ gi: !profile.gi })}
            />
            <ToggleTile
              label="No-Gi"
              active={profile.noGi}
              onClick={() => (profile.gi || !profile.noGi) && update({ noGi: !profile.noGi })}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Влияет на библиотеку, карту и генератор тренировок. Минимум один формат.
          </p>
        </section>

        {/* Настройки: стиль */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Ваш стиль</h2>
          <div className="grid grid-cols-2 gap-2">
            <ToggleTile label="Гибкость" active={!!profile.flexibility} onClick={() => update({ flexibility: !profile.flexibility })} />
            <ToggleTile label="Давление" active={!!profile.pressure} onClick={() => update({ pressure: !profile.pressure })} />
            <ToggleTile label="Длинные рычаги" active={!!profile.long_limbs} onClick={() => update({ long_limbs: !profile.long_limbs })} />
            <ToggleTile label="Скорость" active={!!profile.speed} onClick={() => update({ speed: !profile.speed })} />
          </div>
        </section>

        {/* О приложении */}
        <Link
          to="/about"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:bg-muted"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 text-primary" />
            О приложении · Как пользоваться
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </AppShell>
  );
}

function ToggleTile({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border-2 p-3 text-sm font-medium transition-all"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        background: active ? "color-mix(in oklch, var(--color-primary) 10%, var(--color-card))" : "var(--color-card)",
      }}
    >
      {label}
    </button>
  );
}
