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

// Позиции-ситуации «Что делать, если…». Лейблы по ролевой схеме (играю/прохожу/держу/под),
// как названия позиций — без «сверху/снизу». В список берём только позиции с непустыми вариантами.
const SITUATIONS: { id: number; label: string; group: string }[] = [
  // Игра гарда (ты снизу, атакуешь)
  { id: 1, label: "Я играю закрытый гард", group: "Игра гарда" },
  { id: 3, label: "Я играю халф-гард", group: "Игра гарда" },
  { id: 5, label: "Я играю баттерфляй", group: "Игра гарда" },
  { id: 7, label: "Я играю спайдер-гард", group: "Игра гарда" },
  { id: 8, label: "Я играю Де-ла-Риву", group: "Игра гарда" },
  { id: 9, label: "Я играю обратный Де-ла-Рива", group: "Игра гарда" },
  { id: 10, label: "Я играю X-гард", group: "Игра гарда" },
  { id: 11, label: "Я в гарде 50/50", group: "Игра гарда" },
  { id: 12, label: "Я играю дип халф-гард", group: "Игра гарда" },
  { id: 301, label: "Я играю воротник-рукав", group: "Игра гарда" },
  { id: 302, label: "Я играю ворм-гард", group: "Игра гарда" },
  { id: 380, label: "Я играю раббер-гард", group: "Игра гарда" },
  { id: 381, label: "Я держу коленный щит", group: "Игра гарда" },
  { id: 441, label: "Я играю обратный халф-гард", group: "Игра гарда" },
  { id: 630, label: "Я играю K-гард", group: "Игра гарда" },
  { id: 647, label: "Я в локдауне", group: "Игра гарда" },
  { id: 648, label: "Я играю шин-ту-шин", group: "Игра гарда" },
  // Проход гарда (ты сверху, проходишь)
  { id: 2, label: "Я прохожу закрытый гард", group: "Проход гарда" },
  { id: 4, label: "Я прохожу халф-гард", group: "Проход гарда" },
  { id: 6, label: "Я прохожу баттерфляй", group: "Проход гарда" },
  { id: 444, label: "Я прохожу спайдер-гард", group: "Проход гарда" },
  { id: 445, label: "Я прохожу Де-ла-Риву", group: "Проход гарда" },
  { id: 446, label: "Я прохожу ворм-гард", group: "Проход гарда" },
  { id: 666, label: "Я прохожу обратный Де-ла-Рива", group: "Проход гарда" },
  { id: 667, label: "Я прохожу X-гард", group: "Проход гарда" },
  { id: 668, label: "Я прохожу дип халф-гард", group: "Проход гарда" },
  // Ножные позиции
  { id: 300, label: "Я в Сингл Лег Икс", group: "Ножные позиции" },
  { id: 305, label: "Я в аши-гарами", group: "Ножные позиции" },
  { id: 367, label: "Я в заднем аши-гарами", group: "Ножные позиции" },
  { id: 440, label: "Я в седле (ханихол)", group: "Ножные позиции" },
  { id: 635, label: "Я в бэксайд 50/50", group: "Ножные позиции" },
  // Доминирующие позиции
  { id: 14, label: "Я держу сайд-контроль", group: "Доминирующие позиции" },
  { id: 13, label: "Я под сайд-контролем", group: "Доминирующие позиции" },
  { id: 16, label: "Я держу маунт", group: "Доминирующие позиции" },
  { id: 15, label: "Я под маунтом", group: "Доминирующие позиции" },
  { id: 649, label: "Я держу S-маунт", group: "Доминирующие позиции" },
  { id: 437, label: "Я держу обратный маунт", group: "Доминирующие позиции" },
  { id: 24, label: "Я держу колено на животе", group: "Доминирующие позиции" },
  { id: 25, label: "Я под коленом на животе", group: "Доминирующие позиции" },
  { id: 22, label: "Я держу север-юг", group: "Доминирующие позиции" },
  { id: 23, label: "Я под север-югом", group: "Доминирующие позиции" },
  { id: 366, label: "Я держу кеса-гатаме", group: "Доминирующие позиции" },
  { id: 438, label: "Я держу борцовское удержание", group: "Доминирующие позиции" },
  { id: 346, label: "Я держу распятие", group: "Доминирующие позиции" },
  // Спина и черепаха
  { id: 17, label: "Я контролирую спину", group: "Спина и черепаха" },
  { id: 632, label: "Я держу боди-триангл", group: "Спина и черепаха" },
  { id: 18, label: "Соперник взял мою спину", group: "Спина и черепаха" },
  { id: 19, label: "Соперник в черепахе", group: "Спина и черепаха" },
  { id: 20, label: "Я в черепахе", group: "Спина и черепаха" },
  { id: 610, label: "Я во фронт-хедлоке", group: "Спина и черепаха" },
  // Стойка
  { id: 21, label: "Мы в стойке", group: "Стойка" },
];

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
            {SITUATIONS.find((s) => s.id === situationId)?.label ?? situation.nameRu}
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
  const groups = [...new Set(SITUATIONS.map((s) => s.group))];

  return (
    <div className="space-y-4">
      <p className="px-1 text-xs text-muted-foreground">
        Выберите позицию — покажем, что из неё делать: атаки, свипы, переходы и выходы.
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
      {groups.map((g) => {
        const items = SITUATIONS.filter((s) => s.group === g && (!q || s.label.toLowerCase().includes(q)));
        if (!items.length) return null;
        return (
          <section key={g}>
            <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{g}</h3>
            <div className="grid grid-cols-2 gap-2">
              {items.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate({ search: { s: s.id } })}
                  className="rounded-xl border border-border bg-card p-3 text-left text-xs font-medium transition hover:bg-muted"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
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
