import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { AuthModal } from "@/components/AuthModal";
import { useProfile, useProgress } from "@/lib/bjj/store";
import type { Locale } from "@/lib/bjj/types";
import { Toggle } from "@/components/bjj/ui";
import { X, Cloud, CloudOff, LogIn, LogOut, Info, ChevronRight, Download, Upload, Trash2, AlertTriangle } from "lucide-react";

// Настройки и информация: шторка по тапу на значок в шапке.
// Аккаунт (вход и синхронизация), язык, о приложении. Игровые настройки
// (пояс, формат, стиль игры) живут в листе игрока («Моя игра» -> кружок профиля).
export function AvatarMenu({ onClose }: { onClose: () => void }) {
  const { profile, update } = useProfile();
  const { progress, setProgress, clearProgress } = useProgress();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  // Управление данными (перенесено из «Моей игры»)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");

  const exportProgress = useCallback(() => {
    const data = { version: 1, exportedAt: new Date().toISOString(), progress };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bjj-progress-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [progress]);

  const importProgress = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.progress && typeof data.progress === "object") {
          setProgress(data.progress);
          setImportStatus("success");
          setTimeout(() => setImportStatus("idle"), 2000);
        } else {
          throw new Error("Invalid format");
        }
      } catch {
        setImportStatus("error");
        setTimeout(() => setImportStatus("idle"), 2000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [setProgress]);

  const handleReset = useCallback(() => {
    if (showResetConfirm) {
      clearProgress();
      setShowResetConfirm(false);
    } else {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 3000);
    }
  }, [showResetConfirm, clearProgress]);

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

          {/* Данные: экспорт / импорт / сброс прогресса */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Данные</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportProgress}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Экспорт
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition hover:bg-muted"
              >
                <Upload className="h-3.5 w-3.5" />
                {importStatus === "success" ? "Импортировано" : importStatus === "error" ? "Ошибка импорта" : "Импорт"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={importProgress}
                className="hidden"
              />
              <button
                onClick={handleReset}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  showResetConfirm
                    ? "border-destructive bg-destructive text-destructive-foreground"
                    : "border-destructive/30 bg-card text-destructive hover:bg-destructive/10"
                }`}
              >
                {showResetConfirm ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Подтвердить сброс?
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Сбросить
                  </>
                )}
              </button>
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
