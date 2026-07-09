import type { Belt, Technique } from "@/lib/bjj/types";
import { contentFor } from "@/lib/bjj/data";

export const PALETTE = {
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
    label: "#c9c9d1",
    labelStroke: "#0a0b0e",
    focusRing: "#ffffff",
    belts: {
      white: "#e8e6df", blue: "#4c8bf5", purple: "#a855f7",
      brown: "#8a5a2b", black: "#3f3f46",
    } as Record<Belt, string>,
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
    label: "#3f3f46",
    labelStroke: "#f7f7f5",
    focusRing: "#111111",
    belts: {
      white: "#b8b6ac", blue: "#3b82f6", purple: "#9333ea",
      brown: "#92561f", black: "#27272a",
    } as Record<Belt, string>,
    done: "#10b981",
    prog: "#d97706",
    risk: "#dc2626",
    riskMed: "#ea580c",
  },
};

export type Palette = (typeof PALETTE)["dark"];

export function riskLevel(t: Technique): "critical" | "medium" | "low" {
  const r = contentFor(t, "ru")?.injuryRisk ?? "";
  if (/КРИТИЧНО/i.test(r)) return "critical";
  if (/Средний/i.test(r)) return "medium";
  return "low";
}

export interface RenderData {
  status: "not_started" | "in_progress" | "done";
  dim: boolean;
  focused: boolean;
  showLabel: boolean;
  readyFrac: number;
  risk: "critical" | "medium" | "low";
}

export type FocusDir = "both" | "up" | "down" | "path";
export type BaseFilter = "all" | "myBelt" | "mastered" | "available";
export type GiFilter = "all" | "gi" | "nogi";
export type FocusMode = "all" | "my-level";

export interface EdgeItem {
  id: string;
  from: number;
  to: number;
  kind: "prereq" | "chain" | "setup";
  color?: { color: string; highlight: string; hover: string };
  width?: number;
  dashes?: boolean;
  arrows?: unknown;
}
