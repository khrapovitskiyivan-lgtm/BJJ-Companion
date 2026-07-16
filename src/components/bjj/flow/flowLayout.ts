// Зональная раскладка Focus Mode (руками, без ELK: для звезды из ~8 узлов
// глобальный оптимизатор не нужен, а зоны с фиксированными отступами он не умеет).
// Оси несут смысл:
//   вертикаль = поток схватки: сверху setup_from (откуда попадаешь),
//     снизу chain_to (что дальше), сабмишены — отдельным нижним рядом (финиш);
//   горизонталь = выбор: слева альтернативы (та же группа, общий вход, кап 5).
// prerequisites в графе не участвуют: у 71% техник это дубль setup_from.
import type { Node, Edge } from "@xyflow/react";
import type { Technique } from "@/lib/bjj/types";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";

export const NODE_W = 156;
export const NODE_H = 64;

const GAP_X = 20;          // зазор между узлами в ряду
const ROW_GAP = 24;        // зазор между подрядами одной зоны
const ZONE_GAP_Y = 96;     // вертикальный отступ зоны от фокуса
const ALT_GAP_X = 84;      // отступ колонки альтернатив от фокуса
const MAX_PER_ROW = 4;     // узлов в ряду до переноса
const MAX_ALTS = 5;        // кап зоны альтернатив

export interface TechNodeData extends Record<string, unknown> {
  tech: Technique;
}

export interface FlowZones {
  up: Technique[];      // setup_from
  alts: Technique[];    // альтернативы
  down: Technique[];    // chain_to без сабмишенов
  subs: Technique[];    // chain_to сабмишены
}

// Собрать зоны соседства фокусной техники
export function collectZones(focus: Technique): FlowZones {
  const seen = new Set<number>([focus.id]);
  const take = (ids: number[]) =>
    ids
      .filter((id) => !seen.has(id) && TECH_BY_ID[id])
      .map((id) => {
        seen.add(id);
        return TECH_BY_ID[id];
      });

  const up = take(focus.setup_from);
  const chain = take(focus.chain_to);
  const down = chain.filter((t) => t.group !== "submission");
  const subs = chain.filter((t) => t.group === "submission");

  // Альтернативы: та же группа, общий вход (setup_from пересекается), не сам фокус
  const inSet = new Set(focus.setup_from);
  const alts = TECHNIQUES.filter(
    (t) =>
      !seen.has(t.id) &&
      t.group === focus.group &&
      t.setup_from.some((s) => inSet.has(s)),
  ).slice(0, MAX_ALTS);
  for (const a of alts) seen.add(a.id);

  return { up, alts, down, subs };
}

// Ряды зоны: центрируем по x относительно фокуса, при >MAX_PER_ROW переносим
function layoutRows(items: Technique[], startY: number, dir: 1 | -1): Node<TechNodeData>[] {
  const out: Node<TechNodeData>[] = [];
  for (let i = 0; i < items.length; i += MAX_PER_ROW) {
    const row = items.slice(i, i + MAX_PER_ROW);
    const rowW = row.length * NODE_W + (row.length - 1) * GAP_X;
    const rowIdx = Math.floor(i / MAX_PER_ROW);
    const y = startY + dir * rowIdx * (NODE_H + ROW_GAP);
    row.forEach((t, j) => {
      out.push(mkNode(t, -rowW / 2 + j * (NODE_W + GAP_X), y));
    });
  }
  return out;
}

function mkNode(t: Technique, x: number, y: number): Node<TechNodeData> {
  return {
    id: String(t.id),
    type: "tech",
    position: { x, y },
    width: NODE_W,
    height: NODE_H,
    measured: { width: NODE_W, height: NODE_H },
    data: { tech: t },
  };
}

// Узел-подпись зоны (не кликается, рисуется мелким текстом)
function mkLabel(id: string, text: string, x: number, y: number): Node {
  return {
    id,
    type: "zone",
    position: { x, y },
    width: NODE_W,
    height: 18,
    measured: { width: NODE_W, height: 18 },
    selectable: false,
    focusable: false,
    data: { text },
  };
}

// Ширина самого широкого ряда зоны (для отвода колонки альтернатив в сторону)
function rowWidth(count: number): number {
  const inRow = Math.min(count, MAX_PER_ROW);
  return inRow > 0 ? inRow * NODE_W + (inRow - 1) * GAP_X : 0;
}

// Построить positioned nodes+edges для фокусной техники. Синхронно.
export function layoutFlow(focus: Technique): { nodes: Node[]; edges: Edge[] } {
  const zones = collectZones(focus);
  const nodes: Node[] = [mkNode(focus, -NODE_W / 2, -NODE_H / 2)];
  const edges: Edge[] = [];
  let ei = 0;
  const edge = (from: number, to: number, kind: "flow" | "alt") =>
    edges.push({ id: `e${ei++}`, source: String(from), target: String(to), data: { kind } });

  // Верх: откуда попадаешь (стрелки вниз, в фокус). Зона растёт ВВЕРХ,
  // поэтому подпись — над самым верхним рядом, а не над первым.
  if (zones.up.length) {
    const upY = -NODE_H / 2 - ZONE_GAP_Y - NODE_H;
    nodes.push(...layoutRows(zones.up, upY, -1));
    const upRows = Math.ceil(zones.up.length / MAX_PER_ROW);
    const upTopY = upY - (upRows - 1) * (NODE_H + ROW_GAP);
    nodes.push(mkLabel("zl-up", "Откуда попадаешь", -NODE_W / 2, upTopY - 30));
    for (const t of zones.up) edge(t.id, focus.id, "flow");
  }

  // Низ, ряд 1: продолжения
  const downY = NODE_H / 2 + ZONE_GAP_Y;
  if (zones.down.length) {
    nodes.push(...layoutRows(zones.down, downY, 1));
    nodes.push(mkLabel("zl-down", "Что дальше", -NODE_W / 2, downY - 30));
    for (const t of zones.down) edge(focus.id, t.id, "flow");
  }

  // Низ, ряд 2: сабмишены (финиш) — ниже всех рядов продолжений,
  // с зазором под подпись (56 > высота подписи + отступ)
  if (zones.subs.length) {
    const downRows = Math.ceil(zones.down.length / MAX_PER_ROW);
    const subsY = downY + downRows * (NODE_H + ROW_GAP) + (zones.down.length ? 56 : 0);
    nodes.push(...layoutRows(zones.subs, subsY, 1));
    nodes.push(mkLabel("zl-subs", "Сабмишены: финиш", -NODE_W / 2, subsY - 30));
    for (const t of zones.subs) edge(focus.id, t.id, "flow");
  }

  // Лево: альтернативы. Колонка отводится левее САМОГО ШИРОКОГО ряда всех зон,
  // иначе при рядах в 3-4 узла колонка оказывается под ними (наложение).
  if (zones.alts.length) {
    const maxHalfW = Math.max(
      NODE_W,
      rowWidth(zones.up.length),
      rowWidth(zones.down.length),
      rowWidth(zones.subs.length),
    ) / 2;
    const colX = -maxHalfW - ALT_GAP_X - NODE_W;
    const colH = zones.alts.length * NODE_H + (zones.alts.length - 1) * ROW_GAP;
    const startY = -colH / 2;
    zones.alts.forEach((t, i) => {
      nodes.push(mkNode(t, colX, startY + i * (NODE_H + ROW_GAP)));
      edge(focus.id, t.id, "alt");
    });
    nodes.push(mkLabel("zl-alts", "Альтернативы", colX, startY - 30));
  }

  return { nodes, edges };
}
