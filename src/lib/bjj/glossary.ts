// === СЛОВАРЬ ТЕРМИНОВ ===
// Жаргон зала для увлечённых белых поясов: что говорят на тренировке и что это значит.
// Без сырых эмодзи в строках (ломают JavaScriptCore в webview Telegram).

export type GlossaryCategory =
  | "positions"
  | "control"
  | "attacks"
  | "movement"
  | "training";

export const GLOSSARY_CATEGORY_LABEL: Record<GlossaryCategory, string> = {
  positions: "Позиции",
  control: "Контроль и захваты",
  attacks: "Атаки",
  movement: "Действия и движение",
  training: "Зал, правила, сленг",
};

export const GLOSSARY_CATEGORY_ORDER: GlossaryCategory[] = [
  "positions",
  "control",
  "attacks",
  "movement",
  "training",
];

export interface GlossaryTerm {
  term: string; // как говорят в зале
  en?: string; // английский оригинал
  category: GlossaryCategory;
  definition: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  // === Позиции ===
  { term: "Гард", en: "Guard", category: "positions", definition: "Положение снизу, из которого ты контролируешь соперника ногами. Единственная нижняя позиция, которая считается рабочей, а не проигранной." },
  { term: "Закрытый гард", en: "Closed Guard", category: "positions", definition: "Гард, в котором ноги сомкнуты в замок за спиной соперника. База для свипов и сабмишенов, самая изучаемая позиция у белых поясов." },
  { term: "Открытый гард", en: "Open Guard", category: "positions", definition: "Гард без замка ног: контроль держится упорами стоп и захватами. Требует активности, зато даёт больше атак." },
  { term: "Халф-гард", en: "Half Guard", category: "positions", definition: "Ногами удерживается одна нога соперника. Промежуточная позиция между гардом и проходом." },
  { term: "Маунт", en: "Mount", category: "positions", definition: "Верхняя позиция: сидишь на корпусе соперника. Одна из самых доминирующих, 4 очка по IBJJF." },
  { term: "Сайд-контроль", en: "Side Control", category: "positions", definition: "Контроль сверху поперёк корпуса соперника. Стабильная позиция, из неё идут переходы в маунт и колено на животе." },
  { term: "Север-юг", en: "North-South", category: "positions", definition: "Контроль сверху, когда головы направлены в противоположные стороны." },
  { term: "Колено на животе", en: "Knee on Belly", category: "positions", definition: "Контроль сверху с коленом на корпусе. Даёт давление и мобильность, 2 очка по IBJJF." },
  { term: "Спина, бэк", en: "Back Control", category: "positions", definition: "Контроль со спины соперника с крюками ногами. Лучшая позиция в BJJ: атакуешь, оставаясь недосягаемым." },
  { term: "Черепаха", en: "Turtle", category: "positions", definition: "Защитное положение на четвереньках с прижатыми локтями. Не проигрыш, но соперник охотится за спиной." },
  { term: "Баттерфляй", en: "Butterfly Guard", category: "positions", definition: "Открытый гард с крюками стоп под бёдрами соперника. Заточен под свипы с подъёмом." },
  { term: "Де ла Рива", en: "De La Riva", category: "positions", definition: "Открытый гард с крюком, оплетающим ногу соперника снаружи. Основа современной игры в кимоно." },
  { term: "X-гард", en: "X-Guard", category: "positions", definition: "Гард снизу, где ноги скрещены под ногой стоящего соперника. Мощные свипы за счёт разрушения баланса." },
  { term: "Паук-гард", en: "Spider Guard", category: "positions", definition: "Гард с упором стоп в бицепсы и захватом рукавов. Работает только в кимоно." },
  { term: "50/50", category: "positions", definition: "Симметричный гард с переплетением ног, где позиция одинакова для обоих. Частая точка входа в ножные замки." },
  { term: "Фронт-хедлок", en: "Front Headlock", category: "positions", definition: "Контроль головы и руки спереди. Отсюда идут гильотина, дарс и анаконда." },

  // === Контроль и захваты ===
  { term: "Захват, грип", en: "Grip", category: "control", definition: "Хват за кимоно или за тело. Борьба за захваты часто решает исход обмена ещё до техники." },
  { term: "Кросс-фейс", en: "Cross Face", category: "control", definition: "Давление предплечьем на лицо и шею, разворачивающее голову соперника. Ключ к тяжёлому сайд-контролю." },
  { term: "Андерхук", en: "Underhook", category: "control", definition: "Рука продета снизу под руку соперника. Даёт контроль корпуса и вход в проходы." },
  { term: "Оверхук", en: "Overhook", category: "control", definition: "Рука поверх руки соперника. Основа атак из закрытого гарда, например омоплаты." },
  { term: "Крюк", en: "Hook", category: "control", definition: "Стопа или голень, зацепляющая соперника изнутри. На спине два крюка удерживают позицию." },
  { term: "Боди-триангл", en: "Body Triangle", category: "control", definition: "Замок ног треугольником вокруг корпуса при контроле спины. Держится крепче крюков, но снижает мобильность." },
  { term: "Фрейм", en: "Frame", category: "control", definition: "Костная распорка руками или ногами, создающая место. Работает на скелете, а не на силе мышц, поэтому не устаёт." },

