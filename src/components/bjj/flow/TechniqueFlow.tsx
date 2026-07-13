import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "@tanstack/react-router";
import { TECHNIQUES } from "@/lib/bjj/data";
import { useProgress, useProfile } from "@/lib/bjj/store";
import { BELT_ORDER, BELT_LABEL } from "@/lib/bjj/constants";
import { haptic } from "@/lib/telegram";
import type { Belt } from "@/lib/bjj/types";
import { layoutFlow } from "./flowLayout";
import { TechniqueNode } from "./TechniqueNode";

const nodeTypes = { tech: TechniqueNode };
const beltIdx = (b: Belt) => BELT_ORDER.indexOf(b);

export function TechniqueFlow() {
  const { profile } = useProfile();
  const { progress } = useProgress();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  // React Flow — только на клиенте (SSR ломает измерение узлов/хендлов → рёбра не рисуются)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Progressive disclosure: свой пояс + следующий (или все пояса по кнопке)
  const visible = useMemo(() => {
    if (showAll) return TECHNIQUES;
    const ui = beltIdx(profile.belt);
    return TECHNIQUES.filter((t) => {
      const bi = beltIdx(t.belt);
      return bi === ui || bi === ui + 1;
    });
  }, [showAll, profile.belt]);

  // ELK-раскладка (async) при смене окна пояса
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    layoutFlow(visible).then((res) => {
      if (cancelled) return;
      setNodes(
        res.nodes.map((n) => ({ ...n, data: { ...n.data, status: progress[Number(n.id)] ?? "not_started" } })),
      );
      setEdges(res.edges);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, setNodes, setEdges]);

  // Обновление статуса без пересчёта раскладки
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: progress[Number(n.id)] ?? "not_started" } })));
  }, [progress, setNodes]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 190px)", minHeight: 380 }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] font-medium">
          <span className="h-3 w-3 rounded-sm ring-1 ring-black/15" style={{ background: `var(--belt-${profile.belt})` }} />
          {BELT_LABEL[profile.belt]} пояс
        </span>
        <button
          onClick={() => { haptic("light"); setShowAll((v) => !v); }}
          className="rounded-full border-2 px-3 py-1.5 text-[13px] font-medium transition-all"
          style={{
            borderColor: showAll ? "var(--color-primary)" : "var(--color-border)",
            background: showAll ? "color-mix(in oklch, var(--color-primary) 10%, transparent)" : "transparent",
          }}
        >
          {showAll ? "Мой уровень" : "Все пояса"}
        </button>
        <span className="ml-auto text-[12px] text-muted-foreground">{visible.length} техн.</span>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-2xl border border-border" style={{ background: "var(--color-background)" }}>
        {(loading || !mounted) && (
          <div className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">
            Раскладываю карту…
          </div>
        )}
        {mounted && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.25}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_, n) => { haptic("light"); navigate({ to: "/technique/$id", params: { id: n.id } }); }}
          defaultEdgeOptions={{ style: { stroke: "var(--color-muted-foreground)", strokeWidth: 1.4 } }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--color-border)" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
        )}
      </div>
    </div>
  );
}
