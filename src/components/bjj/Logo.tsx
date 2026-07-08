// === ЛОГОТИП BJJ COMPANION ===
// Узел пояса (belt knot) + узлы графа: две идеи продукта в одном знаке.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      {/* лента пояса */}
      <path
        d="M6 20 C14 16, 34 16, 42 20 L42 26 C34 22, 14 22, 6 26 Z"
        fill="var(--color-primary)"
        opacity="0.25"
      />
      {/* узел пояса */}
      <path
        d="M20 17 L28 17 L30 24 L28 31 L20 31 L18 24 Z"
        fill="var(--color-primary)"
      />
      {/* хвосты пояса */}
      <path d="M21 31 L17 42 L22 42 L25 33 Z" fill="var(--color-primary)" opacity="0.8" />
      <path d="M27 31 L31 42 L26 42 L23.5 33 Z" fill="var(--color-primary)" opacity="0.55" />
      {/* узлы графа — карта техник */}
      <circle cx="10" cy="10" r="3" fill="var(--color-primary)" opacity="0.5" />
      <circle cx="24" cy="7" r="3.5" fill="var(--color-primary)" />
      <circle cx="38" cy="10" r="3" fill="var(--color-primary)" opacity="0.5" />
      <path d="M12.5 11 L21 8.2 M27 8.2 L35.5 11" stroke="var(--color-primary)" strokeWidth="1.6" opacity="0.5" />
      <path d="M24 10.5 L24 16" stroke="var(--color-primary)" strokeWidth="1.6" opacity="0.7" />
    </svg>
  );
}