  // === Атаки ===
  { term: "Сабмишн", en: "Submission", category: "attacks", definition: "Болевой или удушающий приём, заставляющий соперника сдаться." },
  { term: "Тап", en: "Tap", category: "attacks", definition: "Сигнал сдачи: хлопок по сопернику, по татами или голосом. Стучи рано, здоровье дороже раунда." },
  { term: "Рычаг локтя, армбар", en: "Armbar", category: "attacks", definition: "Разгибание локтя через свои бёдра. Базовый сабмишн, доступен из гарда, маунта и спины." },
  { term: "Кимура", en: "Kimura", category: "attacks", definition: "Узел плеча с вращением руки внутрь. Работает и как контроль, и как перевод." },
  { term: "Американа", en: "Americana", category: "attacks", definition: "Узел плеча с вращением наружу. Классика из маунта и сайд-контроля." },
  { term: "Треугольник", en: "Triangle Choke", category: "attacks", definition: "Удушение ногами, замкнутыми вокруг шеи и одной руки соперника." },
  { term: "Гильотина", en: "Guillotine", category: "attacks", definition: "Удушение шеи спереди руками. Частый ответ на неаккуратный проход в ноги." },
  { term: "Удушение сзади", en: "Rear Naked Choke, RNC", category: "attacks", definition: "Удушение со спины предплечьем без захвата за кимоно. Самый надёжный финиш в BJJ." },
  { term: "Крестовое удушение", en: "Cross Collar Choke", category: "attacks", definition: "Удушение отворотами кимоно накрест. Только в ги." },
  { term: "Дарс", en: "D'Arce", category: "attacks", definition: "Удушение рукой, продетой под подмышку, с замыканием вокруг шеи. Идёт из фронт-хедлока." },
  { term: "Анаконда", en: "Anaconda", category: "attacks", definition: "Удушение спереди через подмышку с прокатом. Родственник дарса, но рука заходит с другой стороны." },
  { term: "Хилхук", en: "Heel Hook", category: "attacks", definition: "Скручивание пятки, атакующее связки колена. Высокий риск: боль приходит позже травмы, стучи заранее. В ги по IBJJF запрещён." },
  { term: "Футлок", en: "Straight Ankle Lock", category: "attacks", definition: "Рычаг ахилла, разгибание стопы. Разрешён белым поясам, в отличие от большинства ножных замков." },
  { term: "Омоплата", en: "Omoplata", category: "attacks", definition: "Узел плеча, выполняемый ногами. Даже без финиша даёт свип или переход." },

  // === Действия и движение ===
  { term: "Свип", en: "Sweep", category: "movement", definition: "Переворот соперника из нижней позиции в верхнюю. 2 очка по IBJJF." },
  { term: "Проход гарда", en: "Guard Pass", category: "movement", definition: "Обход ног соперника для выхода в контроль сверху. 3 очка по IBJJF." },
  { term: "Тейкдаун", en: "Takedown", category: "movement", definition: "Перевод соперника из стойки в партер. 2 очка по IBJJF." },
  { term: "Эскейп", en: "Escape", category: "movement", definition: "Выход из невыгодной позиции. Первое, чему стоит учиться: спасает раунды чаще, чем атаки." },
  { term: "Ретеншн", en: "Guard Retention", category: "movement", definition: "Удержание гарда, когда соперник пытается пройти. Работа бёдрами и фреймами." },
  { term: "Креветка, хип-эскейп", en: "Shrimp, Hip Escape", category: "movement", definition: "Базовое движение: отталкиваешься и уводишь бёдра в сторону, создавая место. Есть почти в каждой разминке." },
  { term: "Бридж, апа", en: "Bridge, Upa", category: "movement", definition: "Мост через бёдра для сброса соперника сверху. Основа выхода из маунта." },
  { term: "Спрол", en: "Sprawl", category: "movement", definition: "Защита от прохода в ноги: бёдра вниз, ноги назад." },
  { term: "Скрембл", en: "Scramble", category: "movement", definition: "Динамичный обмен, где никто не контролирует позицию. Решает скорость и понимание, куда двигаться." },
  { term: "Технический подъём", en: "Technical Stand Up", category: "movement", definition: "Безопасный подъём на ноги с опорой на руку, не открывая себя. База самообороны." },
  { term: "Бэйс", en: "Base", category: "movement", definition: "Устойчивость и опора. Потерял бэйс, значит тебя свипнут." },
  { term: "Постура", en: "Posture", category: "movement", definition: "Прямая осанка с выпрямленной спиной. В чужом гарде это главная защита от удушений и армбаров." },
  { term: "Позиция перед приёмом", en: "Position before submission", category: "movement", definition: "Базовый принцип: сначала закрепи контроль, потом атакуй. Спешка с приёмом возвращает соперника в игру." },

  // === Зал, правила, сленг ===
  { term: "Ги, кимоно", en: "Gi", category: "training", definition: "Форма для тренировок: куртка, штаны и пояс. Захваты за ткань меняют игру и замедляют темп." },
  { term: "Но-ги", en: "No-Gi", category: "training", definition: "Борьба без кимоно, в рашгарде и шортах. Быстрее, захваты только за тело." },
  { term: "Ролл, спарринг", en: "Roll", category: "training", definition: "Свободный спарринг. Основная часть тренировки и главный источник прогресса." },
  { term: "Дрилл", en: "Drill", category: "training", definition: "Повторение техники без сопротивления для закрепления движения." },
  { term: "Оссу", en: "Oss", category: "training", definition: "Универсальное слово в зале: приветствие, согласие, подтверждение. Отношение к нему в залах разное." },
  { term: "Страйп", en: "Stripe", category: "training", definition: "Полоска на поясе, промежуточная ступень между поясами. Обычно их четыре." },
  { term: "IBJJF", category: "training", definition: "Международная федерация BJJ. Задаёт основной свод правил и систему очков в кимоно." },
  { term: "ADCC", category: "training", definition: "Крупнейший турнир по грэпплингу без кимоно. Свои правила: очки идут не сразу, разрешено больше ножных замков." },
];
