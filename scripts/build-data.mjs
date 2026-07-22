// Генератор данных: data/techniques.csv → src/lib/bjj/generated/techniques.json
// Источник правды — CSV (редактируется через Google Sheets / db-rework).
// Запуск: node scripts/build-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deriveAllStyles } from './derive-styles.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

const ids = (s) => (s || '').split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n));
const bool = (v) => v === '✔';
// Легальность: '✔' = всем поясам (true), '✗' = никогда (false),
// слаг пояса ('blue'/'purple'/'brown'/...) = легально С этого пояса (для IBJJF-ограничений по поясу)
const BELTS = new Set(['white', 'blue', 'purple', 'brown', 'black']);
const legalVal = (v) => {
  const t = (v || '').trim();
  if (t === '✔') return true;
  if (BELTS.has(t)) return t;
  return false;
};

const csv = readFileSync(join(ROOT, 'data', 'techniques.csv'), 'utf8').replace(/^﻿/, '');
const videoUrls = JSON.parse(
  readFileSync(join(ROOT, 'data', 'video-urls.json'), 'utf8'),
);
const rows = parseCSV(csv);
const header = rows[0];
const recs = rows.slice(1).filter((r) => r.length > 1 && r[0].trim())
  .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').trim()])));

const techniques = recs.map((r) => {
  // label: "RU полное - EN полное - RU разговорное"
  const parts = r.label.split(' - ').map((s) => s.trim());
  const nameRu = parts[0] || r.label;
  const nameEn = parts[1] || nameRu;
  const shortRu = parts[2] || nameRu;
  const tags = r.tags ? r.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
  return {
    id: parseInt(r.id, 10),
    label: shortRu,
    title: r.title,
    nameRu,
    nameEn,
    group: r.group,
    belt: r.belt,
    gi: bool(r.gi),
    noGi: bool(r.noGi),
    legal_ibjjf_gi: legalVal(r.legal_ibjjf_gi),
    legal_ibjjf_nogi: legalVal(r.legal_ibjjf_nogi),
    legal_adcc: legalVal(r.legal_adcc),
    points_ibjjf: parseInt(r.points_ibjjf, 10) || 0,
    points_adcc: parseInt(r.points_adcc, 10) || 0,
    tags,
    prerequisites: ids(r.prerequisites),
    setup_from: ids(r.setup_from),
    common_setups: ids(r.common_setups),
    chain_to: ids(r.chain_to),
    difficulty: parseInt(r.difficulty, 10) || 1,
    successRate: r.success_rate,
    energyCost: r.energy_cost,
    videoUrl: videoUrls[r.id] || undefined,
    content: {
      ru: {
        concept: r.concept,
        mechanics: r.mechanics,
        keyPoints: r.keyPoints,
        when: r.when,
        mistakes: r.mistakes,
        drills: r.drills,
        injuryRisk: r.injury_risk,
        tapWarning: r.tap_warning,
      },
    },
    // Монетизация (заполняется позже): videoUrl, isPremium
  };
});

// --- деривация игровых стилей (двухпроходно: self + наследование из setup_from) ---
const styleMap = deriveAllStyles(techniques);
for (const t of techniques) t.styles = styleMap.get(t.id) || [];

// --- валидация перед записью ---
const errs = [];
const seen = new Set();
const validIds = new Set(techniques.map((t) => t.id));

for (const t of techniques) {
  if (seen.has(t.id)) errs.push(`дубль id ${t.id}`);
  seen.add(t.id);
  for (const col of ['prerequisites', 'setup_from', 'common_setups', 'chain_to']) {
    for (const ref of t[col]) {
      if (!validIds.has(ref)) errs.push(`id ${t.id} ${col}: битая ссылка ${ref}`);
      if (ref === t.id) errs.push(`id ${t.id} ${col}: самоссылка`);
    }
  }
  for (const f of ['concept', 'mechanics', 'keyPoints', 'when', 'mistakes']) {
    if (!t.content.ru[f]) errs.push(`id ${t.id}: пустое ${f}`);
  }
}

// --- Проверка циклических зависимостей (в prerequisites) ---
function detectCycles(techniques) {
  const graph = new Map();
  for (const t of techniques) graph.set(t.id, t.prerequisites);

  const visited = new Set();
  const recStack = new Set();

  function dfs(nodeId) {
    if (recStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    recStack.add(nodeId);
    for (const dep of graph.get(nodeId) || []) {
      if (dfs(dep)) return true;
    }
    recStack.delete(nodeId);
    return false;
  }

  const cycles = [];
  for (const id of graph.keys()) {
    if (!visited.has(id) && dfs(id)) cycles.push(id);
  }
  return cycles;
}

// Циклы в prerequisites — ПРЕДУПРЕЖДЕНИЕ, не ошибка: в BJJ связи часто взаимны.
// Обходы графа (learningPath и т.п.) защищены visited-множеством. Отдельная задача —
// почистить prerequisites до настоящего DAG, чтобы «доступно сейчас» разблокировалось корректно.
const cycles = detectCycles(techniques);

if (errs.length) {
  console.error('ОШИБКИ ДАННЫХ:');
  errs.slice(0, 30).forEach((e) => console.error(' ✗', e));
  process.exit(1);
}

console.log('✅ Все ссылки валидны');
console.log('✅ Все обязательные поля заполнены');
if (cycles.length > 0) {
  console.warn(`⚠️  Циклы в prerequisites: ${cycles.length} техник (обходы защищены; см. задачу по чистке DAG)`);
}

writeFileSync(join(ROOT, 'src', 'lib', 'bjj', 'generated', 'techniques.json'), JSON.stringify(techniques), 'utf8');
console.log(`OK: ${techniques.length} техник → src/lib/bjj/generated/techniques.json`);
