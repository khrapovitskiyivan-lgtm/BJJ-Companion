// Маппинг игрового стиля → lucide-иконка (строгие линейные, как в навигации).
import { Anvil, Wind, Lock, Frame, RotateCw, Footprints, Crosshair, Grab, Crown, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Style } from "./types";

export const STYLE_ICONS: Record<Style, LucideIcon> = {
  pressure_passer: Anvil,
  speed_passer: Wind,
  closed_guard: Lock,
  open_guard: Frame,
  sweeper: RotateCw,
  leg_game: Footprints,
  back_hunter: Crosshair,
  wrestler: Grab,
  top_control: Crown,
  defense_escape: Shield,
};
