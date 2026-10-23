import { useEffect, useState } from "react";
import { ChevronDown, PlayCircle, Send } from "lucide-react";
import { getTelegram, isTelegram } from "@/lib/telegram";

// Видео из Telegram-канала тренера: альбомы с тренировок, где упоминается техника.
// Один альбом может стоять в нескольких техниках (на тренировке разбирали связку).
// Ссылки лежат в отдельном ленивом файле — в стартовый бандл не попадают.

interface ChannelAlbum {
  post: number;
  videos: number;
  date?: string;
  text?: string;
}
interface ChannelData {
  channel: string | null;
  byTechnique: Record<string, ChannelAlbum[]>;
}

let cache: Promise<ChannelData> | null = null;
function loadChannel(): Promise<ChannelData> {
  cache ??= import("@/lib/bjj/generated/channel-videos.json").then(
    (m) => m.default as unknown as ChannelData,
  );
  return cache;
}

const SHOWN = 4;

function openLink(url: string) {
  const tg = getTelegram();
  if (isTelegram() && tg?.openTelegramLink) {
    try {
      tg.openTelegramLink(url);
      return;
    } catch {
      /* фоллбэк ниже */
    }
  }
  window.open(url, "_blank", "noopener");
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function ChannelVideos({ techniqueId }: { techniqueId: number }) {
  // первый рендер пустой и на сервере, и на клиенте — гидрация без расхождений
  const [data, setData] = useState<{ channel: string; albums: ChannelAlbum[] } | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadChannel().then((d) => {
      const albums = d.byTechnique[String(techniqueId)] ?? [];
      if (alive && d.channel && albums.length) setData({ channel: d.channel, albums });
    });
    return () => {
      alive = false;
    };
  }, [techniqueId]);

  if (!data) return null;
  const total = data.albums.reduce((n, a) => n + a.videos, 0);
  const list = all ? data.albums : data.albums.slice(0, SHOWN);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Send className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Видео в канале «Моё БЖЖ»</span>
        <span className="ml-auto text-xs text-muted-foreground">{total} видео</span>
      </div>
      <ul className="space-y-2">
        {list.map((a) => (
          <li key={a.post}>
            <button
              type="button"
              onClick={() => openLink(`https://t.me/${data.channel}/${a.post}`)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-muted/60 px-3 py-2 text-left transition-colors hover:bg-muted"
            >
              <PlayCircle className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{a.text || "Тренировка"}</span>
                <span className="block text-xs text-muted-foreground">
                  {a.videos > 1 ? `Альбом, ${a.videos} видео` : "1 видео"}
                  {fmtDate(a.date) && ` · ${fmtDate(a.date)}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {data.albums.length > SHOWN && !all && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" />
          Ещё {data.albums.length - SHOWN}
        </button>
      )}
    </section>
  );
}
