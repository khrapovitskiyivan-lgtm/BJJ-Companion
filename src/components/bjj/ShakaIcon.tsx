import { forwardRef, type SVGProps } from "react";

// Шака 🤙 в монохроме (под currentColor, как остальные иконки нав-бара).
// Собрана из заливок: кулак (круг) + два широко разведённых пальца — большой и мизинец.
// Такой силуэт читается как шака даже на 20px, в отличие от тонких контуров.
export const ShakaIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  // strokeWidth игнорируем — иконка заливная
  ({ strokeWidth: _sw, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      {/* кулак — сжатые три пальца */}
      <circle cx="12" cy="15" r="5.3" />
      {/* большой палец — вверх-влево */}
      <rect x="4.7" y="2.6" width="4" height="10.5" rx="2" transform="rotate(-20 6.7 7.85)" />
      {/* мизинец — вверх-вправо */}
      <rect x="15.3" y="2.6" width="4" height="10.5" rx="2" transform="rotate(20 17.3 7.85)" />
    </svg>
  ),
);
ShakaIcon.displayName = "ShakaIcon";
