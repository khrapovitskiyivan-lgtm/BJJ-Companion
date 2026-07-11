import { Link, useRouterState } from "@tanstack/react-router";
import { Network, List, HelpCircle } from "lucide-react";

// Переключатель внутри раздела «Техники»: Карта (граф) · Список · Что если.
export function TechniquesTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-0.5">
      <Tab to="/map" active={pathname.startsWith("/map")} icon={<Network className="h-3.5 w-3.5" />} label="Карта" />
      <Tab to="/library" active={pathname.startsWith("/library")} icon={<List className="h-3.5 w-3.5" />} label="Список" />
      <Tab to="/situations" active={pathname.startsWith("/situations")} icon={<HelpCircle className="h-3.5 w-3.5" />} label="Что если" />
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
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
