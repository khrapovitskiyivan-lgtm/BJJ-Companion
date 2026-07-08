import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BottomNav } from "./BottomNav";
import { Onboarding } from "./Onboarding";
import { useProfile } from "@/lib/bjj/store";
import { Info, Moon, Sun } from "lucide-react";

// === APP SHELL ===
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { profile, update, hydrated } = useProfile();

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", profile.theme === "dark");
  }, [profile.theme, hydrated]);

  if (!hydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!profile.onboardingDone) {
    return <Onboarding onDone={(p) => update({ ...p, onboardingDone: true })} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-md ring-2 ring-black/10"
              style={{ background: `var(--belt-${profile.belt})` }}
              aria-hidden
            />
            <span className="text-sm font-semibold tracking-tight">
              BJJ Companion
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              to="/about"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              aria-label="О приложении"
            >
              <Info className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => update({ theme: profile.theme === "dark" ? "light" : "dark" })}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              aria-label="Переключить тему"
            >
              {profile.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 py-4 ${wide ? "max-w-6xl" : "max-w-xl"}`}>{children}</main>
      <BottomNav />
    </div>
  );
}
