import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { TechNodeData } from "./flowLayout";
import type { Group, ProgressStatus } from "@/lib/bjj/types";
import { GROUP_LABEL } from "@/lib/bjj/constants";
import { haptic } from "@/lib/telegram";

// Цвет группы — второй канал кодировки (первый — пояс через обводку).
export const GROUP_COLOR: Record<Group, string> = {
  fundamentals: "#888780",
  position: "#1d9e75",
  submission: "#d85a30",
  sweep: "#ba7517",
  guard_pass: "#378add",
  takedown: "#7f77dd",
  transition: "#d4537e",
  system: "#534ab7",
  escape: "#639922",
  retention: "#0f6e56",
};

const STATUS_FILL: Record<ProgressStatus, string> = {
  done: "var(--status-done)",
  in_progress: "var(--status-progress)",
  not_started: "var(--status-idle)",
};
const STATUS_LABEL: Record<ProgressStatus, string> = {
  done: "Изучено",
  in_progress: "В процессе",
  not_started: "Не начато",
};

export type TechNode = Node<TechNodeData & { status?: ProgressStatus; dimmed?: boolean }, "tech">;

// Подпись зоны раскладки («Откуда попадаешь», «Сабмишены: финиш»...)
export function ZoneLabelNode({ data }: NodeProps<Node<{ text: string }, "zone">>) {
  return (
    <div
      style={{
        width: 156,
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--color-muted-foreground)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {data.text}
    </div>
  );
}

export function TechniqueNode({ data, selected }: NodeProps<TechNode>) {
  const t = data.tech;
  const status = (data.status ?? "not_started") as ProgressStatus;
  const gc = GROUP_COLOR[t.group];

  return (
    <div
      style={{
        width: 156,
        minHeight: 64,
        opacity: data.dimmed ? 0.4 : 1,
        borderLeft: `4px solid var(--belt-${t.belt})`,
        borderTop: "1px solid var(--color-border)",
        borderRight: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
        borderRadius: 12,
        background: "var(--color-card)",
        padding: "7px 9px",
        boxShadow: selected
          ? "0 0 0 2px var(--color-primary), 0 0 0 6px color-mix(in oklch, var(--color-primary) 18%, transparent)"
          : "0 1px 3px rgba(0,0,0,0.12)",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-muted-foreground)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: gc, flex: "none" }} />
        <span style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}>{GROUP_LABEL[t.group]}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.2, margin: "3px 0", color: "var(--color-foreground)" }}>
        {t.nameRu}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-muted-foreground)" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_FILL[status], flex: "none" }} />
        {STATUS_LABEL[status]} · {t.difficulty}/5
      </div>
      {/* Кнопка «Открыть» появляется на самой карточке, когда техника в фокусе */}
      {selected && (
        <Link
          to="/technique/$id"
          params={{ id: String(t.id) }}
          onClick={(e) => { e.stopPropagation(); haptic("light"); }}
          className="nodrag"
          style={{
            marginTop: 7,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            borderRadius: 8,
            background: "var(--color-primary)",
            color: "var(--color-primary-foreground)",
            fontSize: 12,
            fontWeight: 500,
            padding: "5px 9px",
            width: "100%",
            justifyContent: "center",
          }}
        >
          Открыть <ArrowUpRight style={{ width: 13, height: 13 }} />
        </Link>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
}
