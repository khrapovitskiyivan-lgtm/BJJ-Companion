import { ShieldAlert, SlidersHorizontal, HelpCircle } from "lucide-react";
import type { BaseFilter, GiFilter } from "./graphUtils";

interface GraphFiltersProps {
  filter: BaseFilter;
  onFilterChange: (f: BaseFilter) => void;
  giFilter: GiFilter;
  onGiFilterChange: (f: GiFilter) => void;
  legalOnly: boolean;
  onLegalOnlyToggle: () => void;
  safetyLens: boolean;
  onSafetyLensToggle: () => void;
  showFilters: boolean;
  onShowFiltersToggle: () => void;
  showLegend: boolean;
  onShowLegendToggle: () => void;
}

export function GraphFilters({
  filter, onFilterChange, giFilter, onGiFilterChange,
  legalOnly, onLegalOnlyToggle, safetyLens, onSafetyLensToggle,
  showFilters, onShowFiltersToggle, showLegend, onShowLegendToggle,
}: GraphFiltersProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {(
        [
          ["all", "Все"],
          ["myBelt", "Мой пояс"],
          ["mastered", "Освоенные"],
          ["available", "Доступные"],
        ] as [BaseFilter, string][]
      ).map(([f, label]) => (
        <Chip key={f} active={filter === f} onClick={() => onFilterChange(f)}>
          {label}
        </Chip>
      ))}
      <span className="mx-0.5 h-4 w-px bg-border" />
      <Chip
        active={showFilters || giFilter !== "all" || legalOnly || safetyLens}
        onClick={onShowFiltersToggle}
      >
        <SlidersHorizontal className="mr-1 inline h-3 w-3" />
        Фильтры
      </Chip>
      <Chip active={showLegend} onClick={onShowLegendToggle}>
        <HelpCircle className="mr-1 inline h-3 w-3" />
      </Chip>

      {showFilters && (
        <>
          <span className="mx-0.5 h-4 w-px bg-border" />
          {(
            [
              ["all", "Gi+NoGi"],
              ["gi", "Gi"],
              ["nogi", "No-Gi"],
            ] as [GiFilter, string][]
          ).map(([f, label]) => (
            <Chip key={f} active={giFilter === f} onClick={() => onGiFilterChange(f)}>
              {label}
            </Chip>
          ))}
          <Chip active={legalOnly} onClick={onLegalOnlyToggle}>IBJJF</Chip>
          <Chip active={safetyLens} onClick={onSafetyLensToggle}>
            <ShieldAlert className="mr-1 inline h-3 w-3" />
            Риск травмы
          </Chip>
        </>
      )}
    </div>
  );
}

function Chip({
  children, active, onClick,
}: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
        active
          ? "border-ring bg-primary/15 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
