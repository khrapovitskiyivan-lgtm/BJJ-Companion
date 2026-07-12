import { forwardRef, type SVGProps } from "react";

// Шака 🤙 в стиле lucide (линейная, под currentColor — как остальные значки нав-бара).
// База — HandMetal, у которого согнут указательный палец: остаются вытянутыми
// большой и мизинец, остальные согнуты. В самом lucide такой иконки нет.
export const ShakaIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  ({ strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <g transform="rotate(90 12 12)">
        <path d="M18 12.5V10a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4" />
        <path d="M14 11V9a2 2 0 1 0-4 0v2" />
        <path d="M10 10.5V9a2 2 0 1 0-4 0v5" />
        <path d="m7 15-1.76-1.76a2 2 0 0 0-2.83 2.82l3.6 3.6C7.5 21.14 9.2 22 12 22h2a8 8 0 0 0 8-8V7a2 2 0 1 0-4 0v5" />
      </g>
    </svg>
  ),
);
ShakaIcon.displayName = "ShakaIcon";
