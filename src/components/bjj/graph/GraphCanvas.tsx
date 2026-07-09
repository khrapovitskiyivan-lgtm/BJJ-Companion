import { useEffect, useRef, useCallback } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { BELT_LABEL, BELT_ORDER, GROUP_LABEL } from "@/lib/bjj/constants";
import {
  computeLayout,
  pickOrientation,
  pickCols,
  beltLanes,
  type GraphLayout,
  type Orientation,
} from "@/lib/bjj/graphLayout";
import { readiness } from "@/lib/bjj/recommend";
import type { ProgressMap } from "@/lib/bjj/store";
import type { Belt, StyleProfile, Technique } from "@/lib/bjj/types";
import { PALETTE, riskLevel, type RenderData, type EdgeItem } from "./graphUtils";

interface GraphCanvasProps {
  progress: ProgressMap;
  profile: StyleProfile;
  edges: EdgeItem[];
  focusedId: number | null;
  onNodeClick: (id: number | null) => void;
  heroMode: boolean;
  heroBelt: Belt;
  focusMode: "all" | "my-level";
  matchesFilter: (t: Technique) => boolean;
  focusSet: Set<number> | null;
  dir: "both" | "up" | "down" | "path";
  dimmed: boolean;
}

export function GraphCanvas({
  progress,
  profile,
  edges,
  focusedId,
  onNodeClick,
  heroMode,
  heroBelt,
  focusMode,
  matchesFilter,
  focusSet,
  dir,
  dimmed,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const netRef = useRef<Network | null>(null);
  const nodesDSRef = useRef<DataSet<any> | null>(null);
  const edgesDSRef = useRef<DataSet<any> | null>(null);
  const layoutRef = useRef<GraphLayout | null>(null);
  const renderRef = useRef<Map<number, RenderData>>(new Map());
  const minScaleRef = useRef(0.1);
  const paramsRef = useRef<{ orientation: Orientation; cols: number }>({
    orientation: "horizontal",
    cols: 3,
  });

  const theme = profile.theme === "dark" ? PALETTE.dark : PALETTE.light;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const heroModeRef = useRef(heroMode);
  heroModeRef.current = heroMode;
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;

  // ✅ ИСПРАВЛЕНО: Функция rebuildLayout перенесена внутрь компонента
  const rebuildLayout = useCallback(
    (orientation: Orientation, cols: number) => {
      const nodesDS = nodesDSRef.current;
      const net = netRef.current;
      if (!nodesDS || !net) return;

      const layout = computeLayout(TECHNIQUES, orientation, cols);
      layoutRef.current = layout;

      // Обновляем позиции всех узлов
      nodesDS.update(
        TECHNIQUES.map((t) => {
          const p = layout.positions.get(t.id)!;
          return { id: t.id, x: p.x, y: p.y };
        }),
      );

      net.redraw();
      net.fit({ animation: false } as never);
    },
    [],
  );

  // Инициализация сети (один раз)
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

    TECHNIQUES.forEach((t) => {
      renderRef.current.set(t.id, {
        status: progress[t.id] ?? "not_started",
        dim: false,
        focused: false,
        showLabel: false,
        readyFrac: readiness(t, progress).frac,
        risk: riskLevel(t),
      });
    });

    const mkRenderer = (t: Technique) => ({ ctx, x, y }: any) => {
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
          ctx.fillStyle =
            d.status === "done"
              ? pal.done
              : d.status === "in_progress"
              ? pal.prog
              : pal.nodeBg;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = d.focused ? pal.focusRing : pal.belts[t.belt];
          ctx.stroke();
          // Кольцо готовности
          if (d.status !== "done" && d.readyFrac > 0 && d.readyFrac < 1) {
            ctx.beginPath();
            ctx.arc(
              x,
              y,
              r + 4,
              -Math.PI / 2,
              -Math.PI / 2 + Math.PI * 2 * d.readyFrac,
            );
            ctx.lineWidth = 2;
            ctx.strokeStyle = pal.prog;
            ctx.stroke();
          }
          // Подпись
          const scale = netRef.current?.getScale() ?? 1;
          if (!d.dim && (d.focused || scale >= 1.8)) {
            const text =
              t.label.length > 14 ? t.label.slice(0, 13) + "…" : t.label;
            ctx.font = `600 ${Math.max(10, 12 / Math.min(scale, 1.8))}px Manrope, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.lineWidth = 3;
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

    const nodesDS = new DataSet(
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

    const edgesDS = new DataSet(
      edges.map((e) => ({
        ...e,
        color: {
          color: theme.edgeBase,
          highlight: theme.edgeIn,
          hover: theme.edgeIn,
        },
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
        nodes: { shadow: false },
        edges: {
          smooth: false,
          arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        },
        interaction: {
          hover: true,
          tooltipDelay: 150,
          hideEdgesOnDrag: true,
          hideEdgesOnZoom: true,
          navigationButtons: false,
          keyboard: true,
          zoomView: true,
          dragView: true,
        },
      },
    );
    netRef.current = net;

    // Фон с поясами
    net.on("beforeDrawing", (ctx: CanvasRenderingContext2D) => {
      const L = layoutRef.current;
      if (!L) return;
      const pal = themeRef.current;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      L.bands.forEach((bd, i) => {
        ctx.fillStyle = i % 2 === 0 ? pal.bandEven : pal.bandOdd;
        ctx.fillRect(
          L.xMin - 30,
          bd.y0 - 24,
          L.xMax - L.xMin + 60,
          bd.y1 - bd.y0 + 48,
        );
        const label =
          bd.type === "belt"
            ? BELT_LABEL[bd.key as Belt]
            : GROUP_LABEL[bd.key as keyof typeof GROUP_LABEL];
        ctx.fillStyle =
          bd.type === "belt" ? pal.belts[bd.key as Belt] : pal.laneLabel;
        ctx.globalAlpha = pal.watermarkAlpha;
        ctx.font = `800 ${Math.min((bd.y1 - bd.y0) * 0.7, 150)}px Manrope, sans-serif`;
        ctx.fillText(
          (label ?? bd.key).toUpperCase(),
          (L.xMin + L.xMax) / 2,
          (bd.y0 + bd.y1) / 2,
        );
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    });

    // Подписи поясов сверху
    net.on("afterDrawing", (ctx: CanvasRenderingContext2D) => {
      const L = layoutRef.current;
      if (!L) return;
      const pal = themeRef.current;
      ctx.save();
      const topY = L.bands[0].y0 - 26;
      L.lanes.forEach((l) => {
        const fs = Math.max(11, Math.min((l.x1 - l.x0) * 0.16, 22));
        const label =
          l.type === "belt"
            ? BELT_LABEL[l.key as Belt]
            : GROUP_LABEL[l.key as keyof typeof GROUP_LABEL];
        ctx.fillStyle =
          l.type === "belt" ? pal.belts[l.key as Belt] : pal.laneLabel;
        ctx.globalAlpha = l.type === "belt" ? 0.85 : 1;
        ctx.font = `700 ${fs}px Manrope, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText((label ?? l.key).toUpperCase(), (l.x0 + l.x1) / 2, topY);
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    });

    net.on("click", (params: { nodes: number[] }) => {
      const id = params.nodes?.[0] ?? null;
      onNodeClick(id);
      if (id != null) {
        const sc = heroModeRef.current
          ? Math.max(net.getScale(), 0.9)
          : 1.0;
        net.focus(id, {
          scale: sc,
          animation: { duration: 500, easingFunction: "easeInOutCubic" },
        });
      }
    });

    // Ограничение зума
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

    // Ограничение панорамы
    const clampPan = () => {
      const L = layoutRef.current;
      const elc = containerRef.current;
      if (!L || !elc || clamping) return;
      const s = net.getScale();
      const halfVW = elc.offsetWidth / 2 / s;
      const halfVH = elc.offsetHeight / 2 / s;
      const cMinX = L.xMin,
        cMaxX = L.xMax;
      const cMinY = L.bands[0].y0 - 30,
        cMaxY = L.bands[L.bands.length - 1].y1 + 30;
      const pos = net.getViewPosition();
      const clampAxis = (
        p: number,
        cMin: number,
        cMax: number,
        half: number,
      ) =>
        cMax - cMin <= half * 2
          ? (cMin + cMax) / 2
          : Math.max(cMin + half, Math.min(cMax - half, p));
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
      if (focusModeRef.current === "my-level") {
        const lane = beltLanes(layout).find((l) => l.key === profile.belt);
        if (lane) {
          const scale = Math.max(0.7, minScaleRef.current);
          net.moveTo({
            position: {
              x: (lane.x0 + lane.x1) / 2,
              y: layout.bands[0].y0 + el.offsetHeight / 2 / scale,
            },
            scale,
            animation: { duration: 600, easingFunction: "easeOutCubic" },
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
        const W = el.offsetWidth,
          H = el.offsetHeight;
        if (!W || !H) return;
        const wantO: Orientation = heroModeRef.current
          ? "vertical"
          : pickOrientation(W, H);
        const wantC = pickCols(wantO, W, H);
        if (
          wantO !== paramsRef.current.orientation ||
          wantC !== paramsRef.current.cols
        ) {
          rebuildLayout(wantO, wantC);
        } else {
          net.redraw();
          computeMinScale();
        }
      }, 250);
    });
    ro.observe(el);

    return () => {
      clearTimeout(resizeTimer);
      ro.disconnect();
      net.destroy();
      netRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обновление узлов при изменении прогресса/фильтров
  useEffect(() => {
    const net = netRef.current;
    const edgesDS = edgesDSRef.current;
    if (!net || !edgesDS) return;
    const pal = theme;

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
      d.showLabel = focusSet ? focusSet.has(t.id) : false;
    }

    edgesDS.update(
      edges.map((e) => {
        const related =
          focusedId != null && (e.from === focusedId || e.to === focusedId);
        const inPath =
          dir === "path" &&
          focusSet != null &&
          focusSet.has(e.from) &&
          focusSet.has(e.to) &&
          e.kind === "prereq";
        const bothVisible = visible.has(e.from) && visible.has(e.to);
        if (!dimmed || ((related || inPath) && bothVisible)) {
          let col = pal.edgeBase;
          if (related) col = e.to === focusedId ? pal.edgeIn : pal.edgeOut;
          if (inPath) col = pal.edgeOut;
          return {
            id: e.id,
            color: {
              color: col,
              highlight: pal.edgeIn,
              hover: pal.edgeIn,
            },
            width: related || inPath ? 1.6 : 0.6,
          };
        }
        return {
          id: e.id,
          color: {
            color: pal.edgeDim,
            highlight: pal.edgeDim,
            hover: pal.edgeDim,
          },
          width: 0.3,
        };
      }),
    );
    net.redraw();
  }, [progress, focusSet, focusedId, dir, dimmed, theme, matchesFilter, edges]);

  // Экспортируем ref-ы через callback (для управления из родителя)
  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      // @ts-expect-error - кастомное свойство для доступа из родителя
      setNetRef={(el: HTMLDivElement | null) => {
        if (el) (el as any).__netRef = netRef;
      }}
    />
  );
}
