import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Link } from "@tanstack/react-router";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { useProgress, useProfile } from "@/lib/bjj/store";
import { nextToLearn, currentFocus } from "@/lib/bjj/recommend";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import { haptic } from "@/lib/telegram";
import type { Technique } from "@/lib/bjj/types";
import { layoutFlow } from "./flowLayout";
import { TechniqueNode } from "./TechniqueNode";
import { FlowEdges } from "./FlowEdges";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

const nodeTypes = { tech: TechniqueNode };

// Соседство техники: она сама + пререквизиты (сверху) + продолжения (снизу).
function neighborhood(focus: Technique): Technique[] {
  const ids = new Set<number>([focus.id]);
  for (const p of focus.prerequisites) ids.add(p);
  for (const c of focus.chain_to) ids.add(c);
  return [...ids].map((id) => TECH_BY_ID[id]).filter((t): t is Technique => Boolean(t));
}

export function TechniqueFlow() {
  const { profile } = useProfile();
  const { progress } = useProgress();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Стартовая техника фокуса: рекомендация → текущий фокус → первая по поясу
  const startId = useMemo(() => {
    const rec = nextToLearn(TECHNIQUES, progress, profile.belt, 1)[0] ?? currentFocus(TECHNIQUES, progress);
    if (rec) return rec.id;
    const belt = TECHNIQUES.find((t) => t.belt === profile.belt);
    return (belt ?? TECHNIQUES[0]).id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.belt]);

  const [focusId, setFocusId] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const activeId = focusId ?? startId;
  const focus = TECH_BY_ID[activeId];

  const visible = useMemo(() => (focus ? neighborhood(focus) : []), [focus]);

  const [layoutData, setLayoutData] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    layoutFlow(visible).then((res) => {
      if (cancelled) return;
      setLayoutData(res);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Влить статус + выделение фокуса в data (без пересчёта ELK)
  useEffect(() => {
    setRfNodes(
      layoutData.nodes.map((n) => ({
        ...n,
        selected: Number(n.id) === activeId,
        data: { ...n.data, status: progress[Number(n.id)] ?? "not_started" },
      })),
    );
  }, [layoutData.nodes, progress, activeId, setRfNodes]);

  const goTo = (id: number) => {
    if (id === activeId) return;
    haptic("light");
    setHistory((h) => [...h, activeId]);
    setFocusId(id);
  };
  const goBack = () => {
    haptic("light");
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (prev == null) return h;
      setFocusId(prev);
      return h.slice(0, -1);
    });
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 200px)", minHeight: 400 }}>
      {/* Панель фокуса */}
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={goBack}
          disabled={history.length === 0}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-muted disabled:opacity-40"
          aria-label="Назад"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
          {profile.belt && <span>{BELT_LABEL[profile.belt]} · </span>}
          Нажми узел — центрируется на нём
        </span>
      </div>

      {/* Граф-соседство */}
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-border" style={{ background: "var(--color-background)" }}>
        {(loading || !mounted) && (
          <div className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">Строю…</div>
        )}
        {mounted && (
          <ReactFlow
            nodes={rfNodes}
            edges={[]}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
            minZoom={0.4}
            maxZoom={1.6}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            onNodeClick={(_, n) => goTo(Number(n.id))}
          >
            <FlowEdges edges={layoutData.edges} />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--color-border)" />
            <Controls showInteractive={false} position="top-right" />
          </ReactFlow>
        )}
      </div>

      {/* Шторка выбранной техники */}
      {focus && (
        <div className="mt-2 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{focus.nameRu}</p>
              <p className="text-[12px] text-muted-foreground">
                {GROUP_LABEL[focus.group]} · {BELT_LABEL[focus.belt]} · сложность {focus.difficulty}/5
              </p>
            </div>
            <Link
              to="/technique/$id"
              params={{ id: String(focus.id) }}
              onClick={() => haptic("light")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground"
            >
              Открыть <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
