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
  // Строим граф: id → массив prerequisites
  const graph = new Map();
  for (const t of techniques) {
    graph.set(t.id, t.prerequisites); // t.prerequisites уже массив чисел!
  }

  const visited = new Set(); // Глобально посещённые узлы
  const recStack = new Set(); // Узлы в текущем пути рекурсии

  function dfs(nodeId) {
    if (recStack.has(nodeId)) return true; // Цикл найден
    if (visited.has(nodeId)) return false; // Уже проверен
    
    visited.add(nodeId);
    recStack.add(nodeId);
    
    const deps = graph.get(nodeId) || [];
    for (const dep of deps) {
      if (dfs(dep)) return true;
    }
    
    recStack.delete(nodeId);
    return false;
  }

  const cycles = [];
  for (const id of graph.keys()) {
    if (!visited.has(id)) {
      if (dfs(id)) cycles.push(id);
    }
  }
  
  return cycles;
}

const cycles = detectCycles(techniques);
if (cycles.length > 0) {
  errs.push(`❌ Обнаружены циклические зависимости в техниках: ${cycles.join(', ')}`);
}

// --- Теперь проверяем ВСЕ ошибки и записываем только если всё ОК ---
if (errs.length) {
  console.error('ОШИБКИ ДАННЫХ:');
  errs.slice(0, 30).forEach((e) => console.error(' ✗', e));
  process.exit(1);
}

console.log('✅ Циклических зависимостей нет');
console.log('✅ Все ссылки валидны');
console.log('✅ Все обязательные поля заполнены');

writeFileSync(join(ROOT, 'src', 'lib', 'bjj', 'generated', 'techniques.json'), JSON.stringify(techniques), 'utf8');
console.log(`OK: ${techniques.length} техник → src/lib/bjj/generated/techniques.json`);
