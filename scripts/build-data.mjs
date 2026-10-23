// Генератор данных: data/techniques.csv → src/lib/bjj/generated/techniques.json + technique-content.json
// Источник правды — CSV (редактируется через Google Sheets / db-rework).
// Запуск: node scripts/build-data.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deriveAllStyles } from './derive-styles.mjs';
import { deriveVideoAccess } from './deriveVideoAccess.mjs';

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
// Видео из Telegram-канала тренера: techId -> [{ post, videos, date, text }].
// Размечено по подписям альбомов; на карточке — ссылки на посты (t.me/<channel>/<post>).
const channelPath = join(ROOT, 'data', 'channel-videos.json');
const channelData = existsSync(channelPath)
  ? JSON.parse(readFileSync(channelPath, 'utf8'))
  : { channel: null, byTechnique: {} };

// Поисковые алиасы (сленг сообщества -> карточка): id -> string[]
const aliasMap = JSON.parse(
  readFileSync(join(ROOT, 'data', 'aliases.json'), 'utf8'),
);
// Стартовый набор новичка (курируется вручную): массив бакетов { title, ids }
const starterSet = JSON.parse(
  readFileSync(join(ROOT, 'data', 'starter-set.json'), 'utf8'),
);
// Множество id стартового набора (для вывода demo-доступа к видео)
const starterIds = new Set(starterSet.flatMap((b) => b.ids));
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
    aliases: aliasMap[r.id] || [],
    prerequisites: ids(r.prerequisites),
    setup_from: ids(r.setup_from),
    common_setups: ids(r.common_setups),
    chain_to: ids(r.chain_to),
    difficulty: parseInt(r.difficulty, 10) || 1,
    successRate: r.success_rate,
    energyCost: r.energy_cost,
    videoId: videoUrls[r.id]?.bunny || undefined,
    videoAccess: videoUrls[r.id]
      ? deriveVideoAccess(videoUrls[r.id].access, starterIds.has(parseInt(r.id, 10)))
      : undefined,
    channelVideoCount:
      (channelData.byTechnique[r.id] ?? []).reduce((n, a) => n + (a.videos || 0), 0) || undefined,
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

// --- валидация стартового набора: id существуют, нет дублей, предупреждение о не-белых ---
const starterSeen = new Set();
for (const bucket of starterSet) {
  if (!bucket.title || !Array.isArray(bucket.ids)) {
    errs.push(`starter-set: бакет без title/ids`);
    continue;
  }
  for (const ref of bucket.ids) {
    if (!validIds.has(ref)) errs.push(`starter-set «${bucket.title}»: битый id ${ref}`);
    if (starterSeen.has(ref)) errs.push(`starter-set: дубль id ${ref}`);
    starterSeen.add(ref);
    const tech = techniques.find((t) => t.id === ref);
    if (tech && tech.belt !== 'white') {
      console.warn(`⚠️  starter-set: id ${ref} (${tech.nameRu}) не белый пояс (${tech.belt})`);
    }
  }
}

// --- валидация видео-разметки (Bunny) ---
for (const [key, entry] of Object.entries(videoUrls)) {
  if (!validIds.has(parseInt(key, 10))) errs.push(`video-urls: неизвестный id ${key}`);
  if (!entry || typeof entry.bunny !== 'string' || !entry.bunny.trim())
    errs.push(`video-urls id ${key}: пустой bunny (guid)`);
  if (entry && entry.access !== undefined && entry.access !== 'demo' && entry.access !== 'pro')
    errs.push(`video-urls id ${key}: access должен быть demo|pro, а не «${entry.access}»`);
}

// --- Валидация графа и согласованности (по экспертизе базы, 2026-10-23) ---
// prerequisites = «сначала изучить»: настоящий DAG, иначе ломаются isUnlocked и learningPath.
const BELT_RANK = { white: 0, blue: 1, purple: 2, brown: 3, black: 4 };
const byId = new Map(techniques.map((t) => [t.id, t]));

