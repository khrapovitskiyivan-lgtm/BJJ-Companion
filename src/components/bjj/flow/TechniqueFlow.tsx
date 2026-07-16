import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { useProgress, useProfile } from "@/lib/bjj/store";
import { nextToLearn, currentFocus } from "@/lib/bjj/recommend";
import { GROUP_LABEL } from "@/lib/bjj/constants";
import { haptic } from "@/lib/telegram";
import type { Technique } from "@/lib/bjj/types";
import { layoutFlow } from "./flowLayout";
import { TechniqueNode } from "./TechniqueNode";
import { FlowEdges } from "./FlowEdges";
import { ArrowLeft, Search, Crosshair, X } from "lucide-react";

const nodeTypes = { tech: TechniqueNode };

// Соседство техники: она сама + пререквизиты (сверху) + продолжения (снизу).
function neighborhood(focus: Technique): Technique[] {
  const ids = new Set<number>([focus.id]);
  for (const p of focus.prerequisites) ids.add(p);
  for (const c of focus.chain_to) ids.add(c);
  return [...ids].map((id) => TECH_BY_ID[id]).filter((t): t is Technique => Boolean(t));
}

// Кнопка центрирования графа (единственный контрол вместо стоковых +/-/fit).
function FitButton() {
  const rf = useReactFlow();
  return (
    <button
      type="button"
      onClick={() => rf.fitView({ padding: 0.22, maxZoom: 1.1, duration: 300 })}
      className="absolute bottom-3 right-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition hover:bg-muted"
      aria-label="Центрировать"
    >
      <Crosshair className="h-4 w-4" />
    </button>
  );
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
  // Версия раскладки: растёт при каждой новой ELK-раскладке. По ней ремонтим ReactFlow,
  // чтобы fitView (проп) центрировал СВЕЖИЕ узлы. Меняется только при смене фокуса, не статуса.
  const [layoutVersion, setLayoutVersion] = useState(0);

  // Поиск техники — прыжок фокуса на любую технику базы.
  const [query, setQuery] = useState("");
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return TECHNIQUES.filter(
      (t) =>
        t.id !== activeId &&
        (t.nameRu.toLowerCase().includes(q) ||
          t.nameEn.toLowerCase().includes(q) ||
          t.label.toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [query, activeId]);

  // Адаптивная высота графа под экран телефона: от низа панели до нижней навигации.
  // BELOW_GRAPH — то, что идёт ниже графа в AppShell: main py-4 (16px) + root pb-20 (80px)
  // под фиксированную нижнюю навигацию. Без этого страница скроллится, а карта «больше телефона».
  const BELOW_GRAPH = 96;
  const graphRef = useRef<HTMLDivElement>(null);
  const [graphH, setGraphH] = useState(0);
  useLayoutEffect(() => {
    const compute = () => {
      const el = graphRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setGraphH(Math.max(320, window.innerHeight - top - BELOW_GRAPH));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [mounted]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    layoutFlow(visible).then((res) => {
      if (cancelled) return;
      setLayoutData(res);
      setLayoutVersion((v) => v + 1);
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
    <div className="flex flex-col">
      {/* Панель: назад + поиск техники */}
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={goBack}
          disabled={history.length === 0}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-muted disabled:opacity-40"
          aria-label="Назад"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти технику на карте…"
            className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-9 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="Очистить"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {searchResults.length > 0 && (
            <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
              {searchResults.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { goTo(t.id); setQuery(""); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--belt-${t.belt})` }} />
                  <span className="min-w-0 flex-1 truncate">{t.nameRu}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{GROUP_LABEL[t.group]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Граф-соседство */}
      <div
        ref={graphRef}
        className="relative overflow-hidden rounded-2xl border border-border"
        style={{ height: graphH || 400, background: "var(--color-background)" }}
      >
        {(loading || !mounted) && (
          <div className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">Строю…</div>
        )}
        {mounted && (
          <ReactFlow
            key={layoutVersion}
            nodes={rfNodes}
            edges={[]}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.22, maxZoom: 1.1 }}
            minZoom={0.4}
            maxZoom={1.6}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            onNodeClick={(_, n) => goTo(Number(n.id))}
          >
            <FlowEdges edges={layoutData.edges} focusId={String(activeId)} />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--color-border)" />
            <FitButton />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
