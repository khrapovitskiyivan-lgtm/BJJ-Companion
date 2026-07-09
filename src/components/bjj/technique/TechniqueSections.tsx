import {
  ListOrdered,
  KeyRound,
  Clock3,
  AlertTriangle,
  Dumbbell,
  Lightbulb,
  Timer,
} from "lucide-react";

// === Парсер HTML-списков ===
function parseHtmlList(html: string): string[] {
  return html
    .split(/<br\s*\/?>/i)
    .map((s) => s.replace(/^\s*(\d+\)|•)\s*/, "").trim())
    .filter(Boolean);
}

// === МЕХАНИКА — главный акцентный блок ===
export function MechanismSection({ html }: { html: string }) {
  if (!html || !html.trim()) return null;
  const items = parseHtmlList(html);

  return (
    <section className="rounded-2xl border-l-4 border-l-primary border-y border-r border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ListOrdered className="h-4 w-4 text-primary" />
        Механика
      </h2>
      {items.length > 1 ? (
        <ol className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </div>
              <p className="flex-1 pt-0.5 text-sm leading-relaxed">{it}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm leading-relaxed">{items[0]}</p>
      )}
    </section>
  );
}

// === ИНСАЙТ — светлый акцент ===
export function InsightSection({ html }: { html: string }) {
  if (!html || !html.trim()) return null;
  const items = parseHtmlList(html);

  return (
    <section className="rounded-2xl border-l-4 border-l-primary/50 border-y border-r border-border bg-primary/5 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="h-4 w-4 text-primary" />
        Ключевые моменты
      </h2>
      {items.length > 1 ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <Lightbulb className="mt-1 h-3 w-3 shrink-0 text-primary" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed">{items[0]}</p>
      )}
    </section>
  );
}

// === НЕЙТРАЛЬНАЯ СЕКЦИЯ ===
export function NeutralSection({
  icon,
  title,
  html,
}: {
  icon: React.ReactNode;
  title: string;
  html: string;
}) {
  if (!html || !html.trim()) return null;
  const items = parseHtmlList(html);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-foreground">{icon}</span>
        {title}
      </h2>
      {items.length > 1 ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed">{items[0]}</p>
      )}
    </section>
  );
}

// === ПРЕДУПРЕЖДЕНИЕ — красный акцент ===
export function WarningSection({ html }: { html: string }) {
  if (!html || !html.trim()) return null;
  const items = parseHtmlList(html);

  return (
    <section className="rounded-2xl border-l-4 border-l-destructive border-y border-r border-destructive/20 bg-destructive/5 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        Типичные ошибки
      </h2>
      {items.length > 1 ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed">{items[0]}</p>
      )}
    </section>
  );
}

// === ПРАКТИКА — зелёный акцент ===
export function PracticeSection({ html }: { html: string }) {
  if (!html || !html.trim()) return null;
  const items = parseHtmlList(html);

  return (
    <section className="rounded-2xl border-l-4 border-l-success border-y border-r border-success/20 bg-success/5 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Dumbbell className="h-4 w-4 text-success" />
        Дриллы
      </h2>
      {items.length > 1 ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <Timer className="mt-0.5 h-3 w-3 shrink-0 text-success" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed">{items[0]}</p>
      )}
    </section>
  );
}
