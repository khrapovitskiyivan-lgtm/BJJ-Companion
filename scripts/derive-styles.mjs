// Деривация игровых стилей для каждой техники (1–3 стиля).
// Два прохода:
//   1) self-скоринг: group-базлайн (умный для позиций) + теги + ключевые слова названия
//   2) наследование: сабмишны/переходы/системы подтягивают стиль из setup_from / common_setups
//      (позиция, из которой техника делается, — сильнейший сигнал стиля)
//
// 10 стилей: pressure_passer, speed_passer, closed_guard, open_guard, sweeper,
//            leg_game, back_hunter, wrestler, top_control, defense_escape

export const STYLE_IDS = [
  "pressure_passer", "speed_passer", "closed_guard", "open_guard", "sweeper",
  "leg_game", "back_hunter", "wrestler", "top_control", "defense_escape",
];

const GUARD_TAGS = new Set([
  "closed_guard", "half_guard", "open_guard", "spider_guard", "de_la_riva",
  "x_guard", "butterfly_guard", "worm_guard", "guard_retention", "guard_play",
]);

const KW = {
  leg_game: ["heel hook", "хил", "хиллхук", "ankle", "лодыж", "голеност", "kneebar", "книбар", "рычаг колена",
    "toe hold", "тохолд", "straight ankle", "аши", "ashi", "leg lock", "лег лок", "калф", "calf",
    "50/50", "saddle", "honey", "estima", "электрический стул", "прямой ущемление ахилл"],
  back_hunter: ["rear naked", "удушение сзади", "со спины", "на спину", "back take", "взятие спины",
    "bow and arrow", "лук и стрела", "распят", "crucifix", "rnc", "мата леао", "mata leao", "бэк",
    "контроль спины", "твистер", "truck"],
  wrestler: ["takedown", "тейкдаун", "double leg", "single leg", "в ноги", "проход в ноги", "бросок",
    "throw", "o-goshi", "o goshi", "seoi", "uchi mata", "ippon", "clinch", "клинч", "guard pull",
    "подтягивание гарда", "snap down", "ankle pick", "body lock", "suplex", "свалка", "из стойки",
    "дзюдо", "judo", "фиреман", "fireman", "duck under", "анаконда", "д'арс", "перуанский галстук"],
  sweeper: ["sweep", "свип", "переворот", "переворач", "flower", "hip bump", "scissor", "ножницы",
    "pendulum", "маятник", "tomoe", "overhead", "опрокид"],
  pressure_passer: ["knee cut", "кни кат", "kneecut", "over under", "over-under", "овер-андер", "stack",
    "стек", "smash", "смэш", "придавл", "продавл", "давлен", "прижим", "cross face", "кросс-фейс",
    "long step", "проход давлением"],
  speed_passer: ["toreando", "торичес", "тореандо", "тореадо", "торреандо", "leg drag", "лег дрег",
    "x-pass", "икс-пас", "back step", "бэкстеп", "floating", "cartwheel", "колесо", "bolo", "боло"],
  closed_guard: ["closed guard", "закрытого гарда", "закрытый гард", "из гарда", "треугольник",
    "triangle", "omoplata", "омоплата", "hip bump", "gogoplata", "гогоплата", "распашонка снизу",
    "рычаг из гарда", "гильотина из гарда"],
  open_guard: ["spider", "спайдер", "de la riva", "де ла рива", "dlr", "x-guard", "x guard", "икс-гард",
    "butterfly", "баттерфляй", "бабочк", "lasso", "лассо", "ласо", "worm", "червя", "collar sleeve",
    "shin to shin", "k-guard", "waiter", "sit up", "open guard", "открытый гард", "rubber",
    "резиновый гард", "инвертир", "single leg x", "reverse dlr", "гард снизу"],
  top_control: ["mount", "маунт", "side control", "сайд", "kesa", "кеса", "knee on belly",
    "колено на живот", "north-south", "север-юг", "americana", "американа", "ezekiel", "изекиль",
    "иезекиль", "с сайда", "с маунта", "гифт рап"],
  defense_escape: ["escape", "побег", "выход из", "самостраховка", "breakfall", "страховк",
    "разрыв захват", "grip break", "posture", "постура", "защит", "выжив", "восстанов",
    "bridge and roll", "upa", "упа", "elbow escape", "shrimp", "креветк", "hip escape", "sprawl",
    "спраул", "спраль", "возврат гарда", "recover", "уход из"],
};

const TAG_STYLE = {
  leg_locks: "leg_game", leg_locks_setup: "leg_game",
  back_take: "back_hunter", back_control: "back_hunter",
  wrestling: "wrestler", judo: "wrestler", clinch: "wrestler", standing: "wrestler",
  guard_pull: "wrestler", sacrifice_throw: "wrestler", old_school: "wrestler",
  sweep_setup: "sweeper", sweep: "sweeper", turnover: "sweeper",
  spider_guard: "open_guard", de_la_riva: "open_guard", x_guard: "open_guard",
  butterfly_guard: "open_guard", worm_guard: "open_guard", guard_retention: "open_guard",
  hooks: "open_guard", inversion: "open_guard", open_guard: "open_guard",
  closed_guard: "closed_guard",
  dominant: "top_control", side_control: "top_control", kesa_gatame: "top_control",
  defense: "defense_escape", survival: "defense_escape", recovery: "defense_escape",
  hip_escape: "defense_escape", takedown_defense: "defense_escape", counter: "defense_escape",
  safety: "defense_escape", bridge: "defense_escape", escape: "defense_escape", framing: "defense_escape",
};

