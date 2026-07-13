import { useMemo } from "react";
import { useNodes, useViewport } from "@xyflow/react";
import { NODE_W, NODE_H } from "./flowLayout";

interface EdgeLite {
  id: string;
  source: string;
  target: string;
}

// Свой слой рёбер поверх React Flow: измерение узлов/хендлов в нашем стеке не работает,
// поэтому рисуем кривые сами по координатам ELK. Пути зависят только от координат узлов —
// мемоизируем их; трансформ вьюпорта (пан/зум) двигает только <g>, пути не пересчитываются.
// pointer-events:none — клики по узлам живут.
export function FlowEdges({ edges }: { edges: EdgeLite[] }) {
  const nodes = useNodes();
  const { x, y, zoom } = useViewport();

  const paths = useMemo(() => {
    const pos = new Map(nodes.map((n) => [n.id, n.position]));
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
      out.push(
        <path
          key={e.id}
          d={d}
          fill="none"
          stroke="var(--color-muted-foreground)"
          strokeWidth={1.4}
          strokeOpacity={0.5}
          markerEnd="url(#rf-arrow)"
        />,
      );
    }
    return out;
  }, [nodes, edges]);

  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 0 }}
    >
      <defs>
        <marker id="rf-arrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="var(--color-muted-foreground)" />
        </marker>
      </defs>
      <g transform={`translate(${x} ${y}) scale(${zoom})`}>{paths}</g>
    </svg>
  );
}
