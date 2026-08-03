import { Play } from "lucide-react";
import { bunnyEmbedUrl } from "@/lib/bjj/videoConfig";

// Плеер Bunny.net Stream (embed-iframe). Демо-фаза: видео открыто всем.
// Токен-защита подключится в Фазе 1 монетизации через bunnyEmbedUrl.
export function VideoBlock({ videoId, title }: { videoId: string; title: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={bunnyEmbedUrl(videoId)}
          title={`Видео: ${title}`}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
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
