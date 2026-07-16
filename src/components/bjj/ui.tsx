// Общие мелкие контролы раздела BJJ. Единственный источник: копии в страницах
// разъезжаются при первой же правке стиля.
// Соглашение по скруглениям: чипы и табы rounded-full, кнопки rounded-xl,
// карточки-контейнеры rounded-2xl.

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
