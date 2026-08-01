import { Link, useRouterState } from "@tanstack/react-router";
import { Network, List, HelpCircle, BookA } from "lucide-react";
import { useProfile } from "@/lib/bjj/store";

// Переключатель внутри раздела «Техники»: Старт (только белый) · Карта · Список · Что если · Словарь.
// Ставится отдельной строкой ПОД шапкой раздела (не рядом с заголовком).
export function TechniquesTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { profile, hydrated } = useProfile();
  // «Старт» — дорожная карта для новичка, видна только на белом поясе.
  const showStarter = hydrated && profile.belt === "white";
  // На белом табов пять - иконки убираем, чтобы подписи поместились на узком экране.
  const withIcons = !showStarter;
  return (
    <div className="flex w-full rounded-full border border-border bg-card p-0.5">
      {showStarter && (
        <Tab to="/starter" active={pathname.startsWith("/starter")} icon={null} label="Старт" />
      )}
      <Tab
        to="/map"
        active={pathname.startsWith("/map")}
        icon={withIcons ? <Network className="h-3.5 w-3.5" /> : null}
        label="Карта"
      />
      <Tab
        to="/library"
        active={pathname.startsWith("/library")}
        icon={withIcons ? <List className="h-3.5 w-3.5" /> : null}
        label="Список"
      />
      <Tab
        to="/situations"
        active={pathname.startsWith("/situations")}
        icon={withIcons ? <HelpCircle className="h-3.5 w-3.5" /> : null}
        label="Что если"
      />
      <Tab
        to="/glossary"
        active={pathname.startsWith("/glossary")}
        icon={withIcons ? <BookA className="h-3.5 w-3.5" /> : null}
        label="Словарь"
      />
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
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
