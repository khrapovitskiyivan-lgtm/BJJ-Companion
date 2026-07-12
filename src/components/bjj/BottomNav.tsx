import { Link, useRouterState } from "@tanstack/react-router";
import { NotebookPen, Layers, Dumbbell } from "lucide-react";
import { ShakaIcon } from "./ShakaIcon";
import { haptic } from "@/lib/telegram";

// === BOTTOM NAV — 4 вкладки ===
// 1 Моя игра · 2 Дневник · 3 Техники (граф/список/что-если) · 4 Тренировка (генератор/сценарии)
const items = [
  { to: "/progress", label: "Моя игра", icon: ShakaIcon, match: ["/progress"] },
  { to: "/diary", label: "Дневник", icon: NotebookPen, match: ["/diary"] },
  { to: "/map", label: "Техники", icon: Layers, match: ["/map", "/library", "/technique", "/situations"] },
  { to: "/workout", label: "Тренировка", icon: Dumbbell, match: ["/workout"] },
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
                onClick={() => haptic("light")}
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
