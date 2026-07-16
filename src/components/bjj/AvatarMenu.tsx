import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { AuthModal } from "@/components/AuthModal";
import { useProfile, useProgress } from "@/lib/bjj/store";
import { initials } from "@/components/bjj/AppShell";
import { TECHNIQUES } from "@/lib/bjj/data";
import { BELT_LABEL, BELT_ORDER, STYLE_ORDER, STYLE_META } from "@/lib/bjj/constants";
import { STYLE_ICONS } from "@/lib/bjj/styleIcons";
import type { Belt, Locale, Style } from "@/lib/bjj/types";
import { X, Cloud, CloudOff, LogIn, LogOut, Info, ChevronRight, BarChart3, Check, BookA } from "lucide-react";

// Шторка по тапу на аватар: статистика · настройки · о приложении.
export function AvatarMenu({ onClose }: { onClose: () => void }) {
  const { profile, update } = useProfile();
  const { progress } = useProgress();
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

  const total = TECHNIQUES.length;
  const done = TECHNIQUES.filter((t) => progress[t.id] === "done").length;
  const inProgress = TECHNIQUES.filter((t) => progress[t.id] === "in_progress").length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Закрыть" onClick={onClose} />

      <div className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:rounded-3xl">
        {/* ручка + шапка */}
        <div className="flex items-center gap-3 border-b border-border p-4">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="block h-12 w-12 shrink-0 rounded-full object-cover ring-2"
              style={{ boxShadow: `0 0 0 2px var(--belt-${profile.belt})` }}
            />
          ) : profile.name ? (
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-base font-bold text-white ring-2 ring-border"
              style={{ background: `var(--belt-${profile.belt})` }}
            >
              {initials(profile.name)}
            </span>
          ) : (
            <span
              className="block h-12 w-12 shrink-0 rounded-full ring-2 ring-border"
              style={{ background: `var(--belt-${profile.belt})` }}
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold tracking-tight">
              {profile.name || `${BELT_LABEL[profile.belt]} пояс`}
            </p>
            <p className="text-xs text-muted-foreground">
              {profile.name ? `${BELT_LABEL[profile.belt]} пояс · ` : ""}
              {profile.gi && profile.noGi ? "Gi + No-Gi" : profile.gi ? "Gi" : "No-Gi"}
              {user ? (
                <span className="ml-1 inline-flex items-center gap-1 text-status-done">
                  · <Cloud className="h-3 w-3" /> синхронизируется
                </span>
              ) : (
                <span className="ml-1 inline-flex items-center gap-1">
                  · <CloudOff className="h-3 w-3" /> только на устройстве
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
          {/* Статистика */}
          <section>
            <div className="grid grid-cols-3 gap-2">
              <Stat value={`${done}`} sub={`из ${total}`} label="Изучено" />
              <Stat value={`${inProgress}`} label="В процессе" />
              <Stat value={`${pct}%`} label="Прогресс" />
            </div>
            <Link
              to="/progress"
              onClick={onClose}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Вся статистика — «Моя игра»
            </Link>
          </section>

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

          {/* Настройки: пояс */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Пояс</h3>
            <div className="grid grid-cols-5 gap-2">
              {BELT_ORDER.map((b: Belt) => (
                <button
                  key={b}
                  onClick={() => update({ belt: b })}
                  className="flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all"
                  style={{
                    borderColor: profile.belt === b ? "var(--color-primary)" : "var(--color-border)",
                    background:
                      profile.belt === b
                        ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))"
                        : "var(--color-card)",
                  }}
                >
                  <span className="block h-4 w-8 rounded ring-1 ring-black/10" style={{ background: `var(--belt-${b})` }} />
                  <span className="text-[10px] font-medium">{BELT_LABEL[b]}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Настройки: формат */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Формат тренировок</h3>
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Gi (в кимоно)" active={profile.gi} onClick={() => (profile.noGi || !profile.gi) && update({ gi: !profile.gi })} />
              <Toggle label="No-Gi" active={profile.noGi} onClick={() => (profile.gi || !profile.noGi) && update({ noGi: !profile.noGi })} />
            </div>
          </section>

          {/* Настройки: стиль игры (выбор из 10 архетипов с описанием) */}
          <section>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Стиль игры</h3>
            <p className="mb-2 text-[11px] text-muted-foreground">Отметь свои стили — приложение учтёт их в рекомендациях и «Моей игре».</p>
            <div className="space-y-1.5">
              {STYLE_ORDER.map((s) => {
                const meta = STYLE_META[s];
                const Icon = STYLE_ICONS[s];
                const selected = profile.preferredStyles?.includes(s) ?? false;
                const toggle = () => {
                  const cur = profile.preferredStyles ?? [];
                  update({ preferredStyles: selected ? cur.filter((x) => x !== s) : [...cur, s] });
                };
                return (
                  <button
                    key={s}
                    onClick={toggle}
                    className="flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-all"
                    style={{
                      borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
                      background: selected ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))" : "var(--color-card)",
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-foreground/80" strokeWidth={1.9} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{meta.ru}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{meta.desc}</span>
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Язык */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Язык</h3>
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Русский" active={profile.locale === "ru"} onClick={() => update({ locale: "ru" as Locale })} />
              <Toggle label="English" active={profile.locale === "en"} onClick={() => update({ locale: "en" as Locale })} />
            </div>
          </section>

          {/* Словарь терминов */}
          <Link
            to="/glossary"
            onClick={onClose}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:bg-muted"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <BookA className="h-4 w-4 text-primary" />
              Словарь терминов
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

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

function Stat({ value, sub, label }: { value: string; sub?: string; label: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-2.5 text-center">
      <p className="text-lg font-bold leading-none">
        {value}
        {sub && <span className="text-[11px] font-normal text-muted-foreground"> {sub}</span>}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
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
