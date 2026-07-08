import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthModal } from "@/components/AuthModal";
import { LogIn, LogOut, User, Menu, X } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { to: "/", label: "Главная" },
  { to: "/map", label: "Карта" },
  { to: "/library", label: "Библиотека" },
  { to: "/progress", label: "Прогресс" },
  { to: "/training", label: "Тренировка" },
  { to: "/solutions", label: "Решения" },
];

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const [user, setUser] = useState<null | { id: string; email: string | undefined }>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Подписка на состояние аутентификации
  useEffect(() => {
    // Получаем текущего пользователя при монтировании
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id, email: user.email });
      }
    });

    // Подписываемся на изменения состояния
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    // Не перезагружаем страницу — просто обновляем UI
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Шапка */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {/* Логотип */}
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">B</span>
            </div>
            <span className="text-sm font-bold tracking-tight sm:text-base">BJJ Companion</span>
          </Link>

          {/* Навигация (десктоп) */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  isActive(item.to)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Блок аутентификации */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 sm:flex">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="max-w-[140px] truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  title="Выйти"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Выйти</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Войти</span>
              </button>
            )}

            {/* Мобильное меню */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted md:hidden"
              aria-label="Меню"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Мобильная навигация */}
        {mobileMenuOpen && (
          <nav className="border-t border-border bg-card px-4 py-2 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive(item.to)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Основной контент */}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      {/* Футер */}
      <footer className="border-t border-border bg-card/50 py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          <p>BJJ Companion · Интерактивная карта техник бразильского джиу-джитсу</p>
          {user && (
            <p className="mt-1 text-[10px]">
              ✅ Прогресс синхронизируется с облаком
            </p>
          )}
        </div>
      </footer>

      {/* Модальное окно аутентификации */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
