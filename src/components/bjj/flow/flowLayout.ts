// Раскладка графа техник через ELK (layered DAG) для React Flow.
// Узлы — карточки фиксированного размера; рёбра — пререквизиты (prereq → техника).
// Циклы в prerequisites ELK разбивает сам (layered cycle-breaking); обратные рёбра
// помечаем kind:"back", чтобы рисовать их пунктиром.
import ELK from "elkjs/lib/elk.bundled.js";
import type { Node, Edge } from "@xyflow/react";
import type { Technique } from "@/lib/bjj/types";

const elk = new ELK();

export const NODE_W = 156;
export const NODE_H = 64;

export interface TechNodeData extends Record<string, unknown> {
  tech: Technique;
}

const LAYOUT_OPTS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": "26",
  "elk.layered.spacing.nodeNodeBetweenLayers": "56",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  "elk.layered.mergeEdges": "true",
};

// Построить positioned nodes+edges для набора видимых техник.
export async function layoutFlow(
  visible: Technique[],
): Promise<{ nodes: Node<TechNodeData>[]; edges: Edge[] }> {
  const visibleIds = new Set(visible.map((t) => t.id));

  // Рёбра иерархии: prereq → техника (выше) и техника → продолжение (ниже).
  // Только среди видимых, без дублей и самоссылок.
  const seen = new Set<string>();
  const rawEdges: { from: number; to: number }[] = [];
  const addEdge = (from: number, to: number) => {
    if (!visibleIds.has(from) || !visibleIds.has(to) || from === to) return;
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    rawEdges.push({ from, to });
  };
  for (const t of visible) {
    for (const p of t.prerequisites) addEdge(p, t.id);
    for (const c of t.chain_to) addEdge(t.id, c);
  }

  const elkGraph = {
    id: "root",
    layoutOptions: LAYOUT_OPTS,
    children: visible.map((t) => ({ id: String(t.id), width: NODE_W, height: NODE_H })),
    edges: rawEdges.map((e, i) => ({
      id: `e${i}`,
      sources: [String(e.from)],
      targets: [String(e.to)],
    })),
  };

  const res = await elk.layout(elkGraph);
  const pos = new Map<string, { x: number; y: number }>();
  for (const c of res.children ?? []) pos.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });

  // Фиксированный размер + measured — RF в нашем стеке не измеряет DOM надёжно, без measured
  // fitView не находит границ. Рёбра рисуем сами (FlowEdges), хендлы RF не нужны.
  const nodes: Node<TechNodeData>[] = visible.map((t) => ({
    id: String(t.id),
    type: "tech",
    position: pos.get(String(t.id)) ?? { x: 0, y: 0 },
    width: NODE_W,
    height: NODE_H,
    measured: { width: NODE_W, height: NODE_H },
    data: { tech: t },
  }));

  const edges: Edge[] = rawEdges.map((e, i) => ({
    id: `e${i}`,
    source: String(e.from),
    target: String(e.to),
  }));

  return { nodes, edges };
}
