import { useEffect, useRef } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import { TECHNIQUES } from "@/lib/bjj/data";
import { computeLayout, pickOrientation, pickCols } from "@/lib/bjj/graphLayout";
import type { StyleProfile } from "@/lib/bjj/types";
import type { EdgeItem, Palette } from "./graphUtils";

interface MinimapProps {
  profile: StyleProfile;
  edges: EdgeItem[];
  theme: Palette;
  mainNetRef: React.MutableRefObject<Network | null>;
}

export function Minimap({ profile, edges, theme, mainNetRef }: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapNetRef = useRef<Network | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const w = el.offsetWidth || 160;
    const h = el.offsetHeight || 128;
    const orientation = pickOrientation(w, h);
    const cols = pickCols(orientation, w, h);
    const layout = computeLayout(TECHNIQUES, orientation, cols);

    const nodes = new DataSet(
      TECHNIQUES.map((t) => {
        const p = layout.positions.get(t.id)!;
        return {
          id: t.id, x: p.x, y: p.y,
          shape: "dot", size: 3,
          color: { background: theme.belts[t.belt], border: theme.belts[t.belt] },
        };
      }),
    );

    const edgesDS = new DataSet(
      edges.map((e) => ({
        ...e,
        color: { color: theme.edgeBase, highlight: theme.edgeBase, hover: theme.edgeBase },
        width: 0.3,
      })),
    );

    const net = new Network(el, { nodes, edges: edgesDS }, {
      physics: false,
      interaction: { dragView: false, zoomView: false, dragNodes: false, hover: false },
      nodes: { shape: "dot" },
      edges: { smooth: false },
    });
    minimapNetRef.current = net;
    net.fit({ animation: false });

    // Синхронизация с основным графом
    const mainNet = mainNetRef.current;
    if (mainNet) {
      const sync = () => {
        const pos = mainNet.getViewPosition();
        const scale = mainNet.getScale();
        net.moveTo({ position: pos, scale: scale * 0.3, animation: false });
      };
      mainNet.on("viewChanged", sync);
    }

    return () => {
      net.destroy();
      minimapNetRef.current = null;
    };
  }, [profile, edges, theme, mainNetRef]);

  return (
    <div
      ref={containerRef}
      className="absolute top-3 right-3 z-20 h-32 w-40 overflow-hidden rounded-lg border border-border bg-card/90 backdrop-blur shadow-lg"
    />
  );
}
