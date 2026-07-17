import { useEffect, useRef, useState } from "react";
import { useNotes } from "@/lib/bjj/store";
import { track } from "@/lib/bjj/telemetry";
import { PencilLine } from "lucide-react";

// «Мои заметки» на карточке техники: личный блокнот (детали от тренера, свои
// ошибки). Автосохранение с дебаунсом; пустая строка удаляет заметку.
// Хранение как у прогресса: localStorage + облако для залогиненных.
export function NotesSection({ techniqueId }: { techniqueId: number }) {
  const { notes, setNote, hydrated } = useNotes();
  const saved = notes[techniqueId] ?? "";

  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Последний драфт для сохранения при размонтировании (уход со страницы до дебаунса)
  const pending = useRef<{ dirty: boolean; value: string }>({ dirty: false, value: "" });

  // Подтянуть сохранённое после гидратации/синхронизации, пока пользователь не печатает
  useEffect(() => {
    if (!dirty) setDraft(saved);
  }, [saved, dirty]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current.dirty) {
        setNote(techniqueId, pending.current.value);
        if (pending.current.value.trim()) track("note_saved", undefined, { dailyDedup: true });
      }
    },
    [techniqueId, setNote],
  );

  const onChange = (value: string) => {
    setDraft(value);
    setDirty(true);
    pending.current = { dirty: true, value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setNote(techniqueId, value);
      if (value.trim()) track("note_saved", undefined, { dailyDedup: true });
      setDirty(false);
      pending.current = { dirty: false, value };
    }, 600);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <PencilLine className="h-4 w-4 text-primary" />
          Мои заметки
        </h2>
        {(dirty || saved) && (
          <span className="text-[11px] text-muted-foreground">{dirty ? "Сохраняем…" : "Сохранено"}</span>
        )}
      </div>
      <textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        disabled={!hydrated}
        placeholder="Детали от тренера, свои ошибки, нюансы захвата…"
        rows={3}
        className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </section>
  );
}
