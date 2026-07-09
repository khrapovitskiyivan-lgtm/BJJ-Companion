import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface Segment {
  label: string;
  value: number;
  color: string;
  icon?: string;
}

interface ProgressPieChartProps {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
  showLegend?: boolean;
  animated?: boolean;
}

export function ProgressPieChart({
  segments,
  size = 120,
  thickness = 18,
  centerLabel,
  centerValue,
  className,
  showLegend = true,
  animated = true,
}: ProgressPieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = useMemo(
    () => segments.reduce((sum, s) => sum + s.value, 0),
    [segments],
  );

  // Вычисляем геометрию сегментов
  const arcs = useMemo(() => {
    if (total === 0) return [];

    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    let accumulated = 0;

    return segments.map((segment, index) => {
      const fraction = segment.value / total;
      const dashLength = fraction * circumference;
      const dashOffset = -accumulated * circumference;
      accumulated += fraction;

      return {
        ...segment,
        fraction,
        dashLength,
        dashOffset,
        radius,
        circumference,
        index,
      };
    });
  }, [segments, total, size, thickness]);

  const center = size / 2;
  const radius = (size - thickness) / 2;

  // Если нет данных — показываем пустой круг
  if (total === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={thickness}
              className="text-muted/30"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-muted-foreground">0</span>
            <span className="text-[10px] text-muted-foreground">техник</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90 transition-transform"
          role="img"
          aria-label={`Прогресс: ${segments.map(s => `${s.label} ${s.value}`).join(", ")}`}
        >
          {/* Фоновый круг */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={thickness}
            className="text-muted/20"
          />

          {/* Сегменты */}
          {arcs.map((arc) => {
            const isHovered = hoveredIndex === arc.index;
            const strokeWidth = isHovered ? thickness + 4 : thickness;

            return (
              <circle
                key={arc.index}
                cx={center}
                cy={center}
                r={arc.radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${arc.dashLength} ${arc.circumference}`}
                strokeDashoffset={arc.dashOffset}
                strokeLinecap="butt"
                className={cn(
                  "transition-all duration-300 cursor-pointer",
                  animated && "animate-pie-draw",
                )}
                style={{
                  opacity: hoveredIndex !== null && !isHovered ? 0.4 : 1,
                  filter: isHovered ? "brightness(1.2)" : "none",
                }}
                onMouseEnter={() => setHoveredIndex(arc.index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Центральный текст */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hoveredIndex !== null ? (
            <>
              <span
                className="text-2xl font-bold transition-all"
                style={{ color: segments[hoveredIndex].color }}
              >
                {segments[hoveredIndex].value}
              </span>
              <span className="text-[10px] text-muted-foreground text-center px-2 leading-tight">
                {segments[hoveredIndex].label}
              </span>
              <span className="text-[9px] text-muted-foreground/70">
                {Math.round((segments[hoveredIndex].value / total) * 100)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold">
                {centerValue ?? total}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {centerLabel ?? "техник"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Легенда */}
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
          {segments.map((segment, index) => (
            <button
              key={index}
              type="button"
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
              style={{
                opacity: hoveredIndex !== null && hoveredIndex !== index ? 0.4 : 1,
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                style={{ background: segment.color }}
              />
              <span className="text-muted-foreground">
                {segment.icon && <span className="mr-0.5">{segment.icon}</span>}
                {segment.label}
              </span>
              <span className="font-semibold text-foreground">
                {segment.value}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