// циклы: DFS с цветами, путь цикла в сообщении
{
  const color = new Map();
  const stack = [];
  const visit = (id) => {
    color.set(id, 1);
    stack.push(id);
    for (const dep of byId.get(id)?.prerequisites ?? []) {
      if (color.get(dep) === 1) {
        errs.push(`цикл в prerequisites: ${[...stack.slice(stack.indexOf(dep)), dep].join(' -> ')}`);
      } else if (!color.get(dep)) visit(dep);
    }
    stack.pop();
    color.set(id, 2);
  };
  for (const t of techniques) if (!color.get(t.id)) visit(t.id);
}

const warns = [];
let asym = 0;
for (const t of techniques) {
  // пререквизит не выше поясом самой техники
  for (const pid of t.prerequisites) {
    const p = byId.get(pid);
    if (p && BELT_RANK[p.belt] > BELT_RANK[t.belt])
      errs.push(`id ${t.id} (${t.belt}): пререквизит ${pid} выше поясом (${p.belt})`);
  }
  // ADCC — no-gi: у приёма только в ги не может быть «легален в ADCC»
  if (!t.noGi && t.legal_adcc !== false) errs.push(`id ${t.id}: ADCC легален, но приём только в ги`);
  // пояс техники не ниже пояса легальности IBJJF
  for (const k of ['legal_ibjjf_gi', 'legal_ibjjf_nogi']) {
    if (typeof t[k] === 'string' && BELT_RANK[t[k]] > BELT_RANK[t.belt])
      warns.push(`id ${t.id}: пояс ${t.belt} ниже легальности IBJJF (${k}=${t[k]})`);
  }
  // «откуда» без обратной ссылки «дальше» — только счётчик (полная симметрия раздула бы карту)
  for (const s of t.setup_from) if (!byId.get(s)?.chain_to.includes(t.id)) asym++;
}

if (errs.length) {
  console.error('ОШИБКИ ДАННЫХ:');
  errs.slice(0, 30).forEach((e) => console.error(' ✗', e));
  process.exit(1);
}

console.log('✅ Все ссылки валидны');
console.log('✅ Все обязательные поля заполнены');
for (const w of warns) console.warn(`⚠️  ${w}`);
console.log(`ℹ️  «откуда» без обратной ссылки «дальше»: ${asym}`);

// Лёгкая база (в стартовом бандле): всё, кроме текстов разборов. Из content остаются
// только injuryRisk/tapWarning — их читают рекомендации и генератор тренировки.
// Полные тексты — отдельный файл, грузится динамическим import() на странице техники.
const light = techniques.map(({ content, ...rest }) => ({
  ...rest,
  content: { ru: { injuryRisk: content.ru.injuryRisk, tapWarning: content.ru.tapWarning } },
}));
const contentById = Object.fromEntries(techniques.map((t) => [t.id, t.content]));
// Видео канала: проверка ссылок на техники, отдельный ленивый файл
const knownIds = new Set(techniques.map((t) => String(t.id)));
for (const id of Object.keys(channelData.byTechnique)) {
  if (!knownIds.has(id)) errs.push(`channel-videos: техника ${id} не существует`);
}
if (errs.length) { console.error(errs.join(String.fromCharCode(10))); process.exit(1); }
writeFileSync(
  join(ROOT, 'src', 'lib', 'bjj', 'generated', 'channel-videos.json'),
  JSON.stringify({ channel: channelData.channel, byTechnique: channelData.byTechnique }),
  'utf8',
);
writeFileSync(join(ROOT, 'src', 'lib', 'bjj', 'generated', 'techniques.json'), JSON.stringify(light), 'utf8');
writeFileSync(join(ROOT, 'src', 'lib', 'bjj', 'generated', 'technique-content.json'), JSON.stringify(contentById), 'utf8');
console.log(`OK: ${techniques.length} техник → generated/techniques.json (+ тексты в technique-content.json)`);

writeFileSync(join(ROOT, 'src', 'lib', 'bjj', 'generated', 'starter-set.json'), JSON.stringify(starterSet), 'utf8');
console.log(`OK: стартовый набор ${starterSeen.size} техник → generated/starter-set.json`);
