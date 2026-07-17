import { Link } from "@tanstack/react-router";
import type { Technique, ProgressStatus } from "@/lib/bjj/types";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import { Check, Circle, CircleDot, X } from "lucide-react";
import { Badge } from "@/components/bjj/ui";

// === TECHNIQUE CARD ===
const STATUS_ICON = {
  not_started: Circle,
  in_progress: CircleDot,
  done: Check,
} as const;

const STATUS_COLOR: Record<ProgressStatus, string> = {
  not_started: "var(--status-idle)",
  in_progress: "var(--status-progress)",
  done: "var(--status-done)",
};

const STATUS_LABEL: Record<ProgressStatus, string> = {
  not_started: "Не начато",
  in_progress: "В процессе",
  done: "Готово",
};

// Строка-ссылка на технику: единый вид списков во всех разделах
// (Что если, Моя игра, связанные и похожие на карточке техники, Разрыв).
// inset — для строк внутри карточек-секций (фон background вместо card).
export function TechniqueRow({
  technique,
  inset = false,
  right,
}: {
  technique: Technique;
  inset?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <Link
      to="/technique/$id"
      params={{ id: String(technique.id) }}
      className={`flex items-center justify-between gap-2 rounded-xl border border-border p-2.5 transition hover:bg-muted ${
        inset ? "bg-background" : "bg-card"
      }`}
      style={{ borderLeft: `3px solid var(--belt-${technique.belt})` }}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{technique.nameRu}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {GROUP_LABEL[technique.group]} · {BELT_LABEL[technique.belt]} · сложность {technique.difficulty}/5
        </span>
      </span>
      {right}
    </Link>
  );
}

// Чип техники: компактная ссылка с маркером пояса (дневник, сценарии, «Разрыв»).
// С onRemove — не ссылка, а элемент формы с крестиком (выбранные в дневнике).
const CHIP_CLS = "inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs transition";

export function TechniqueChip({ technique, onRemove }: { technique: Technique; onRemove?: () => void }) {
  const marker = { borderLeft: `3px solid var(--belt-${technique.belt})` };
  if (onRemove) {
    return (
      <span className={CHIP_CLS} style={marker}>
        {technique.nameRu}
        <button type="button" onClick={onRemove} aria-label="Убрать">
          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </button>
      </span>
    );
  }
  return (
    <Link
      to="/technique/$id"
      params={{ id: String(technique.id) }}
      className={`${CHIP_CLS} hover:bg-muted`}
      style={marker}
    >
      {technique.nameRu}
    </Link>
  );
}

export function TechniqueCard({
  technique,
  status = "not_started",
  onCycleStatus,
}: {
  technique: Technique;
  status?: ProgressStatus;
  onCycleStatus?: (id: number) => void;
}) {
  const Icon = STATUS_ICON[status];
  return (
    <article
      className="rounded-xl border border-border bg-card p-3 shadow-sm"
      style={{ borderLeft: `4px solid var(--belt-${technique.belt})` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-card-foreground">
            {technique.nameRu}
          </h3>
          <p className="truncate text-xs text-muted-foreground">{technique.nameEn}</p>
        </div>
        {onCycleStatus && (
          <button
            type="button"
            aria-label={`Статус: ${STATUS_LABEL[status]}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCycleStatus(technique.id);
            }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2"
            style={{ borderColor: STATUS_COLOR[status], color: STATUS_COLOR[status] }}
          >
            <Icon className="h-4 w-4" strokeWidth={2.4} />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <Badge>{GROUP_LABEL[technique.group]}</Badge>
        <Badge>{BELT_LABEL[technique.belt]}</Badge>
        {technique.gi && <Badge>Gi</Badge>}
        {technique.noGi && <Badge>No-Gi</Badge>}
        <Badge>Сложность {technique.difficulty}/5</Badge>
      </div>
    </article>
  );
}

