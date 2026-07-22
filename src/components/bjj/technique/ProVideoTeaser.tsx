import { useEffect, useState } from "react";
import { Play, Lock, Check } from "lucide-react";
import { Button } from "@/components/bjj/ui";
import { hasVideoInterest, markVideoInterest } from "@/lib/bjj/videoInterest";

// Тизер платного видео на карточке техники без реального медиа.
// Крючок «Мне интересно» шлёт сигнал спроса по технике (см. videoInterest.ts).
// Когда у техники появится videoUrl, вместо тизера рендерится VideoBlock.
export function ProVideoTeaser({ techniqueId }: { techniqueId: number }) {
  // SSR-safe: первый рендер как на сервере (интереса нет), затем читаем локально.
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(hasVideoInterest(techniqueId));
  }, [techniqueId]);

  function onWant() {
    markVideoInterest(techniqueId);
    setDone(true);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative flex h-24 items-center justify-center gap-2 border-b border-dashed border-border bg-muted/40">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
          <Play className="h-5 w-5 text-muted-foreground" />
        </div>
        <span
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            background: "color-mix(in oklch, var(--brand-gold) 18%, transparent)",
            color: "var(--brand-gold-ink)",
          }}
        >
          <Lock className="h-3 w-3" />
          Скоро в PRO
        </span>
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold">Детальный видео-разбор техники</p>
        {done ? (
          <div className="mt-3">
            <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              Интерес учтён
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Поможет решить, что снять первым.
            </p>
          </div>
        ) : (
          <Button variant="primary" size="md" fullWidth className="mt-3" onClick={onWant}>
            Мне интересно
          </Button>
        )}
      </div>
    </section>
  );
}
