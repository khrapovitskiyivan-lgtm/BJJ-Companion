import { useEffect, useState } from "react";
import { VideoOff, Check, ThumbsUp } from "lucide-react";
import { Button } from "@/components/bjj/ui";
import { hasVideoInterest, markVideoInterest } from "@/lib/bjj/videoInterest";

// Тихий крючок на карточке техники без курированного видео: сообщает, что разбора
// пока нет, и даёт отметить интерес. Тап шлёт сигнал (videoInterest.ts), по которому
// видно, какие техники курировать видео первыми.
// Когда у техники появится videoUrl, вместо этого блока рендерится VideoBlock.
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
        <VideoOff className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Видео-разбора пока нет</span>
      </div>
      {done ? (
        <div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Check className="h-4 w-4" />
            Учтено
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Поможет решить, какие видео добавить первыми.
          </p>
        </div>
      ) : (
        <Button variant="secondary" size="md" fullWidth onClick={onWant}>
          <ThumbsUp className="h-4 w-4" />
          Нужен видео-разбор
        </Button>
      )}
    </section>
  );
}
