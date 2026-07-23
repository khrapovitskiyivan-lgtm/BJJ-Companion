import { Link } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";
import { useDiary, useProgress, useReviewed } from "@/lib/bjj/store";
import { pendingReview } from "@/lib/bjj/reviewQueue";
import { TECH_BY_ID } from "@/lib/bjj/data";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { buttonClass } from "@/components/bjj/ui";
import { track } from "@/lib/bjj/telemetry";

// Блок «Разбери показанное»: техники из недавних записей, которые ещё не открывали
// после лога. Сердце крючка после тренировки — освежить детали/связи, пока свежо,
// и закинуть в свою отработку. Само-очищается (открыл карточку -> техника уходит).
export function ReviewShownBlock() {
  const { entries, hydrated: dh } = useDiary();
  const { progress, hydrated: ph } = useProgress();
  const { reviewed, hydrated: rh } = useReviewed();
  // До гидратации не считаем: new Date() и localStorage только на клиенте
  if (!dh || !ph || !rh) return null;

  const ids = pendingReview(entries, reviewed, progress, new Date());
  const techs = ids.map((id) => TECH_BY_ID[id]).filter(Boolean);
  if (techs.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Разбери показанное</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Открой карточку — освежи детали и связи, пока свежо.
      </p>
      <div className="mt-3 space-y-2">
        {techs.map((t) => (
          // onClick на обёртке: TechniqueRow сам ссылка, пометка «разобрал» — на карточке
          <div key={t.id} onClick={() => track("review_opened", String(t.id))}>
            <TechniqueRow technique={t} inset />
          </div>
        ))}
      </div>
      <Link
        to="/workout"
        search={{ src: "diary" }}
        onClick={() => track("review_drill")}
        className={buttonClass("soft", "md", "mt-3 w-full")}
      >
        <Dumbbell className="h-4 w-4" />
        В отработку
      </Link>
    </section>
  );
}
