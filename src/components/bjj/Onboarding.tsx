import { useState } from "react";
import type { Belt, StyleProfile } from "@/lib/bjj/types";
import { BELT_LABEL, BELT_LABEL_EN, BELT_ORDER } from "@/lib/bjj/constants";

// === ONBOARDING (выбор пояса + gi/no-gi) ===
export function Onboarding({ onDone }: { onDone: (p: Partial<StyleProfile>) => void }) {
  const [belt, setBelt] = useState<Belt>("white");
  const [gi, setGi] = useState(true);
  const [noGi, setNoGi] = useState(true);
  const [step, setStep] = useState<0 | 1>(0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-between px-6 py-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Добро пожаловать в BJJ Companion</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Компаньон для бразильского джиу-джитсу: библиотека техник, умные тренировки и прогресс.
          </p>
        </div>

        {step === 0 && (
          <section aria-label="Выбор пояса" className="space-y-4">
            <h2 className="text-lg font-semibold">Ваш пояс / Your belt</h2>
            <div className="grid grid-cols-1 gap-2">
              {BELT_ORDER.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBelt(b)}
                  className="flex items-center justify-between rounded-xl border-2 p-3 text-left transition-all"
                  style={{
                    borderColor: belt === b ? "var(--color-primary)" : "var(--color-border)",
                    background: belt === b ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))" : "var(--color-card)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-6 w-10 rounded-md ring-1 ring-black/10"
                      style={{ background: `var(--belt-${b})` }}
                    />
                    <span className="font-medium">
                      {BELT_LABEL[b]} <span className="text-muted-foreground">({BELT_LABEL_EN[b]})</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section aria-label="Формат" className="space-y-4">
            <h2 className="text-lg font-semibold">Формат тренировок</h2>
            <div className="grid grid-cols-2 gap-3">
              <ToggleTile label="Gi (в кимоно)" active={gi} onClick={() => setGi((v) => !v)} />
              <ToggleTile label="No-Gi" active={noGi} onClick={() => setNoGi((v) => !v)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Выберите один или оба режима. Библиотека и генератор будут учитывать этот фильтр.
            </p>
          </section>
        )}

        <div className="mt-8 flex gap-2">
          {step === 1 && (
            <button
              type="button"
              onClick={() => setStep(0)}
              className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-medium"
            >
              Назад
            </button>
          )}
          <button
            type="button"
            disabled={step === 1 && !gi && !noGi}
            onClick={() => {
              if (step === 0) setStep(1);
              else onDone({ belt, gi, noGi });
            }}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {step === 0 ? "Далее" : "Начать"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleTile({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border-2 p-4 text-sm font-medium transition-all"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        background: active ? "color-mix(in oklch, var(--color-primary) 10%, var(--color-card))" : "var(--color-card)",
      }}
    >
      {label}
    </button>
  );
}
