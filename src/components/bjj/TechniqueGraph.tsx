import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Network, type Data, type Options } from "vis-network";
import { DataSet } from "vis-data";
import { Link } from "@tanstack/react-router";
import { X, Focus, Layers } from "lucide-react";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { BELT_ORDER, BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import type { ProgressMap } from "@/lib/bjj/store";
import type { Belt, StyleProfile, Technique } from "@/lib/bjj/types";

// === TECHNIQUE GRAPH — "Structured constellation" + focus mode ===

const BELT_HEX: Record<Belt, string> = {
  white: "#e8e6df",
  blue: "#4c8bf5",
  purple: "#a855f7",
  brown: "#8a5a2b",
  black: "#1a1a20",
};

const STATUS_DONE = "#34d399";
const STATUS_PROGRESS = "#fbbf24";
const NODE_BG = "#0f1013";
const DIM_BG = "#0b0c0f";
const DIM_BORDER = "rgba(120,120,130,0.18)";
const EDGE_PREREQ = "rgba(148,163,184,0.22)";
const EDGE_CHAIN = "rgba(96,165,250,0.35)";
const EDGE_SETUP = "rgba(192,132,252,0.32)";
const EDGE_DIM = "rgba(80,85,100,0.06)";
const EDGE_HL_PREREQ = "rgba(148,163,184,0.95)";
const EDGE_HL_CHAIN = "rgba(96,165,250,1)";
const EDGE_HL_SETUP = "rgba(192,132,252,1)";

type FilterMode = "all" | "myBelt" | "mastered" | "available";
type Hops = 1 | 2;

type NodeItem = {
  id: number;
  label: string;
  title: string;
  shape: "dot";
  size: number;
  borderWidth: number;
  color: {
    background: string;
    border: string;
    highlight: { background: string; border: string };
    hover: { background: string; border: string };
  };
  hidden?: boolean;
};

type EdgeItem = {
  id: string;
  from: number;
  to: number;
  kind: "prereq" | "chain" | "setup";
  color: { color: string; highlight: string; hover: string };
  arrows?: { to: { enabled: boolean; scaleFactor: number } };
  dashes?: boolean;
  width: number;
  hidden?: boolean;
};

// Build adjacency once (undirected, all edge kinds).
function buildAdjacency() {
  const adj = new Map<number, Set<number>>();
  const add = (a: number, b: number) => {
    if (!TECH_BY_ID[a] || !TECH_BY_ID[b]) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const t of TECHNIQUES) {
    for (const p of t.prerequisites) add(t.id, p);
    for (const c of t.chain_to) add(t.id, c);
    for (const s of t.common_setups) add(t.id, s);
  }
  return adj;
}

function beltIdx(b: Belt) {
  return BELT_ORDER.indexOf(b);
}

function nodeColorFor(t: Technique, status: string) {
  const belt = BELT_HEX[t.belt];
  if (status === "done") return { bg: STATUS_DONE, border: STATUS_DONE };
  if (status === "in_progress") return { bg: STATUS_PROGRESS, border: STATUS_PROGRESS };
  return { bg: NODE_BG, border: belt };
}

export function TechniqueGraph({
  progress,
  profile,
}: {
  progress: ProgressMap;
  profile: StyleProfile;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const netRef = useRef<Network | null>(null);
  const nodesDSRef = useRef<DataSet<NodeItem> | null>(null);
  const edgesDSRef = useRef<DataSet<EdgeItem> | null>(null);

  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [hops, setHops] = useState<Hops>(1);
  const [filter, setFilter] = useState<FilterMode>("all");

  const adjacency = useMemo(() => buildAdjacency(), []);

  // Compute base "matches filter" set (before focus is applied).
  const matches = useMemo(() => {
    const set = new Set<number>();
    const myIdx = beltIdx(profile.belt);
    for (const t of TECHNIQUES) {
      const s = progress[t.id] ?? "not_started";
      if (filter === "myBelt") {
        if (beltIdx(t.belt) <= myIdx) set.add(t.id);
      } else if (filter === "mastered") {
        if (s === "done") set.add(t.id);
      } else if (filter === "available") {
        if (beltIdx(t.belt) > myIdx) continue;
        const allDone =
          t.prerequisites.length === 0 ||
          t.prerequisites.every((p) => (progress[p] ?? "not_started") === "done");
        if (allDone && s !== "done") set.add(t.id);
      } else {
        set.add(t.id);
      }
    }
    return set;
  }, [filter, progress, profile.belt]);

  // Focus neighborhood via BFS on undirected adjacency.
  const focusSet = useMemo(() => {
    if (focusedId == null) return null;
    const visited = new Map<number, number>();
    visited.set(focusedId, 0);
    const queue: number[] = [focusedId];
    while (queue.length) {
      const cur = queue.shift()!;
      const d = visited.get(cur)!;
      if (d >= hops) continue;
      for (const nb of adjacency.get(cur) ?? []) {
        if (!visited.has(nb)) {
          visited.set(nb, d + 1);
          queue.push(nb);
        }
      }
    }
    return new Set(visited.keys());
  }, [focusedId, hops, adjacency]);

  const visibleIds = useMemo(() => {
    if (!focusSet) return matches;
    const out = new Set<number>();
    for (const id of focusSet) if (matches.has(id) || id === focusedId) out.add(id);
    return out;
  }, [focusSet, matches, focusedId]);

  const stats = useMemo(() => {
    const total = TECHNIQUES.length;
    let done = 0;
    let inProgress = 0;
    for (const t of TECHNIQUES) {
      const s = progress[t.id];
      if (s === "done") done++;
      else if (s === "in_progress") inProgress++;
    }
    return { total, done, inProgress, visible: visibleIds.size, pct: Math.round((done / total) * 100) };
  }, [progress, visibleIds.size]);

  // Build network once, or rebuild when progress changes (colors change).
  useEffect(() => {
    if (!ref.current) return;

    const nodes: NodeItem[] = TECHNIQUES.map((t) => {
      const status = progress[t.id] ?? "not_started";
      const { bg, border } = nodeColorFor(t, status);
      const size = 6 + t.difficulty * 1.8;
      return {
        id: t.id,
        label: "",
        title: `${t.nameRu} · ${BELT_LABEL[t.belt]}`,
        shape: "dot",
        size,
        borderWidth: 2,
        color: {
          background: bg,
          border,
          highlight: { background: bg, border: "#ffffff" },
          hover: { background: bg, border: "#ffffff" },
        },
      };
    });

    const arrow = { to: { enabled: true, scaleFactor: 0.35 } };
    const edges: EdgeItem[] = [];
    for (const t of TECHNIQUES) {
      for (const p of t.prerequisites)
        if (TECH_BY_ID[p])
          edges.push({
            id: `p-${p}-${t.id}`,
            from: p,
            to: t.id,
            kind: "prereq",
            arrows: arrow,
            color: { color: EDGE_PREREQ, highlight: EDGE_HL_PREREQ, hover: EDGE_HL_PREREQ },
            width: 0.6,
          });
      for (const c of t.chain_to)
        if (TECH_BY_ID[c])
          edges.push({
            id: `c-${t.id}-${c}`,
            from: t.id,
            to: c,
            kind: "chain",
            arrows: arrow,
            color: { color: EDGE_CHAIN, highlight: EDGE_HL_CHAIN, hover: EDGE_HL_CHAIN },
            width: 0.8,
          });
      for (const s of t.common_setups)
        if (TECH_BY_ID[s])
          edges.push({
            id: `s-${t.id}-${s}`,
            from: t.id,
            to: s,
            kind: "setup",
            color: { color: EDGE_SETUP, highlight: EDGE_HL_SETUP, hover: EDGE_HL_SETUP },
            dashes: true,
            width: 0.6,
          });
    }

    const nodesDS = new DataSet<NodeItem>(nodes);
    const edgesDS = new DataSet<EdgeItem>(edges);
    nodesDSRef.current = nodesDS;
    edgesDSRef.current = edgesDS;

    const data: Data = { nodes: nodesDS as unknown as Data["nodes"], edges: edgesDS as unknown as Data["edges"] };
    const options: Options = {
      autoResize: true,
      physics: {
        stabilization: { iterations: 220, fit: true },
        barnesHut: {
          gravitationalConstant: -4500,
          springLength: 140,
          springConstant: 0.02,
          damping: 0.35,
          avoidOverlap: 0.4,
        },
      },
      interaction: { hover: true, tooltipDelay: 120, hideEdgesOnDrag: true },
      edges: { smooth: { enabled: true, type: "continuous", roundness: 0.3 } },
    };

    const net = new Network(ref.current, data, options);
    netRef.current = net;

    net.on("click", (params: { nodes: number[] }) => {
      const id = params.nodes?.[0];
      if (id == null) setFocusedId(null);
      else setFocusedId(id);
    });

    return () => {
      net.destroy();
      netRef.current = null;
      nodesDSRef.current = null;
      edgesDSRef.current = null;
    };
  }, [progress]);

  // Apply visibility (filter + focus) without rebuilding the network.
  useEffect(() => {
    const nodesDS = nodesDSRef.current;
    const edgesDS = edgesDSRef.current;
    if (!nodesDS || !edgesDS) return;

    const isDimmed = focusSet !== null || filter !== "all";

    const nodeUpdates: Partial<NodeItem>[] = TECHNIQUES.map((t) => {
      const status = progress[t.id] ?? "not_started";
      const { bg, border } = nodeColorFor(t, status);
      const visible = visibleIds.has(t.id) || t.id === focusedId;
      if (!isDimmed) {
        return {
          id: t.id,
          color: {
            background: bg,
            border,
            highlight: { background: bg, border: "#ffffff" },
            hover: { background: bg, border: "#ffffff" },
          },
        } as Partial<NodeItem>;
      }
      if (visible) {
        return {
          id: t.id,
          color: {
            background: bg,
            border: t.id === focusedId ? "#ffffff" : border,
            highlight: { background: bg, border: "#ffffff" },
            hover: { background: bg, border: "#ffffff" },
          },
        } as Partial<NodeItem>;
      }
      return {
        id: t.id,
        color: {
          background: DIM_BG,
          border: DIM_BORDER,
          highlight: { background: DIM_BG, border: DIM_BORDER },
          hover: { background: DIM_BG, border: DIM_BORDER },
        },
      } as Partial<NodeItem>;
    });
    nodesDS.update(nodeUpdates as NodeItem[]);

    const edgeUpdates: Partial<EdgeItem>[] = edgesDS.get().map((e) => {
      const bothVisible = visibleIds.has(e.from) && visibleIds.has(e.to);
      const bothOrFocused =
        bothVisible ||
        (focusedId != null && (e.from === focusedId || e.to === focusedId) && (visibleIds.has(e.from) || visibleIds.has(e.to)));
      if (!isDimmed || bothOrFocused) {
        const base =
          e.kind === "prereq" ? EDGE_PREREQ : e.kind === "chain" ? EDGE_CHAIN : EDGE_SETUP;
        const hl =
          e.kind === "prereq" ? EDGE_HL_PREREQ : e.kind === "chain" ? EDGE_HL_CHAIN : EDGE_HL_SETUP;
        const strong = focusedId != null && (e.from === focusedId || e.to === focusedId);
        return {
          id: e.id,
          color: { color: strong ? hl : base, highlight: hl, hover: hl },
          width: strong ? e.width * 2 : e.width,
        } as Partial<EdgeItem>;
      }
      return {
        id: e.id,
        color: { color: EDGE_DIM, highlight: EDGE_DIM, hover: EDGE_DIM },
        width: 0.3,
      } as Partial<EdgeItem>;
    });
    edgesDS.update(edgeUpdates as EdgeItem[]);

    // Recenter on focus change.
    if (focusedId != null && netRef.current) {
      const nb = Array.from(focusSet ?? [focusedId]);
      netRef.current.focus(focusedId, {
        scale: 1.1,
        animation: { duration: 500, easingFunction: "easeInOutQuad" },
      });
      void nb;
    }
  }, [visibleIds, focusSet, focusedId, filter, progress]);

  const fit = useCallback(() => {
    netRef.current?.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
  }, []);

  const clearFocus = useCallback(() => setFocusedId(null), []);

  const focusedTech = focusedId != null ? TECH_BY_ID[focusedId] : null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0b0e] shadow-2xl">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-white/5 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Карта техник</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {stats.visible}/{stats.total} · {stats.done} изучено · {stats.inProgress} в процессе
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {focusedId != null && (
            <button
              onClick={() => setHops(hops === 1 ? 2 : 1)}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-white/10"
              title="Глубина фокуса"
            >
              <Layers className="h-3 w-3" />
              {hops} hop{hops === 2 ? "s" : ""}
            </button>
          )}
          <button
            onClick={fit}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-white/10"
          >
            По центру
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5 border-b border-white/5 px-5 py-3">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          Все
        </Chip>
        <Chip active={filter === "myBelt"} onClick={() => setFilter("myBelt")}>
          Мой пояс ({BELT_LABEL[profile.belt]})
        </Chip>
        <Chip active={filter === "mastered"} onClick={() => setFilter("mastered")}>
          Освоенные
        </Chip>
        <Chip active={filter === "available"} onClick={() => setFilter("available")}>
          Доступные сейчас
        </Chip>
      </div>

      {/* Canvas + cluster glows */}
      <div className="relative h-[520px] w-full bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:22px_22px]">
        <div className="pointer-events-none absolute -top-10 right-10 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-500/[0.06] blur-3xl" />

        <div ref={ref} className="absolute inset-0" />

        {/* Focus hint */}
        {focusedId == null && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] text-zinc-400 backdrop-blur">
            <Focus className="mr-1 inline h-3 w-3" />
            Нажмите на узел, чтобы включить фокус
          </div>
        )}
      </div>

      {/* Side panel — details of focused technique */}
      {focusedTech && (
        <FocusPanel tech={focusedTech} progress={progress} onClose={clearFocus} />
      )}

      {/* Legend */}
      <div className="space-y-3 border-t border-white/5 px-5 py-4">
        <div className="flex flex-wrap gap-3">
          {(["white", "blue", "purple", "brown", "black"] as Belt[]).map((b) => (
            <div key={b} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full ring-1 ring-white/10"
                style={{ background: BELT_HEX[b] }}
              />
              <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                {b}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500">
          <LegendEdge color={EDGE_HL_PREREQ} label="Пререквизит" />
          <LegendEdge color={EDGE_HL_CHAIN} label="Продолжение" />
          <LegendEdge color={EDGE_HL_SETUP} label="Сетап" dashed />
          <LegendDot color={STATUS_DONE} label="Изучено" />
          <LegendDot color={STATUS_PROGRESS} label="В процессе" />
        </div>
      </div>
    </div>
  );
}

function FocusPanel({
  tech,
  progress,
  onClose,
}: {
  tech: Technique;
  progress: ProgressMap;
  onClose: () => void;
}) {
  const status = progress[tech.id] ?? "not_started";
  const resolve = (ids: number[]) =>
    ids
      .map((i) => TECH_BY_ID[i])
      .filter((x): x is Technique => Boolean(x))
      .slice(0, 6);
  const prereqs = resolve(tech.prerequisites);
  const chains = resolve(tech.chain_to);
  const setups = resolve(tech.common_setups);

  return (
    <div className="border-t border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/10"
              style={{ background: BELT_HEX[tech.belt] }}
            />
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
              {GROUP_LABEL[tech.group]} · {BELT_LABEL[tech.belt]}
            </span>
          </div>
          <h3 className="mt-1 truncate text-base font-semibold text-zinc-100">{tech.nameRu}</h3>
          <p className="truncate text-[11px] text-zinc-500">{tech.nameEn}</p>
        </div>
        <button
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
          aria-label="Снять фокус"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
        <MetaChip>Сложность {tech.difficulty}/5</MetaChip>
        {tech.gi && <MetaChip>Gi</MetaChip>}
        {tech.noGi && <MetaChip>No-Gi</MetaChip>}
        {tech.legal_ibjjf_gi && <MetaChip>IBJJF</MetaChip>}
        {tech.legal_adcc && <MetaChip>ADCC</MetaChip>}
        <MetaChip>
          {status === "done" ? "Изучено" : status === "in_progress" ? "В процессе" : "Не начато"}
        </MetaChip>
      </div>

      {(prereqs.length > 0 || chains.length > 0 || setups.length > 0) && (
        <div className="mt-3 grid grid-cols-1 gap-2 text-[11px]">
          {prereqs.length > 0 && <MiniRow label="Пререквизиты" items={prereqs} tone="slate" />}
          {chains.length > 0 && <MiniRow label="Продолжения" items={chains} tone="blue" />}
          {setups.length > 0 && <MiniRow label="Сетапы" items={setups} tone="purple" />}
        </div>
      )}

      <Link
        to="/technique/$id"
        params={{ id: String(tech.id) }}
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:bg-white/15"
      >
        Открыть детали техники
      </Link>
    </div>
  );
}

function MiniRow({
  label,
  items,
  tone,
}: {
  label: string;
  items: Technique[];
  tone: "slate" | "blue" | "purple";
}) {
  const dotColor = tone === "blue" ? EDGE_HL_CHAIN : tone === "purple" ? EDGE_HL_SETUP : EDGE_HL_PREREQ;
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
        <span className="inline-block h-[2px] w-3" style={{ background: dotColor }} />
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((t) => (
          <Link
            key={t.id}
            to="/technique/$id"
            params={{ id: String(t.id) }}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/10"
          >
            {t.nameRu}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition " +
        (active
          ? "border-white/40 bg-white/15 text-white"
          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200")
      }
    >
      {children}
    </button>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-400">
      {children}
    </span>
  );
}

function LegendEdge({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block h-[2px] w-6"
        style={{
          background: dashed
            ? `repeating-linear-gradient(to right, ${color} 0 3px, transparent 3px 6px)`
            : color,
        }}
      />
      <span>{label}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
