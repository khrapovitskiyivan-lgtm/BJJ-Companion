import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, PlayCircle, Send } from "lucide-react";
import { getTelegram, isTelegram } from "@/lib/telegram";
import { supabase } from "@/lib/supabase";

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

// Новые посты канала, распознанные ботом после разметки (таблица bjj_channel_posts).
// Ошибка сети/базы не ломает блок: остаются размеченные видео.
async function loadLive(techniqueId: number): Promise<ChannelAlbum[]> {
  try {
    const { data, error } = await supabase.rpc("bjj_channel_videos", { p_tech: techniqueId });
    if (error || !Array.isArray(data)) return [];
    return (data as { post: number; videos: number; posted_at: string | null; caption: string | null }[]).map((r) => {
      const first = (r.caption ?? "").replace(/\s*#[\p{L}\p{N}_]+/gu, "").trim().split(String.fromCharCode(10))[0];
      return {
        post: Number(r.post),
        videos: r.videos,
        date: r.posted_at?.slice(0, 10),
        text: first.length > 72 ? first.slice(0, 72) + "…" : first,
      };
    });
  } catch {
    return [];
  }
}

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

export function ChannelVideos({ techniqueId, fallback }: { techniqueId: number; fallback?: ReactNode }) {
  // первый рендер пустой и на сервере, и на клиенте — гидрация без расхождений
  const [data, setData] = useState<{ channel: string; albums: ChannelAlbum[] } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    void Promise.all([loadChannel(), loadLive(techniqueId)]).then(([d, live]) => {
      if (!alive) return;
      const known = d.byTechnique[String(techniqueId)] ?? [];
      const seen = new Set(known.map((a) => a.post));
      const albums = [...known, ...live.filter((a) => !seen.has(a.post))].sort((a, b) => b.post - a.post);
      setData(d.channel && albums.length ? { channel: d.channel, albums } : null);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [techniqueId]);

  if (!data) return loaded ? <>{fallback}</> : null;
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
