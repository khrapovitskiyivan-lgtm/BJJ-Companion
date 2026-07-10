import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import { Link } from "@tanstack/react-router";
import { X, Search, Maximize2, Smartphone, ShieldAlert, Target, Flag, SlidersHorizontal, HelpCircle } from "lucide-react";
import { TECHNIQUES, TECH_BY_ID, contentFor } from "@/lib/bjj/data";
import { BELT_ORDER, BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import {
  computeLayout, pickOrientation, pickCols, beltLanes,
  type GraphLayout, type Orientation,
} from "@/lib/bjj/graphLayout";
import { readiness, currentFocus, nextToLearn, learningPath } from "@/lib/bjj/recommend";
import type { ProgressMap } from "@/lib/bjj/store";
import type { Belt, StyleProfile, Technique } from "@/lib/bjj/types";

// === TECHNIQUE GRAPH — иерархия по поясам, статичная раскладка, физика ВЫКЛ ===
// Портировано из проверенного прототипа (graph-hier). Кодировка: пояс = обводка,
// статус = заливка, размер = сложность, кольцо = готовность пререквизитов,
// пунктирное кольцо = риск травмы (линза безопасности).

type FocusDir = "both" | "up" | "down" | "path";
type BaseFilter = "all" | "myBelt" | "mastered" | "available";
type GiFilter = "all" | "gi" | "nogi";

interface EdgeItem {
  id: string;
  from: number;
  to: number;
  kind: "prereq" | "chain" | "setup";
  color?: { color: string; highlight: string; hover: string };
  width?: number;
  dashes?: boolean;
  arrows?: unknown;
}

// Палитры под темы приложения
const PALETTE = {
  dark: {
    canvasBg: "#0a0b0e",
    nodeBg: "#0f1013",
    edgeBase: "rgba(96,102,120,0.14)",
    edgeDim: "rgba(80,85,100,0.03)",
    edgeIn: "rgba(148,163,184,0.95)",
    edgeOut: "rgba(96,165,250,1)",
    bandEven: "rgba(255,255,255,0.022)",
    bandOdd: "rgba(255,255,255,0.006)",
    laneLabel: "#71717a",
    watermarkAlpha: 0.07,
    nodeBorder: "rgba(255,255,255,0.30)",
    label: "#c9c9d1",
    labelStroke: "#0a0b0e",
    focusRing: "#ffffff",
    belts: { white: "#e8e6df", blue: "#4c8bf5", purple: "#a855f7", brown: "#8a5a2b", black: "#3f3f46" } as Record<Belt, string>,
    done: "#34d399",
    prog: "#fbbf24",
    risk: "#ef4444",
    riskMed: "#f97316",
  },
  light: {
    canvasBg: "#f7f7f5",
    nodeBg: "#ffffff",
    edgeBase: "rgba(90,95,110,0.18)",
    edgeDim: "rgba(120,125,140,0.05)",
    edgeIn: "rgba(71,85,105,0.95)",
    edgeOut: "rgba(37,99,235,1)",
    bandEven: "rgba(0,0,0,0.028)",
    bandOdd: "rgba(0,0,0,0.008)",
    laneLabel: "#8a8a92",
    watermarkAlpha: 0.08,
    nodeBorder: "rgba(0,0,0,0.32)",
    label: "#3f3f46",
    labelStroke: "#f7f7f5",
    focusRing: "#111111",
    belts: { white: "#b8b6ac", blue: "#3b82f6", purple: "#9333ea", brown: "#92561f", black: "#27272a" } as Record<Belt, string>,
    done: "#10b981",
    prog: "#d97706",
    risk: "#dc2626",
    riskMed: "#ea580c",
  },
};
type Palette = (typeof PALETTE)["dark"];

function riskLevel(t: Technique): "critical" | "medium" | "low" {
  const r = contentFor(t, "ru")?.injuryRisk ?? "";
  if (/КРИТИЧНО/i.test(r)) return "critical";
  if (/Средний/i.test(r)) return "medium";
  return "low";
}

interface RenderData {
  status: "not_started" | "in_progress" | "done";
  dim: boolean;
  focused: boolean;
  hovered: boolean;
  showLabel: boolean;
  readyFrac: number; // готовность пререквизитов 0..1
  risk: "critical" | "medium" | "low";
}

export function TechniqueGraph({
  progress,
  profile,
}: {
  progress: ProgressMap;
  profile: StyleProfile;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const netRef = useRef<Network | null>(null);
  const nodesDSRef = useRef<DataSet<Record<string, unknown>> | null>(null);
  const edgesDSRef = useRef<DataSet<EdgeItem> | null>(null);
  const layoutRef = useRef<GraphLayout | null>(null);
  const renderRef = useRef<Map<number, RenderData>>(new Map());
  const hoveredIdRef = useRef<number | null>(null);
  const minScaleRef = useRef(0.1);
  const paramsRef = useRef<{ orientation: Orientation; cols: number }>({ orientation: "horizontal", cols: 3 });

  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [dir, setDir] = useState<FocusDir>("both");
  const [filter, setFilter] = useState<BaseFilter>("myBelt");
  const [giFilter, setGiFilter] = useState<GiFilter>("all");
  const [legalOnly, setLegalOnly] = useState(false);
  const [safetyLens, setSafetyLens] = useState(false);
  const [query, setQuery] = useState("");
  const [heroMode, setHeroMode] = useState(false);
  const [heroBelt, setHeroBelt] = useState<Belt>(profile.belt);
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const theme: Palette = profile.theme === "dark" ? PALETTE.dark : PALETTE.light;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const safetyLensRef = useRef(safetyLens);
  safetyLensRef.current = safetyLens;
  const heroModeRef = useRef(heroMode);
  heroModeRef.current = heroMode;
  const profileThemeRef = useRef(profile.theme);
  profileThemeRef.current = profile.theme;

  // --- рёбра (стабильны на всю жизнь графа) ---
  const edges = useMemo<EdgeItem[]>(() => {
    const out: EdgeItem[] = [];
    const arrow = { to: { enabled: true, scaleFactor: 0.35 } };
    for (const t of TECHNIQUES) {
      for (const p of t.prerequisites)
        if (TECH_BY_ID[p]) out.push({ id: `p${p}-${t.id}`, from: p, to: t.id, kind: "prereq", arrows: arrow });
      for (const c of t.chain_to)
        if (TECH_BY_ID[c]) out.push({ id: `c${t.id}-${c}`, from: t.id, to: c, kind: "chain", arrows: arrow });
      for (const s of t.common_setups)
        if (TECH_BY_ID[s]) out.push({ id: `s${t.id}-${s}`, from: t.id, to: s, kind: "setup", dashes: true });
    }
    return out;
  }, []);

  // --- поиск ---
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return TECHNIQUES.filter(
      (t) =>
        t.nameRu.toLowerCase().includes(q) ||
        t.nameEn.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  // --- рекомендации ---
  const focusTech = useMemo(() => currentFocus(TECHNIQUES, progress), [progress]);
  const recommendations = useMemo(
    () => nextToLearn(TECHNIQUES, progress, profile.belt, 4),
    [progress, profile.belt],
  );

  // --- фильтры ---
  const beltIdx = (b: Belt) => BELT_ORDER.indexOf(b);
  const matchesFilter = useCallback(
    (t: Technique): boolean => {
      const s = progress[t.id] ?? "not_started";
      if (giFilter === "gi" && !t.gi) return false;
      if (giFilter === "nogi" && !t.noGi) return false;
      if (legalOnly && !t.legal_ibjjf_gi && !t.legal_ibjjf_nogi) return false;
      if (filter === "myBelt") return beltIdx(t.belt) <= beltIdx(profile.belt);
      if (filter === "mastered") return s === "done";
      if (filter === "available") {
        if (beltIdx(t.belt) > beltIdx(profile.belt)) return false;
        return t.prerequisites.every((p) => progress[p] === "done") && s !== "done";
      }
      return true;
    },
    [filter, giFilter, legalOnly, progress, profile.belt],
  );

  // --- фокус: направленный + режим «путь» ---
  const focusSet = useMemo<Set<number> | null>(() => {
    if (focusedId == null) return null;
    const t = TECH_BY_ID[focusedId];
    if (!t) return null;
    if (dir === "path") return new Set(learningPath(t, progress).map((x) => x.id));
    const set = new Set<number>([focusedId]);
    for (const e of edges) {
      if (dir === "both") {
        if (e.from === focusedId) set.add(e.to);
        if (e.to === focusedId) set.add(e.from);
      } else if (dir === "up") {
        if (e.to === focusedId) set.add(e.from);
      } else if (dir === "down") {
        if (e.from === focusedId) set.add(e.to);
      }
    }
    return set;
  }, [focusedId, dir, edges, progress]);

  const rebuildLayout = useCallback((orientation: Orientation, cols: number) => {
    const nodesDS = nodesDSRef.current;
    const net = netRef.current;
    if (!nodesDS || !net) return;
    paramsRef.current = { orientation, cols };
    const layout = computeLayout(TECHNIQUES, orientation, cols);
    layoutRef.current = layout;
    nodesDS.update(
      TECHNIQUES.map((t) => {
        const p = layout.positions.get(t.id)!;
        return { id: t.id, x: p.x, y: p.y };
      }),
    );
    net.redraw();
    net.fit({ animation: false } as never);
    minScaleRef.current = net.getScale();
  }, []);

  // --- построение сети (один раз; обновления — без пересоздания) ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const w = el.offsetWidth || 800;
    const h = el.offsetHeight || 520;
    const orientation = pickOrientation(w, h);
    const cols = pickCols(orientation, w, h);
    paramsRef.current = { orientation, cols };
    const layout = computeLayout(TECHNIQUES, orientation, cols);
    layoutRef.current = layout;

    const render = renderRef.current;
    TECHNIQUES.forEach((t) => {
      render.set(t.id, {
        status: progress[t.id] ?? "not_started",
        dim: false,
        focused: false,
        hovered: false,
        showLabel: false,
        readyFrac: readiness(t, progress).frac,
        risk: riskLevel(t),
      });
    });

    const mkRenderer =
      (t: Technique) =>
      ({ ctx, x, y }: { ctx: CanvasRenderingContext2D; x: number; y: number }) => {
        const r = 7 + t.difficulty * 2.2;
        return {
          drawNode: () => {
            const d = renderRef.current.get(t.id);
            if (!d) return;
            const pal = themeRef.current;
            ctx.save();
            if (d.dim) ctx.globalAlpha = 0.14;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = d.status === "done" ? pal.done : d.status === "in_progress" ? pal.prog : pal.nodeBg;
            ctx.fill();
            // базовая контрастная обводка — чтобы узлы белого пояса были видны на светлом фоне
            ctx.lineWidth = 1;
            ctx.strokeStyle = pal.nodeBorder;
            ctx.stroke();
            // цветная обводка пояса
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = d.focused ? pal.focusRing : pal.belts[t.belt];
            ctx.stroke();
            if (d.status !== "done" && d.readyFrac > 0 && d.readyFrac < 1) {
              ctx.beginPath();
              ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * d.readyFrac);
              ctx.lineWidth = 2;
              ctx.strokeStyle = pal.prog;
              ctx.stroke();
            }
            if (safetyLensRef.current && d.risk !== "low") {
              ctx.beginPath();
              ctx.arc(x, y, r + (d.status !== "done" ? 7 : 4), 0, Math.PI * 2);
              ctx.lineWidth = 2;
              ctx.setLineDash(d.risk === "critical" ? [4, 3] : [2, 4]);
              ctx.strokeStyle = d.risk === "critical" ? pal.risk : pal.riskMed;
              ctx.stroke();
              ctx.setLineDash([]);
            }
            // подпись: только при наведении (или на выбранном узле). При зуме НЕ показываем —
            // иначе десятки подписей наслаиваются и сливаются.
            if (!d.dim && (d.hovered || d.focused)) {
              const scale = netRef.current?.getScale() ?? 1;
              const text = t.label.length > 22 ? t.label.slice(0, 21) + "…" : t.label;
              ctx.font = `600 ${Math.max(11, 13 / Math.min(Math.max(scale, 0.6), 1.6))}px Manrope, sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.lineWidth = 3.5;
              ctx.strokeStyle = pal.labelStroke;
              ctx.strokeText(text, x, y + r + 5);
              ctx.fillStyle = pal.label;
              ctx.fillText(text, x, y + r + 5);
            }
            ctx.restore();
          },
          nodeDimensions: { width: r * 2, height: r * 2 },
        };
      };

    const nodesDS = new DataSet<Record<string, unknown>>(
      TECHNIQUES.map((t) => {
        const p = layout.positions.get(t.id)!;
        return {
          id: t.id,
          x: p.x,
          y: p.y,
          fixed: { x: true, y: true },
          shape: "custom",
          title: `${t.nameRu} · ${BELT_LABEL[t.belt]} · ${GROUP_LABEL[t.group]}`,
          ctxRenderer: mkRenderer(t),
        };
      }),
    );
    const pal0 = themeRef.current;
    const edgesDS = new DataSet<EdgeItem>(
      edges.map((e) => ({
        ...e,
        color: { color: pal0.edgeBase, highlight: pal0.edgeIn, hover: pal0.edgeIn },
        width: 0.6,
      })),
    );
    nodesDSRef.current = nodesDS;
    edgesDSRef.current = edgesDS;

const net = new Network(
  el,
  { nodes: nodesDS as never, edges: edgesDS as never },
  {
    physics: false,
    layout: { improvedLayout: false },
    nodes: { 
      shadow: false,
      font: {
        size: 12,
        color: theme.label,
        strokeWidth: 3,
        strokeColor: theme.labelStroke,
      },
    },
    edges: { 
      smooth: false,
      arrows: {
        to: { enabled: true, scaleFactor: 0.5 },
      },
    },
    interaction: { 
      hover: true, 
      tooltipDelay: 150, 
      hideEdgesOnDrag: true, 
      hideEdgesOnZoom: true,
      navigationButtons: false, // отключено — у тебя свои кнопки
      keyboard: true,           // управление с клавиатуры
      zoomView: true,
      dragView: true,
    },
  },
);
    netRef.current = net;

    net.on("beforeDrawing", (ctx: CanvasRenderingContext2D) => {
      const L = layoutRef.current;
      if (!L) return;
      const pal = themeRef.current;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Только зебра-полосы поясов. Крупные подписи поясов на фоне убраны (и так понятно по цвету).
      L.bands.forEach((bd, i) => {
        ctx.fillStyle = i % 2 === 0 ? pal.bandEven : pal.bandOdd;
        ctx.fillRect(L.xMin - 30, bd.y0 - 24, L.xMax - L.xMin + 60, bd.y1 - bd.y0 + 48);
      });
      ctx.restore();
    });
    net.on("afterDrawing", (ctx: CanvasRenderingContext2D) => {
      const L = layoutRef.current;
      if (!L) return;
      const pal = themeRef.current;
      ctx.save();
      const topY = L.bands[0].y0 - 26;
      L.lanes.forEach((l) => {
        const fs = Math.max(11, Math.min((l.x1 - l.x0) * 0.16, 22));
        const label =
          l.type === "belt" ? BELT_LABEL[l.key as Belt] : GROUP_LABEL[l.key as keyof typeof GROUP_LABEL];
        ctx.fillStyle = l.type === "belt" ? pal.belts[l.key as Belt] : pal.laneLabel;
        ctx.globalAlpha = l.type === "belt" ? 0.85 : 1;
        ctx.font = `700 ${fs}px Manrope, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText((label ?? l.key).toUpperCase(), (l.x0 + l.x1) / 2, topY);
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    });

    // Подпись показываем только под курсором
    net.on("hoverNode", (p: { node: number }) => {
      hoveredIdRef.current = p.node;
      const d = renderRef.current.get(p.node);
      if (d) d.hovered = true;
      net.redraw();
    });
    net.on("blurNode", (p: { node: number }) => {
      const d = renderRef.current.get(p.node);
      if (d) d.hovered = false;
      if (hoveredIdRef.current === p.node) hoveredIdRef.current = null;
      net.redraw();
    });

    net.on("click", (params: { nodes: number[] }) => {
      const id = params.nodes?.[0] ?? null;
      setFocusedId(id);
      if (id != null) {
        const sc = heroModeRef.current ? Math.max(net.getScale(), 0.9) : 1.0;
        net.focus(id, { scale: sc, animation: { duration: 400, easingFunction: "easeInOutQuad" } });
      }
    });

    let clamping = false;
    net.on("zoom", () => {
      if (clamping) return;
      const s = net.getScale();
      const target = s < minScaleRef.current ? minScaleRef.current : s > 3.5 ? 3.5 : null;
      if (target != null) {
        clamping = true;
        net.moveTo({ scale: target });
        clamping = false;
      }
    });

    // Ограничение панорамы: край графа упирается в край экрана — нельзя уйти за рамки.
    // По горизонтали жёстко (пользователь может только зумить), по вертикали в пределах контента.
    const clampPan = () => {
      const L = layoutRef.current;
      const elc = containerRef.current;
      if (!L || !elc || clamping) return;
      const s = net.getScale();
      const halfVW = elc.offsetWidth / 2 / s;
      const halfVH = elc.offsetHeight / 2 / s;
      const cMinX = L.xMin, cMaxX = L.xMax;
      const cMinY = L.bands[0].y0 - 30, cMaxY = L.bands[L.bands.length - 1].y1 + 30;
      const pos = net.getViewPosition();
      // если контент уже окна — центрируем ось, иначе держим край у края
      const clampAxis = (p: number, cMin: number, cMax: number, half: number) =>
        cMax - cMin <= half * 2 ? (cMin + cMax) / 2 : Math.max(cMin + half, Math.min(cMax - half, p));
      const x = clampAxis(pos.x, cMinX, cMaxX, halfVW);
      const y = clampAxis(pos.y, cMinY, cMaxY, halfVH);
      if (Math.abs(x - pos.x) > 0.5 || Math.abs(y - pos.y) > 0.5) {
        clamping = true;
        net.moveTo({ position: { x, y } });
        clamping = false;
      }
    };
    net.on("dragging", clampPan);
    net.on("dragEnd", clampPan);
    net.on("zoom", clampPan);

    const computeMinScale = () => {
      const before = { s: net.getScale(), p: net.getViewPosition() };
      net.fit({ animation: false } as never);
      minScaleRef.current = net.getScale();
      net.moveTo({ scale: before.s, position: before.p });
    };

    net.once("afterDrawing", () => {
      computeMinScale();
      if ((el.offsetWidth || 0) < 640) {
        const lane = beltLanes(layout).find((l) => l.key === profile.belt);
        if (lane) {
          const scale = Math.max(0.7, minScaleRef.current);
          net.moveTo({
            position: { x: (lane.x0 + lane.x1) / 2, y: layout.bands[0].y0 + el.offsetHeight / 2 / scale },
            scale,
          });
        }
      } else {
        net.fit({ animation: false } as never);
      }
    });

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
const ro = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const W = el.offsetWidth, H = el.offsetHeight;
    if (!W || !H) return;
    const wantO: Orientation = heroModeRef.current ? "vertical" : pickOrientation(W, H);
    const wantC = pickCols(wantO, W, H);
    if (wantO !== paramsRef.current.orientation || wantC !== paramsRef.current.cols) {
      rebuildLayout(wantO, wantC);
    } else {
      net.redraw();
      computeMinScale();
    }
  }, 250); // ← было 150, стало 250 (меньше перерисовок)
});
    ro.observe(el);

    return () => {
      clearTimeout(resizeTimer);
      ro.disconnect();
      net.destroy();
      netRef.current = null;
      nodesDSRef.current = null;
      edgesDSRef.current = null;
    };
    // Сеть строится один раз; прогресс/фильтры/тема применяются отдельным эффектом ниже.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- применение прогресса/фильтров/фокуса/темы БЕЗ пересоздания сети ---
  useEffect(() => {
    const net = netRef.current;
    const edgesDS = edgesDSRef.current;
    if (!net || !edgesDS) return;
    const pal = theme;
    const dimmed = focusSet !== null || filter !== "all" || giFilter !== "all" || legalOnly;

    const visible = new Set<number>();
    for (const t of TECHNIQUES) {
      if (focusSet) {
        if (focusSet.has(t.id)) visible.add(t.id);
      } else if (matchesFilter(t)) visible.add(t.id);
    }
    if (focusedId != null) visible.add(focusedId);

    for (const t of TECHNIQUES) {
      const d = renderRef.current.get(t.id)!;
      d.status = progress[t.id] ?? "not_started";
      d.readyFrac = readiness(t, progress).frac;
      d.dim = dimmed && !visible.has(t.id);
      d.focused = t.id === focusedId;
      d.hovered = t.id === hoveredIdRef.current;
      d.showLabel = focusSet ? focusSet.has(t.id) : false;
    }

    edgesDS.update(
      edges.map((e) => {
        const related = focusedId != null && (e.from === focusedId || e.to === focusedId);
        const inPath =
          dir === "path" && focusSet != null && focusSet.has(e.from) && focusSet.has(e.to) && e.kind === "prereq";
        const bothVisible = visible.has(e.from) && visible.has(e.to);
        if (!dimmed || ((related || inPath) && bothVisible)) {
          let col = pal.edgeBase;
          if (related) col = e.to === focusedId ? pal.edgeIn : pal.edgeOut;
          if (inPath) col = pal.edgeOut;
          return {
            id: e.id,
            color: { color: col, highlight: pal.edgeIn, hover: pal.edgeIn },
            width: related || inPath ? 1.6 : 0.6,
          };
        }
        return { id: e.id, color: { color: pal.edgeDim, highlight: pal.edgeDim, hover: pal.edgeDim }, width: 0.3 };
      }),
    );
    net.redraw();
  }, [progress, focusSet, focusedId, dir, filter, giFilter, legalOnly, safetyLens, theme, matchesFilter, edges]);

  // --- пояс-герой ---
  const focusBelt = useCallback((belt: Belt, animate = true) => {
    const net = netRef.current;
    const L = layoutRef.current;
    const el = containerRef.current;
    if (!net || !L || !el) return;
    const lane = beltLanes(L).find((l) => l.key === belt);
    if (!lane) return;
    const scale = Math.max(minScaleRef.current, Math.min(3, el.offsetWidth / (1.9 * (lane.x1 - lane.x0))));
    net.moveTo({
      position: { x: (lane.x0 + lane.x1) / 2, y: L.bands[0].y0 - 20 + el.offsetHeight / 2 / scale },
      scale,
      animation: animate ? ({ duration: 350, easingFunction: "easeInOutQuad" } as never) : false,
    });
  }, []);

  const toggleHero = useCallback(() => {
    const next = !heroMode;
    setHeroMode(next);
    heroModeRef.current = next;
    const el = containerRef.current;
    if (!el) return;
    if (next) {
      rebuildLayout("vertical", pickCols("vertical", el.offsetWidth, el.offsetHeight));
      setTimeout(() => focusBelt(heroBelt, false), 50);
    } else {
      const o = pickOrientation(el.offsetWidth, el.offsetHeight);
      rebuildLayout(o, pickCols(o, el.offsetWidth, el.offsetHeight));
    }
  }, [heroMode, heroBelt, rebuildLayout, focusBelt]);

  const jumpTo = useCallback((id: number) => {
    setFocusedId(id);
    netRef.current?.focus(id, { scale: 1.1, animation: { duration: 400, easingFunction: "easeInOutQuad" } });
  }, []);

  const selectFromSearch = useCallback(
    (t: Technique) => {
      setQuery("");
      jumpTo(t.id);
    },
    [jumpTo],
  );

  const overviewFit = useCallback(() => {
    netRef.current?.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } } as never);
  }, []);

  const focusedTech = focusedId != null ? TECH_BY_ID[focusedId] : null;
  const stats = useMemo(() => {
    let done = 0;
    for (const t of TECHNIQUES) if (progress[t.id] === "done") done++;
    return { total: TECHNIQUES.length, done, pct: Math.round((done / TECHNIQUES.length) * 100) };
  }, [progress]);

  const heroBelts = BELT_ORDER.filter((b) => TECHNIQUES.some((t) => t.belt === b));

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      {/* Шапка: статистика + поиск */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">Карта техник</h2>
            <p className="text-[11px] text-muted-foreground">
              {stats.done}/{stats.total} изучено · {stats.pct}%
            </p>
          </div>
          <div className="relative w-44 sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск техники…"
              className="w-full rounded-full border border-border bg-background py-1.5 pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
            {searchResults.length > 0 && (
              <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                {searchResults.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectFromSearch(t)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: theme.belts[t.belt] }} />
                    <span className="min-w-0 flex-1 truncate">{t.nameRu}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{GROUP_LABEL[t.group]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Компактная строка фильтров: базовые + свёрнутые доп. фильтры + справка */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", "Все"],
              ["myBelt", "Мой пояс"],
              ["mastered", "Освоенные"],
              ["available", "Доступные"],
            ] as [BaseFilter, string][]
          ).map(([f, label]) => (
            <Chip key={f} active={filter === f} onClick={() => { setFilter(f); setFocusedId(null); }}>
              {label}
            </Chip>
          ))}
          <span className="mx-0.5 h-4 w-px bg-border" />
          <Chip
            active={showFilters || giFilter !== "all" || legalOnly || safetyLens}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="mr-1 inline h-3 w-3" />
            Фильтры
          </Chip>
          <Chip active={showLegend} onClick={() => setShowLegend(!showLegend)}>
            <HelpCircle className="mr-1 inline h-3 w-3" />
          </Chip>
        </div>

        {showFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", "Gi+NoGi"],
                ["gi", "Gi"],
                ["nogi", "No-Gi"],
              ] as [GiFilter, string][]
            ).map(([f, label]) => (
              <Chip key={f} active={giFilter === f} onClick={() => setGiFilter(f)}>
                {label}
              </Chip>
            ))}
            <Chip active={legalOnly} onClick={() => setLegalOnly(!legalOnly)}>
              IBJJF
            </Chip>
            <Chip active={safetyLens} onClick={() => setSafetyLens(!safetyLens)}>
              <ShieldAlert className="mr-1 inline h-3 w-3" />
              Риск травмы
            </Chip>
          </div>
        )}
      </div>

      {/* Канвас */}
      <div className="relative h-[520px] w-full" style={{ background: theme.canvasBg }}>
        <div ref={containerRef} className="absolute inset-0" />

        {heroMode && (
          <div className="absolute left-1/2 top-2.5 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/90 px-1.5 py-1 backdrop-blur">
            {heroBelts.map((b) => (
              <button
                key={b}
                onClick={() => { setHeroBelt(b); focusBelt(b); }}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  b === heroBelt ? "text-foreground" : "text-muted-foreground"
                }`}
                style={
                  b === heroBelt
                    ? { background: `${theme.belts[b]}33`, boxShadow: `inset 0 0 0 1px ${theme.belts[b]}66` }
                    : undefined
                }
              >
                {BELT_LABEL[b]}
              </button>
            ))}
          </div>
        )}

        <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
          <button
            onClick={toggleHero}
            title="Режим пояса (мобильный)"
            className={`grid h-10 w-10 place-items-center rounded-xl border backdrop-blur transition ${
              heroMode
                ? "border-ring bg-primary/20 text-foreground"
                : "border-border bg-card/90 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="h-4 w-4" />
          </button>
          <button
            onClick={overviewFit}
            title="По центру"
            className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card/90 text-muted-foreground backdrop-blur transition hover:text-foreground"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {focusedId == null && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
            Клик по узлу — связи · «Путь» — цепочка изучения
          </div>
        )}
      </div>

      {/* Панель фокуса (направление связей выбирается здесь — когда есть фокус) */}
      {focusedTech && (
        <FocusPanel
          tech={focusedTech}
          progress={progress}
          dir={dir}
          onDir={setDir}
          onClose={() => setFocusedId(null)}
          onJump={jumpTo}
        />
      )}

      {/* Карточки: текущий фокус + следующая цель */}
      <div className="grid grid-cols-1 gap-2 border-t border-border p-3 sm:grid-cols-2">
        <MilestoneCard
          icon={<Target className="h-4 w-4" />}
          caption="Текущий фокус"
          tech={focusTech}
          empty="Отметьте технику «в процессе» — она появится здесь"
          onClick={(t) => jumpTo(t.id)}
        />
        <MilestoneCard
          icon={<Flag className="h-4 w-4" />}
          caption="Следующая цель"
          tech={recommendations[0] ?? null}
          extra={recommendations.slice(1)}
          empty="Всё доступное освоено!"
          onClick={(t) => jumpTo(t.id)}
          highlight
        />
      </div>

      {/* Легенда — по кнопке «?» */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-[10px] text-muted-foreground">
          <span>Обводка узла = пояс · заливка = статус · кольцо = готовность пререквизитов:</span>
          {heroBelts.map((b) => (
            <span key={b} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full ring-1 ring-border" style={{ background: theme.belts[b] }} />
              {BELT_LABEL[b]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: theme.done }} />
            Изучено
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: theme.prog }} />
            В процессе
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4" style={{ background: theme.edgeIn }} />
            Ведёт к технике
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4" style={{ background: theme.edgeOut }} />
            Продолжения
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-dashed" style={{ borderColor: theme.risk }} />
            Высокий риск
          </span>
        </div>
      )}
    </div>
  );
}

