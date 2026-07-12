import { forwardRef } from "react";

// Значок «Моя игра» — эмодзи 🤙. Генерируется из код-поинта в рантайме,
// поэтому в исходнике и бандле НЕТ сырых байтов эмодзи (iOS JavaScriptCore
// в Telegram падал на них при парсинге — отсюда был «This page didn't load»).
const SHAKA = String.fromCodePoint(0x1f919);

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
      fontSize: "1.15rem",
      lineHeight: 1,
    }}
    aria-hidden
  >
    {SHAKA}
  </span>
));
ShakaIcon.displayName = "ShakaIcon";
