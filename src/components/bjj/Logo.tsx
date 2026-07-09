// === ЛОГОТИП BJJ COMPANION ===
// Знак в стиле присланного лого: фигура грэпплера в круге, тёмно-синий + золотой пояс.
// Используется в шапке (компактно). Полноразмерный лого-PNG (public/logo.png) — для сплэша.
const NAVY = "#2b2f6b";
const GOLD = "#c79a4e";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden className="shrink-0">
      {/* круг-бейдж */}
      <circle cx="24" cy="24" r="21" stroke={NAVY} strokeWidth="2.5" opacity="0.9" />
      {/* корпус грэпплера (склонённая фигура) */}
      <path
        d="M14 30 C15 22, 20 17, 26 17 C31 17, 34 20, 34 24 C34 27, 31 29, 27 29 C24 29, 22 27, 22 25"
        stroke={NAVY}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {/* голова */}
      <circle cx="29" cy="15.5" r="3.4" fill={NAVY} />
      {/* золотой пояс — лента */}
      <path
        d="M16 28 C20 31, 28 32, 33 30 L34 33 C29 35, 20 34, 15 31 Z"
        fill={GOLD}
      />
      {/* хвост пояса */}
      <path d="M33 31 L35 38 L31.5 37 L30.5 32 Z" fill={GOLD} opacity="0.85" />
    </svg>
  );
}
