import { Link, useRouterState } from "@tanstack/react-router";
import { LineChart, Layers, Dumbbell, Lightbulb } from "lucide-react";

// === BOTTOM NAV ===
// 4 вкладки. «Техники» объединяют Карту и Список (переключатель внутри).
// Прогресс — первый; профиль/настройки — в шапке (аватар).
const items = [
  { to: "/progress", label: "Прогресс", icon: LineChart, match: ["/progress"] },
  { to: "/map", label: "Техники", icon: Layers, match: ["/map", "/library", "/technique"] },
  { to: "/workout", label: "Тренировка", icon: Dumbbell, match: ["/workout"] },
  { to: "/solutions", label: "Решения", icon: Lightbulb, match: ["/solutions"] },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {items.map((it) => {
          const active = it.match.some((m) => pathname.startsWith(m));
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors"
                style={{ color: active ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
