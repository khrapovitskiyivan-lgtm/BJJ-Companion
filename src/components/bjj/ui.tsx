// Общие контролы раздела BJJ. Единственный источник: копии в страницах
// разъезжаются при первой же правке стиля.
// Соглашение по скруглениям: чипы и табы rounded-full, кнопки rounded-xl,
// карточки-контейнеры rounded-2xl.

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---- Кнопка ----------------------------------------------------------------
// Пять вариантов покрывают все действия приложения:
//   primary   — главное действие экрана, одно на вид
//   secondary — рядом с primary (отмена, заново, пагинация)
//   soft      — акцент подложкой, без веса primary
//   ghost     — третьестепенное, без рамки и фона
//   danger    — разрушающее (сброс, удаление)
// Плитки выбора с border-2 и подсветкой — это не кнопка, а Toggle (ниже).

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "border border-border bg-card text-foreground hover:bg-muted",
  soft: "bg-primary/10 text-primary hover:bg-primary/20",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "border border-destructive/30 bg-card text-destructive hover:bg-destructive/10",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "gap-1.5 px-3 py-1.5 text-xs",
  md: "gap-1.5 px-4 py-2.5 text-sm",
  lg: "gap-2 px-5 py-3 text-sm font-semibold",
};

// Классы отдельно от компонента: у Link из TanStack Router свой элемент,
// подменить его на <button> нельзя, а вид должен совпадать.
export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center rounded-xl font-medium transition disabled:pointer-events-none disabled:opacity-50",
    BUTTON_VARIANT[variant],
    BUTTON_SIZE[size],
    className,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  fullWidth,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}) {
  return (
    // type до ...rest: форма передаёт type="submit" и должна перебивать умолчание
    <button
      type="button"
      className={buttonClass(variant, size, cn(fullWidth && "w-full", className))}
      {...rest}
    />
  );
}

// Кнопка-иконка без подписи (стрелки-степперы). label обязателен: без текста
// внутри это единственное, что читает скринридер.
export function IconButton({
  label,
  size = "sm",
  variant = "ghost",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: "sm" | "md";
  variant?: "ghost" | "outline";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "grid shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-30",
        size === "sm" ? "h-7 w-7" : "h-9 w-9",
        variant === "outline" && "border border-border",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---- Шторка ----------------------------------------------------------------
// Одно окно на всё приложение: снизу на телефоне, по центру на широком экране.
// Бэкдроп, Esc, скролл тела и крестик — здесь, чтобы не разъезжались по копиям.
export function Sheet({
  kicker,
  title,
  subtitle,
  onClose,
  children,
}: {
  kicker?: string;
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        aria-label="Закрыть"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-4 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            {kicker && (
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{kicker}</p>
            )}
            <p className="text-base font-bold tracking-tight">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <IconButton label="Закрыть" size="sm" variant="outline" onClick={onClose} className="h-8 w-8 rounded-full">
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

// ---- Шапка страницы и секция ----------------------------------------------
// Кикер 11px uppercase + h1 text-xl: шкала из соглашения по типографике.
export function PageHeader({
  kicker,
  title,
  action,
  className,
}: {
  kicker: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{kicker}</p>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}

// Секция внутри шторки: подзаголовок-кикер и необязательная подсказка под ним
export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

// Чип-фильтр (пояс, формат, категория, настройки генератора)
export function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        background: active
          ? "color-mix(in oklch, var(--color-primary) 12%, var(--color-card))"
          : "var(--color-card)",
        color: active ? "var(--color-primary)" : "var(--color-foreground)",
      }}
    >
      {children}
    </button>
  );
}

// Ряд фильтра: подпись-кикер + чипы
export function FilterRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1">{children}</div>
    </div>
  );
}

// Пассивный бейдж (метки на карточках техник: Gi, сложность и т.п.)
export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{children}</span>
  );
}

// Пустое состояние раздела: пунктирная карточка с иконкой, заголовком и подсказкой.
// Иконку передавать уже с размером (обычно h-8 w-8), цвет задаётся здесь.
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <span className="mx-auto grid w-fit place-items-center text-muted-foreground">{icon}</span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

// Крупный переключатель-плитка (язык, формат Gi/No-Gi)
export function Toggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border-2 p-2.5 text-sm font-medium transition-all"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        background: active
          ? "color-mix(in oklch, var(--color-primary) 10%, var(--color-card))"
          : "var(--color-card)",
      }}
    >
      {label}
    </button>
  );
}
