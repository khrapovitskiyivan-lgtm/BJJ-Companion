// === Иерархическая раскладка графа техник ===
// Портировано из проверенного прототипа (graph-hier/layout.js).
// horizontal: пояса = полосы (Y, сверху вниз), группы = лейны (X)   [десктоп]
// vertical:   группы = полосы (Y),            пояса = лейны (X)    [мобайл]
// Ячейка = (пояс × группа): сетка cols-в-ряд + барицентр против пересечений.
// Координаты статичные — физика vis-network выключена (производительность).
import type { Belt, Group, Technique } from "./types";
import { BELT_ORDER } from "./constants";

export type Orientation = "horizontal" | "vertical";

export const GROUP_ORDER: Group[] = [
  "fundamentals", "takedown", "guard_pass", "position", "transition",
  "escape", "retention", "sweep", "submission", "system",
];

const SPACING_X = 58;
const SPACING_Y = 62;
const LANE_PAD = 54;
const BAND_PAD = 54;

export interface LayoutBand { key: string; type: "belt" | "group"; y0: number; y1: number; rows: number }
export interface LayoutLane { key: string; type: "belt" | "group"; x0: number; x1: number; cols: number }
export interface GraphLayout {
  positions: Map<number, { x: number; y: number }>;
  bands: LayoutBand[];
  lanes: LayoutLane[];
  orientation: Orientation;
  xMin: number;
  xMax: number;
}

export function computeLayout(
  nodes: Technique[],
  orientation: Orientation,
  cols: number,
): GraphLayout {
  const CELL_COLS = Math.max(2, Math.min(8, cols || 3));
  const bandKey = orientation === "vertical" ? "group" : "belt";
  const laneKey = orientation === "vertical" ? "belt" : "group";
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const of = (n: Technique, k: "belt" | "group") => (k === "belt" ? n.belt : n.group);
  const order = (k: "belt" | "group") => (k === "belt" ? (BELT_ORDER as string[]) : (GROUP_ORDER as string[]));

  const bandVals = order(bandKey).filter((v) => nodes.some((n) => of(n, bandKey) === v));
  const laneVals = order(laneKey).filter((v) => nodes.some((n) => of(n, laneKey) === v));

  const cell: Record<string, Record<string, number[]>> = {};
  laneVals.forEach((lv) => { cell[lv] = {}; bandVals.forEach((bv) => (cell[lv][bv] = [])); });
  nodes.forEach((n) => {
    const lv = of(n, laneKey), bv = of(n, bandKey);
    if (cell[lv]?.[bv]) cell[lv][bv].push(n.id);
  });

  const lanes: LayoutLane[] = [];
  let xCursor = 0;
  laneVals.forEach((lv) => {
    const w = CELL_COLS * SPACING_X;
    lanes.push({ key: lv, type: laneKey, x0: xCursor, x1: xCursor + w, cols: CELL_COLS });
    xCursor += w + LANE_PAD;
  });
  const laneBy = Object.fromEntries(lanes.map((l) => [l.key, l]));

  const bands: LayoutBand[] = [];
  let yCursor = 0;
  bandVals.forEach((bv) => {
    let maxRows = 1;
    laneVals.forEach((lv) => {
      const rows = Math.ceil(cell[lv][bv].length / CELL_COLS) || 0;
      if (rows > maxRows) maxRows = rows;
    });
    const h = maxRows * SPACING_Y;
    bands.push({ key: bv, type: bandKey, y0: yCursor, y1: yCursor + h, rows: maxRows });
    yCursor += h + BAND_PAD;
  });
  const bandBy = Object.fromEntries(bands.map((b) => [b.key, b]));

  const positions = new Map<number, { x: number; y: number }>();
  const place = (list: number[], lv: string, bv: string) => {
    const lane = laneBy[lv], band = bandBy[bv];
    list.forEach((id, k) => {
      const col = k % CELL_COLS, row = Math.floor(k / CELL_COLS);
      positions.set(id, {
        x: lane.x0 + col * SPACING_X + SPACING_X / 2,
        y: band.y0 + row * SPACING_Y + SPACING_Y / 2,
      });
    });
  };
  laneVals.forEach((lv) => bandVals.forEach((bv) => place(cell[lv][bv], lv, bv)));

  // барицентр: сортировка внутри ячейки по среднему X соседей (3 прохода)
  const neighbors = (id: number): number[] => {
    const n = byId.get(id);
    if (!n) return [];
    return [...n.prerequisites, ...n.chain_to, ...n.common_setups, ...n.setup_from].filter((m) => byId.has(m));
  };
  for (let pass = 0; pass < 3; pass++) {
    laneVals.forEach((lv) => bandVals.forEach((bv) => {
      const list = cell[lv][bv];
      if (list.length < 2) return;
      const bary = new Map<number, number>();
      list.forEach((id) => {
        const pts = neighbors(id).map((m) => positions.get(m)).filter(Boolean) as { x: number }[];
        bary.set(id, pts.length ? pts.reduce((a, p) => a + p.x, 0) / pts.length : positions.get(id)!.x);
      });
      const sorted = [...list].sort((a, b) => bary.get(a)! - bary.get(b)!);
      place(sorted, lv, bv);
      cell[lv][bv] = sorted;
    }));
  }

  const xMin = Math.min(...lanes.map((l) => l.x0)) - 10;
  const xMax = Math.max(...lanes.map((l) => l.x1)) + 10;
  return { positions, bands, lanes, orientation, xMin, xMax };
}

// Адаптивные параметры по размеру контейнера
export function pickOrientation(width: number, height: number): Orientation {
  return width < height * 1.1 ? "vertical" : "horizontal";
}
export function pickCols(orientation: Orientation, width: number, height: number): number {
  if (orientation === "vertical") return width < 480 ? 2 : 3;
  const aspect = width / Math.max(1, height);
  return Math.max(3, Math.min(7, Math.round(aspect * 2.4)));
}

// Belt (или Group) → пояс лейна для пояс-героя
export function beltLanes(layout: GraphLayout): LayoutLane[] {
  return layout.lanes.filter((l) => l.type === "belt");
}
