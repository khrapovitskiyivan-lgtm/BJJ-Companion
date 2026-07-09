import { Maximize2, Smartphone, User } from "lucide-react";
import type { Belt } from "@/lib/bjj/types";
import { BELT_LABEL } from "@/lib/bjj/constants";
import type { Palette } from "./graphUtils";

interface GraphControlsProps {
  heroMode: boolean;
  focusMode: "all" | "my-level";
  showMinimap: boolean;
  heroBelt: Belt;
  heroBelts: Belt[];
  theme: Palette;
  onToggleHero: () => void;
  onOverviewFit: () => void;
  onFocusMyLevel: () => void;
  onToggleMinimap: () => void;
  onSelectHeroBelt: (b: Belt) => void;
}

export function GraphControls({
  heroMode, focusMode, showMinimap, heroBelt, heroBelts, theme,
  onToggleHero, onOverviewFit, onFocusMyLevel, onToggleMinimap, onSelectHeroBelt,
}: GraphControlsProps) {
  return (
    <>
      {/* Селектор пояса в hero-режиме */}
      {heroMode && (
        <div className="absolute left-1/2 top-2.5 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/90 px-1.5 py-1 backdrop-blur">
          {heroBelts.map((b) => (
            <button
              key={b}
              onClick={() => onSelectHeroBelt(b)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                b === heroBelt ? "text-foreground" : "text-muted-foreground"
              }`}
              style={
                b === heroBelt
                  ? { background: `${theme.belts[b]}33`, boxShadow: `inset 0 0 0 1px ${theme.belts[b]}66` }
                  : undefined
              }
            >
              {BELT_LABEL[b]}
            </button>
          ))}
        </div>
      )}

      {/* Кнопки справа */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
        <ControlButton
          active={focusMode === "my-level"}
          onClick={onFocusMyLevel}
          title="Мой уровень"
          icon={<User className="h-4 w-4" />}
        />
        <ControlButton
          active={heroMode}
          onClick={onToggleHero}
          title="Режим пояса (мобильный)"
          icon={<Smartphone className="h-4 w-4" />}
        />
        <ControlButton
          onClick={onOverviewFit}
          title="По центру"
          icon={<Maximize2 className="h-4 w-4" />}
        />
        <ControlButton
          active={showMinimap}
          onClick={onToggleMinimap}
          title="Миникарта"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <rect x="7" y="7" width="10" height="10" rx="1" />
            </svg>
          }
        />
      </div>
    </>
  );
}

function ControlButton({
  active, onClick, title, icon,
}: { active?: boolean; onClick: () => void; title: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`grid h-10 w-10 place-items-center rounded-xl border backdrop-blur transition ${
        active
          ? "border-ring bg-primary/20 text-foreground"
          : "border-border bg-card/90 text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
    </button>
  );
}
