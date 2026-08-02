import { useEffect, useState } from "react";
import { Clapperboard, Check, ThumbsUp } from "lucide-react";
import { Button } from "@/components/bjj/ui";
import { hasVideoInterest, markVideoInterest } from "@/lib/bjj/videoInterest";

// Крючок на карточке техники без видео: разборы снимаются профессионально, тап
// «Снять это первым» шлёт сигнал (videoInterest.ts) — по нему выбираем, какие
// техники снять раньше. Когда у техники появится videoUrl, вместо блока — VideoBlock.
export function VideoInterestPrompt({ techniqueId }: { techniqueId: number }) {
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
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Clapperboard className="h-4 w-4" style={{ color: "var(--brand-gold-ink)" }} />
        <span className="text-sm font-medium">Видео скоро: снимаем разборы</span>
      </div>
      {done ? (
        <div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Check className="h-4 w-4" />В приоритете съёмки
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Отметки помогают выбрать, какие техники снять первыми.
          </p>
        </div>
      ) : (
        <Button variant="secondary" size="md" fullWidth onClick={onWant}>
          <ThumbsUp className="h-4 w-4" />
          Снять это первым
        </Button>
      )}
    </section>
  );
}
