import { useMemo } from "react";
import { useNodes, useViewport } from "@xyflow/react";
import { NODE_W, NODE_H } from "./flowLayout";
import type { Belt } from "@/lib/bjj/types";

interface EdgeLite {
  id: string;
  source: string;
  target: string;
}

// Цвет связи по поясу техники, к которой она ведёт. Белый пояс — серый (сам свотч
// --belt-white почти белый и на карте невидим), остальные — цвет пояса.
const EDGE_BELT_COLOR: Record<Belt, string> = {
  white: "var(--color-muted-foreground)",
  blue: "var(--belt-blue)",
  purple: "var(--belt-purple)",
  brown: "var(--belt-brown)",
  black: "var(--belt-black)",
};

// Свой слой рёбер поверх React Flow: измерение узлов/хендлов в нашем стеке не работает,
// поэтому рисуем кривые сами по координатам ELK. Связь красится цветом пояса соседа
// (не фокусной техники), связи вне фокуса — полупрозрачные. Пути мемоизированы;
// вьюпорт двигает только <g>. Стрелка наследует цвет линии через fill="context-stroke".
export function FlowEdges({
  edges,
  focusId,
}: {
  edges: EdgeLite[];
  focusId?: string;
}) {
  const nodes = useNodes();
  const { x, y, zoom } = useViewport();
  const gray = "var(--color-muted-foreground)";

  const paths = useMemo(() => {
    const pos = new Map(nodes.map((n) => [n.id, n.position]));
    const beltOf = new Map(
      nodes.map((n) => [n.id, (n.data as { tech?: { belt?: Belt } })?.tech?.belt]),
    );
    const out: React.ReactNode[] = [];
    for (const e of edges) {
      const s = pos.get(e.source);
      const t = pos.get(e.target);
      if (!s || !t) continue;
      const sx = s.x + NODE_W / 2;
      const sy = s.y + NODE_H;
      const tx = t.x + NODE_W / 2;
      const ty = t.y;
      const my = (sy + ty) / 2;
      const d = `M ${sx} ${sy} C ${sx} ${my}, ${tx} ${my}, ${tx} ${ty}`;
      const isFocus = focusId != null && (e.source === focusId || e.target === focusId);
      // Пояс соседа: конец связи, который не является фокусом (иначе — целевой узел).
      const otherId = focusId != null && e.source === focusId ? e.target : e.source;
      const belt = beltOf.get(otherId) ?? beltOf.get(e.target);
      const stroke = belt ? EDGE_BELT_COLOR[belt] : gray;
      out.push(
        <path
          key={e.id}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={isFocus ? 2 : 1.3}
          strokeOpacity={isFocus ? 0.95 : 0.25}
          markerEnd="url(#rf-arrow)"
        />,
      );
    }
    return out;
  }, [nodes, edges, focusId]);

  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 0 }}
    >
      <defs>
        <marker id="rf-arrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="context-stroke" />
        </marker>
      </defs>
      <g transform={`translate(${x} ${y}) scale(${zoom})`}>{paths}</g>
    </svg>
  );
}