function FocusPanel({
  tech,
  progress,
  dir,
  onDir,
  onClose,
  onJump,
}: {
  tech: Technique;
  progress: ProgressMap;
  dir: FocusDir;
  onDir: (d: FocusDir) => void;
  onClose: () => void;
  onJump: (id: number) => void;
}) {
  const status = progress[tech.id] ?? "not_started";
  const content = contentFor(tech, "ru");
  const path = dir === "path" ? learningPath(tech, progress) : null;
  const chains = tech.chain_to.map((i) => TECH_BY_ID[i]).filter(Boolean).slice(0, 6);

  return (
    <div className="border-t border-border bg-muted/40 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {GROUP_LABEL[tech.group]} · {BELT_LABEL[tech.belt]} ·{" "}
            {status === "done" ? "Изучено" : status === "in_progress" ? "В процессе" : "Не начато"}
          </p>
          <h3 className="mt-0.5 truncate text-base font-semibold">{tech.nameRu}</h3>
          {content && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{content.concept}</p>}
        </div>
        <button
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
          aria-label="Снять фокус"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Что показывать на карте для этой техники */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(
          [
            ["both", "Соседи"],
            ["up", "← Что раньше"],
            ["down", "Дальше →"],
            ["path", "Путь изучения"],
          ] as [FocusDir, string][]
        ).map(([d, label]) => (
          <button
            key={d}
            onClick={() => onDir(d)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              dir === d
                ? "border-ring bg-primary/15 text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {path && path.length > 1 ? (
        <div className="mt-2">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Путь изучения — {path.length} шагов
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {path.map((t, i) => (
              <span key={t.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <button
                  onClick={() => onJump(t.id)}
                  className={`rounded-md border border-border px-2 py-0.5 text-[11px] transition hover:bg-muted ${
                    t.id === tech.id ? "font-semibold" : ""
                  }`}
                >
                  {t.label}
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        chains.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {chains.map((t) => (
              <button
                key={t.id}
                onClick={() => onJump(t.id)}
                className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted"
              >
                → {t.label}
              </button>
            ))}
          </div>
        )
      )}

      <Link
        to="/technique/$id"
        params={{ id: String(tech.id) }}
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
      >
        Открыть технику
      </Link>
    </div>
  );
}

function MilestoneCard({
  icon,
  caption,
  tech,
  extra,
  empty,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  caption: string;
  tech: Technique | null;
  extra?: Technique[];
  empty: string;
  onClick: (t: Technique) => void;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 ${highlight ? "border-ring/50 bg-primary/5" : "border-border bg-background"}`}>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {caption}
      </p>
      {tech ? (
        <>
          <button onClick={() => onClick(tech)} className="mt-1 block text-left text-sm font-semibold hover:underline">
            {tech.nameRu}
          </button>
          <p className="text-[11px] text-muted-foreground">
            {GROUP_LABEL[tech.group]} · {BELT_LABEL[tech.belt]} · сложность {tech.difficulty}/5
          </p>
          {extra && extra.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {extra.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onClick(t)}
                  className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{empty}</p>
      )}
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
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
        active
          ? "border-ring bg-primary/15 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
