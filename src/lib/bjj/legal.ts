import type { Belt } from "./types";
import { BELT_ORDER, BELT_GENITIVE } from "./constants";

// Значение легальности: true = всем поясам, false = никогда, Belt = легально С этого пояса
export type LegalValue = boolean | Belt;

export type LegalStatus =
  | { kind: "legal" }
  | { kind: "never" }
  | { kind: "from"; belt: Belt }; // ограничено: легально с пояса belt (пользователь ниже него)

// Статус легальности приёма для пояса пользователя
export function legalStatus(value: LegalValue, userBelt: Belt): LegalStatus {
  if (value === true) return { kind: "legal" };
  if (value === false) return { kind: "never" };
  const ok = BELT_ORDER.indexOf(userBelt) >= BELT_ORDER.indexOf(value);
  return ok ? { kind: "legal" } : { kind: "from", belt: value };
}

// Подпись для бейджа, например «IBJJF Gi · с коричневого» или «IBJJF Gi · запрещено»
export function legalLabel(base: string, status: LegalStatus): string {
  if (status.kind === "legal") return base;
  if (status.kind === "never") return `${base} · запрещено`;
  return `${base} · с ${BELT_GENITIVE[status.belt]}`;
}
