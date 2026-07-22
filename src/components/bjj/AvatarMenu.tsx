import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { AuthModal } from "@/components/AuthModal";
import { CONSENT_VERSION, useProfile, useProgress } from "@/lib/bjj/store";
import type { Locale } from "@/lib/bjj/types";
import { Button, Section, Sheet, Toggle } from "@/components/bjj/ui";
import { Cloud, CloudOff, LogIn, LogOut, Info, ChevronRight, Download, Upload, Trash2, AlertTriangle, ShieldCheck, FileText } from "lucide-react";

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

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <>
      <Sheet
        title="Настройки"
        subtitle={
          user ? (
            <span className="inline-flex items-center gap-1 text-status-done">
              <Cloud className="h-3 w-3" /> синхронизируется
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <CloudOff className="h-3 w-3" /> только на устройстве
            </span>
          )
        }
        onClose={onClose}
      >
        <Section title="Аккаунт">
          {user ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
              <p className="min-w-0 truncate text-sm font-medium">{user.email}</p>
              <Button variant="secondary" size="sm" onClick={logout} className="shrink-0 text-muted-foreground">
                <LogOut className="h-3.5 w-3.5" />
                Выйти
              </Button>
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
        </Section>

        <Section title="Язык">
          <div className="grid grid-cols-2 gap-2">
            <Toggle label="Русский" active={profile.locale === "ru"} onClick={() => update({ locale: "ru" as Locale })} />
            <Toggle label="English" active={profile.locale === "en"} onClick={() => update({ locale: "en" as Locale })} />
          </div>
        </Section>

        {/* Данные: экспорт / импорт / сброс прогресса */}
        <Section title="Данные">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={exportProgress}>
              <Download className="h-3.5 w-3.5" />
              Экспорт
            </Button>
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              {importStatus === "success" ? "Импортировано" : importStatus === "error" ? "Ошибка импорта" : "Импорт"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={importProgress}
              className="hidden"
            />
            {/* Подтверждение сбрасывается по таймеру, поэтому заливка вместо рамки */}
            <Button
              variant="danger"
              size="sm"
              onClick={handleReset}
              className={showResetConfirm ? "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive" : undefined}
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
            </Button>
          </div>
        </Section>

        {/* Конфиденциальность: режим отправки данных + документы */}
        <Section title="Конфиденциальность">
          <div className="rounded-2xl border border-border bg-card p-3">
            {profile.consentChoice === "accepted" ? (
              <>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-status-done" />
                  Отправка данных включена
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Синхронизация, статистика и напоминания работают.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => update({ consentChoice: "local", consentVersion: CONSENT_VERSION })}
                >
                  Перейти в локальный режим
                </Button>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CloudOff className="h-4 w-4 text-muted-foreground" />
                  Локальный режим
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Данные не отправляются на сервер. Синхронизация, статистика и
                  напоминания недоступны.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-2"
                  onClick={() => update({ consentChoice: "accepted", consentVersion: CONSENT_VERSION })}
                >
                  Включить синхронизацию и статистику
                </Button>
              </>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link
              to="/privacy"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-card p-3 text-xs font-medium transition hover:bg-muted"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Политика
            </Link>
            <Link
              to="/terms"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-card p-3 text-xs font-medium transition hover:bg-muted"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              Условия
            </Link>
          </div>
        </Section>

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
      </Sheet>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
