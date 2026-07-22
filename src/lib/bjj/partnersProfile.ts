import type { ProgressMap } from "./store";
import type { DiaryEntry, StyleProfile } from "./types";
import type { PublishInput } from "./partners";
import { computeStyleAffinity } from "./styleProfile";
import { computeStats } from "./stats";
import { weekReport } from "./tgRemind";
import { trainedByDate, planStreak } from "./plan";

// Собирает публичный профиль для партнёров из состояния приложения. Чистая
// функция (device_id передаётся аргументом — не тянем store, чтобы тестировалось).
// Наружу идут только агрегаты: стиль, характеристики, статус недели. Ни техник,
// ни заметок, ни содержимого дневника.
export function buildPublishInput(args: {
  device: string;
  profile: StyleProfile;
  progress: ProgressMap;
  practiceCount: Record<number, number>;
  entries: DiaryEntry[];
  today: Date;
}): PublishInput {
  const { device, profile, progress, practiceCount, entries, today } = args;

  const styles = [...computeStyleAffinity(progress, practiceCount)].sort(
    (a, b) => b.score - a.score,
  );
  const topStyle = styles.find((s) => s.score > 0)?.style ?? null;

  const stats: Record<string, number> = {};
  for (const s of computeStats(progress, practiceCount)) stats[s.stat] = s.pct;

  const wr = weekReport(entries, today);
  const quota = profile.frequency ?? null;
  const streak = quota ? planStreak(trainedByDate(entries), quota, today) : 0;

  return {
    device,
    belt: profile.belt,
    gi: profile.gi,
    nogi: profile.noGi,
    style: topStyle,
    stats,
    weekStart: wr.weekStart,
    weekDone: wr.weekDone,
    quota,
    streak,
  };
}
