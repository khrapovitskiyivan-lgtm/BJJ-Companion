import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniquesTabs } from "@/components/bjj/TechniquesTabs";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { PageHeader } from "@/components/bjj/ui";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import type { Technique } from "@/lib/bjj/types";
import { ArrowLeft, Search } from "lucide-react";

export const Route = createFileRoute("/situations")({
  component: SituationsPage,
  // Выбранная ситуация в search-параметре: переживает уход на карточку техники и возврат назад
  validateSearch: (search: Record<string, unknown>): { s?: number } => {
    const s = Number(search.s);
    return Number.isFinite(s) && s > 0 ? { s } : {};
  },
});

// Позиции-ситуации «Что если…». Каждая позиция — строка; две роли (моя сторона /
// сторона соперника) стоят колонками друг напротив друга. Одиночные позиции показывают
// одну кнопку на своей стороне (напротив пусто, без прочерка = фактический пробел
// закрыт карточками). Глаголы по ролевой схеме названий позиций.
type Slot = { id: number; verb: string };
type Pos = { name: string; play?: Slot; vs?: Slot };

const BLOCKS: Pos[][] = [
  // Гарды: моя игра (снизу) / проход (сверху)
  [
    { name: "Закрытый гард", play: { id: 1, verb: "Играю" }, vs: { id: 2, verb: "Прохожу" } },
    { name: "Халф-гард", play: { id: 3, verb: "Играю" }, vs: { id: 4, verb: "Прохожу" } },
    { name: "Баттерфляй", play: { id: 5, verb: "Играю" }, vs: { id: 6, verb: "Прохожу" } },
    { name: "Спайдер-гард", play: { id: 7, verb: "Играю" }, vs: { id: 444, verb: "Прохожу" } },
    { name: "Де-ла-Рива", play: { id: 8, verb: "Играю" }, vs: { id: 445, verb: "Прохожу" } },
    { name: "Обратный ДЛР", play: { id: 9, verb: "Играю" }, vs: { id: 666, verb: "Прохожу" } },
    { name: "X-гард", play: { id: 10, verb: "Играю" }, vs: { id: 667, verb: "Прохожу" } },
    { name: "Дип халф-гард", play: { id: 12, verb: "Играю" }, vs: { id: 668, verb: "Прохожу" } },
    { name: "Ворм-гард", play: { id: 302, verb: "Играю" }, vs: { id: 446, verb: "Прохожу" } },
    { name: "Воротник-рукав", play: { id: 301, verb: "Играю" }, vs: { id: 669, verb: "Прохожу" } },
    { name: "Раббер-гард", play: { id: 380, verb: "Играю" }, vs: { id: 670, verb: "Прохожу" } },
    { name: "Шин-ту-шин", play: { id: 648, verb: "Играю" }, vs: { id: 671, verb: "Прохожу" } },
    { name: "Обратный халф-гард", play: { id: 441, verb: "Играю" }, vs: { id: 672, verb: "Прохожу" } },
    { name: "K-гард", play: { id: 630, verb: "Играю" }, vs: { id: 673, verb: "Прохожу" } },
    { name: "Гард 50/50", play: { id: 11, verb: "Играю" } },
    { name: "Коленный щит", play: { id: 381, verb: "Играю" } },
    { name: "Локдаун", play: { id: 647, verb: "Играю" } },
  ],
  // Доминирующие: держу (сверху) / под (снизу)
  [
    { name: "Сайд-контроль", play: { id: 14, verb: "Держу" }, vs: { id: 13, verb: "Под" } },
    { name: "Маунт", play: { id: 16, verb: "Держу" }, vs: { id: 15, verb: "Под" } },
    { name: "Колено на животе", play: { id: 24, verb: "Держу" }, vs: { id: 25, verb: "Под" } },
    { name: "Север-юг", play: { id: 22, verb: "Держу" }, vs: { id: 23, verb: "Под" } },
    { name: "S-маунт", play: { id: 649, verb: "Держу" }, vs: { id: 674, verb: "Под" } },
    { name: "Обратный маунт", play: { id: 437, verb: "Держу" }, vs: { id: 675, verb: "Под" } },
    { name: "Кеса-гатаме", play: { id: 366, verb: "Держу" }, vs: { id: 676, verb: "Под" } },
    { name: "Борцовское удержание", play: { id: 438, verb: "Держу" }, vs: { id: 677, verb: "Под" } },
    { name: "Распятие", play: { id: 346, verb: "Держу" }, vs: { id: 678, verb: "Под" } },
  ],
  // Спина и черепаха
  [
    { name: "Спина", play: { id: 17, verb: "Держу" }, vs: { id: 18, verb: "Защита" } },
    { name: "Черепаха", play: { id: 19, verb: "Атакую" }, vs: { id: 20, verb: "Защита" } },
    { name: "Боди-триангл", play: { id: 632, verb: "Держу" } },
    { name: "Фронт-хедлок", vs: { id: 610, verb: "Защита" } },
  ],
  // Ножные позиции (сплетения — одна сторона)
  [
    { name: "Сингл Лег Икс", play: { id: 300, verb: "Атакую" } },
    { name: "Аши-гарами", play: { id: 305, verb: "Атакую" } },
    { name: "Задний аши-гарами", play: { id: 367, verb: "Атакую" } },
    { name: "Седло (ханихол)", play: { id: 440, verb: "Атакую" } },
    { name: "Бэксайд 50/50", play: { id: 635, verb: "Атакую" } },
  ],
  // Стойка
  [{ name: "Стойка", play: { id: 21, verb: "Начать" } }],
];

