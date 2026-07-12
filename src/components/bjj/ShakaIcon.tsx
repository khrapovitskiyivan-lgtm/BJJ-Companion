import { forwardRef } from "react";

// Значок «Моя игра» — ровно эмодзи 🤙 (по просьбе). Рендерится как текст,
// размер берётся из класса (h-5 w-5 в нав-баре), центрируется по боксу.
export const ShakaIcon = forwardRef<
  HTMLSpanElement,
  { className?: string; strokeWidth?: number | string }
>(({ className }, ref) => (
  <span
    ref={ref}
    className={className}
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "1.05rem",
      lineHeight: 1,
    }}
    aria-hidden
  >
    🤙
  </span>
));
ShakaIcon.displayName = "ShakaIcon";
