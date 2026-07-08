import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Dumbbell, LineChart, Map, Lightbulb } from "lucide-react";

// === BOTTOM NAV ===
// Прогресс — главный экран (первая кнопка), профиль и настройки — в шапке.
const items = [
  { to: "/progress", label: "Прогресс", icon: LineChart },
  { to: "/map", label: "Карта", icon: Map },
  { to: "/library", label: "Библиотека", icon: BookOpen },
  { to: "/workout", label: "Тренировка", icon: Dumbbell },
  { to: "/solutions", label: "Решения", icon: Lightbulb },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {items.map((it) => {
          const active = pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
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
