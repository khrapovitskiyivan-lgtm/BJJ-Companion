import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { AuthModal } from "@/components/AuthModal";
import { useProfile } from "@/lib/bjj/store";
import type { Locale } from "@/lib/bjj/types";
import { X, Cloud, CloudOff, LogIn, LogOut, Info, ChevronRight } from "lucide-react";

// Настройки и информация: шторка по тапу на значок в шапке.
// Аккаунт (вход и синхронизация), язык, о приложении. Игровые настройки
// (пояс, формат, стиль игры) живут в листе игрока («Моя игра» -> кружок профиля).
export function AvatarMenu({ onClose }: { onClose: () => void }) {
  const { profile, update } = useProfile();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ email: data.user.email });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { email: session.user.email } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Esc закрывает
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Закрыть" onClick={onClose} />

      <div className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:rounded-3xl">
        {/* Шапка */}
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold tracking-tight">Настройки</p>
            <p className="text-xs text-muted-foreground">
              {user ? (
                <span className="inline-flex items-center gap-1 text-status-done">
                  <Cloud className="h-3 w-3" /> синхронизируется
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <CloudOff className="h-3 w-3" /> только на устройстве
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* Аккаунт */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Аккаунт</h3>
            {user ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
                <p className="min-w-0 truncate text-sm font-medium">{user.email}</p>
                <button
                  onClick={logout}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Выйти
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:bg-muted"
              >
                <span className="text-sm font-medium">Войти — синхронизировать прогресс</span>
                <LogIn className="h-4 w-4 shrink-0 text-primary" />
              </button>
            )}
          </section>

          {/* Язык */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Язык</h3>
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Русский" active={profile.locale === "ru"} onClick={() => update({ locale: "ru" as Locale })} />
              <Toggle label="English" active={profile.locale === "en"} onClick={() => update({ locale: "en" as Locale })} />
            </div>
          </section>

          {/* О приложении */}
          <Link
            to="/about"
            onClick={onClose}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:bg-muted"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-primary" />
              О приложении · Как пользоваться
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border-2 p-2.5 text-sm font-medium transition-all"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        background: active ? "color-mix(in oklch, var(--color-primary) 10%, var(--color-card))" : "var(--color-card)",
      }}
    >
      {label}
    </button>
  );
}