// id -> подпись для шапки детали ситуации
const SLOT_LABEL: Record<number, string> = {};
for (const block of BLOCKS)
  for (const p of block) {
    if (p.play) SLOT_LABEL[p.play.id] = `${p.name}: ${p.play.verb.toLowerCase()}`;
    if (p.vs) SLOT_LABEL[p.vs.id] = `${p.name}: ${p.vs.verb.toLowerCase()}`;
  }

const GRID = "grid grid-cols-[1fr_74px_74px] gap-x-2";

function SituationsPage() {
  return (
    <AppShell>
      <div className="space-y-3">
        <PageHeader kicker="Разбор ситуаций" title="Что если…" className="px-1" />
        <TechniquesTabs />
        <Decide />
      </div>
    </AppShell>
  );
}

function Decide() {
  const { s: situationParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const situationId = situationParam ?? null;
  const [query, setQuery] = useState("");
  const situation = situationId != null ? TECH_BY_ID[situationId] : null;
  const go = (id: number) => navigate({ search: { s: id } });

  const options = useMemo(() => {
    if (situationId == null) return null;
    const out: Record<string, Technique[]> = { attacks: [], sweeps: [], transitions: [], escapes: [] };
    const src = TECH_BY_ID[situationId];
    if (!src) return out;
    const targets = new Set<number>(src.chain_to);
    for (const t of TECHNIQUES) if (t.setup_from.includes(situationId)) targets.add(t.id);
    for (const id of targets) {
      const t = TECH_BY_ID[id];
      if (!t || t.id === situationId) continue;
      if (t.group === "submission" || t.group === "guard_pass" || t.group === "takedown") out.attacks.push(t);
      else if (t.group === "sweep") out.sweeps.push(t);
      else if (t.group === "escape" || t.group === "retention") out.escapes.push(t);
      else out.transitions.push(t);
    }
    return out;
  }, [situationId]);

  if (situation && options) {
    const empty =
      !options.attacks.length && !options.sweeps.length && !options.transitions.length && !options.escapes.length;
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate({ search: {} })}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          К ситуациям
        </button>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Ваша ситуация</p>
          <h2 className="mt-0.5 text-base font-semibold">
            {(situationId != null && SLOT_LABEL[situationId]) || situation.nameRu}
          </h2>
        </div>
        {empty ? (
          <p className="px-1 text-xs text-muted-foreground">Для этой позиции пока нет размеченных вариантов.</p>
        ) : (
          <>
            <OptionSection title="Атаки" items={options.attacks} />
            <OptionSection title="Свипы" items={options.sweeps} />
            <OptionSection title="Переходы" items={options.transitions} />
            <OptionSection title="Выходы и защита" items={options.escapes} />
          </>
        )}
      </div>
    );
  }

  const q = query.trim().toLowerCase();

  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-muted-foreground">
        Выбери позицию и сторону, покажем, что из неё делать: атаки, свипы, переходы и выходы.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти позицию…"
          className="w-full rounded-xl border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className={`${GRID} px-1 text-[10px] uppercase tracking-widest text-muted-foreground`}>
        <span>Позиция</span>
        <span />
        <span />
      </div>
      {BLOCKS.map((block, bi) => {
        const rows = block.filter((p) => !q || p.name.toLowerCase().includes(q));
        if (!rows.length) return null;
        return (
          <div key={bi} className="space-y-1.5 border-t border-border pt-2.5 first:border-t-0 first:pt-0">
            {rows.map((p) => (
              <div key={p.name} className={`${GRID} items-center px-1`}>
                <span className="pr-1 text-[13px] leading-tight">{p.name}</span>
                {p.play ? <RoleBtn slot={p.play} onGo={go} /> : <span />}
                {p.vs ? <RoleBtn slot={p.vs} onGo={go} /> : <span />}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function RoleBtn({ slot, onGo }: { slot: Slot; onGo: (id: number) => void }) {
  return (
    <button
      onClick={() => onGo(slot.id)}
      className="rounded-lg border border-border bg-card px-1 py-2 text-center text-xs font-medium text-primary transition hover:bg-muted"
    >
      {slot.verb}
    </button>
  );
}

function OptionSection({ title, items }: { title: string; items: Technique[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">
        {title} <span className="text-muted-foreground">({items.length})</span>
      </h3>
      <ul className="space-y-1.5">
        {items.map((t) => (
          <li key={t.id}>
            <TechniqueRow technique={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}
