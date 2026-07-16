import { Link, useRouterState } from "@tanstack/react-router";
import { Network, List, HelpCircle, BookA } from "lucide-react";

// Переключатель внутри раздела «Техники»: Карта · Список · Что если · Словарь.
// Ставится отдельной строкой ПОД шапкой раздела (не рядом с заголовком).
export function TechniquesTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex w-full rounded-full border border-border bg-card p-0.5">
      <Tab to="/map" active={pathname.startsWith("/map")} icon={<Network className="h-3.5 w-3.5" />} label="Карта" />
      <Tab to="/library" active={pathname.startsWith("/library")} icon={<List className="h-3.5 w-3.5" />} label="Список" />
      <Tab to="/situations" active={pathname.startsWith("/situations")} icon={<HelpCircle className="h-3.5 w-3.5" />} label="Что если" />
      <Tab to="/glossary" active={pathname.startsWith("/glossary")} icon={<BookA className="h-3.5 w-3.5" />} label="Словарь" />
    </div>
  );
}

function Tab({
  to,
  active,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