const GROUP_FALLBACK = {
  guard_pass: "pressure_passer", sweep: "sweeper", takedown: "wrestler",
  escape: "defense_escape", retention: "open_guard", position: "top_control",
  transition: "top_control", submission: "top_control", system: "open_guard",
  fundamentals: "defense_escape",
};

// Определение стиля позиции по названию/тегам (без слепого top_control).
function positionBase(scores, text, tags) {
  const has = (re) => re.test(text);
  if (has(/черепах|turtle/)) {
    if (has(/снизу|защит|bottom/)) scores.defense_escape += 3;
    else scores.back_hunter += 3;
    return;
  }
  if (has(/распят|crucifix|контроль спины|со спины|на спину|back control/) || tags.has("back_control") || tags.has("back_take")) {
    scores.back_hunter += 3; return;
  }
  if (has(/закрыт.{0,4}гард|closed guard/) || tags.has("closed_guard")) { scores.closed_guard += 3; return; }
  if (has(/гард|guard|бабочк|butterfly|спайдер|spider|де ла рива|de la riva|икс-гард|x-guard|инвертир|снизу|полугвард|half.?guard|лассо|lasso/)
      || [...tags].some((t) => GUARD_TAGS.has(t))) {
    scores.open_guard += 3; return;
  }
  if (has(/маунт|mount|сайд|side|колено|knee|север-юг|north|кеса|kesa|верх|сверху|dominant/) || tags.has("dominant") || tags.has("control")) {
    scores.top_control += 3; return;
  }
  scores.top_control += 2; // мягкий фолбэк для неопознанных позиций
}

// Self-скоринг одной техники.
function selfScores(t) {
  const scores = Object.fromEntries(STYLE_IDS.map((s) => [s, 0]));
  const tags = new Set(t.tags || []);
  const text = `${t.nameRu} ${t.nameEn} ${t.label}`.toLowerCase();

  switch (t.group) {
    case "guard_pass":
      if (tags.has("speed") || tags.has("dynamic") || tags.has("no_gi_specialist")) scores.speed_passer += 3;
      else scores.pressure_passer += 3;
      break;
    case "sweep": scores.sweeper += 3; break;
    case "takedown": scores.wrestler += 3; break;
    case "escape": scores.defense_escape += 3; break;
    case "retention": scores.open_guard += 3; scores.defense_escape += 1; break;
    case "position":
    case "transition":
      positionBase(scores, text, tags);
      break;
    default: break; // submission / system / fundamentals — теги + слова (+ наследование)
  }

  // определяющие теги (leg_locks / back) весят решающе — свой сигнал не должен теряться при наследовании
  const STRONG = new Set(["leg_locks", "leg_locks_setup", "back_take", "back_control"]);
  for (const tag of tags) { const s = TAG_STYLE[tag]; if (s) scores[s] += STRONG.has(tag) ? 3 : 2; }
  if (t.group === "guard_pass") {
    if (tags.has("pressure") || tags.has("weight_distribution") || tags.has("stack")) scores.pressure_passer += 1;
    if (tags.has("speed") || tags.has("dynamic")) scores.speed_passer += 1;
  }
  for (const [style, words] of Object.entries(KW)) {
    for (const w of words) { if (text.includes(w)) { scores[style] += 2; break; } }
  }
  return scores;
}

function pick(scores, group) {
  const ranked = STYLE_IDS.map((s) => [s, scores[s]]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  let picked = ranked.filter(([, v]) => v >= 3).slice(0, 3).map(([s]) => s);
  if (picked.length === 0 && ranked.length > 0) picked = [ranked[0][0]];
  if (picked.length === 0) picked = [GROUP_FALLBACK[group] || "top_control"];
  return picked;
}

// Главный вход: считает стили для всего списка (двухпроходно).
export function deriveAllStyles(list) {
  const byId = new Map(list.map((t) => [t.id, t]));
  // Проход 1 — self
  const self = new Map();
  for (const t of list) self.set(t.id, selfScores(t));
  const selfPick = new Map();
  for (const t of list) selfPick.set(t.id, pick(self.get(t.id), t.group));

  // Проход 2 — наследование от setup_from/common_setups для приёмов из позиций
  const result = new Map();
  for (const t of list) {
    const scores = { ...self.get(t.id) };
    if (t.group === "submission" || t.group === "transition" || t.group === "system") {
      const srcIds = new Set([...(t.setup_from || []), ...(t.common_setups || [])]);
      const inh = {}; // накопитель наследования, чтобы ограничить вклад по стилю
      for (const id of srcIds) {
        const src = byId.get(id);
        if (!src || src.id === t.id) continue;
        // наследуем только позиционные стили источника (не другой сабмишн)
        if (src.group !== "position" && src.group !== "retention" && src.group !== "guard_pass") continue;
        for (const st of selfPick.get(id)) inh[st] = (inh[st] || 0) + 1;
      }
      // +1 за источник, но не больше +2 на стиль — наследование подсказывает, а не диктует
      for (const [st, n] of Object.entries(inh)) scores[st] += Math.min(n, 2);
    }
    result.set(t.id, pick(scores, t.group));
  }
  return result;
}
