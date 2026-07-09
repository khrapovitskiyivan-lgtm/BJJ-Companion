import { Play } from "lucide-react";

export function VideoBlock({ url, title }: { url: string; title: string }) {
  const embedUrl = url.includes("youtube.com")
    ? url.replace("watch?v=", "embed/")
    : url.includes("youtu.be")
    ? url.replace("youtu.be/", "youtube.com/embed/")
    : url;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={embedUrl}
          title={`Видео: ${title}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
