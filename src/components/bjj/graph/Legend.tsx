import { BELT_ORDER, BELT_LABEL } from "@/lib/bjj/constants";
import { TECHNIQUES } from "@/lib/bjj/data";
import type { Belt } from "@/lib/bjj/types";
import type { Palette } from "./graphUtils";

export function Legend({ theme }: { theme: Palette }) {
  const heroBelts = BELT_ORDER.filter((b) => TECHNIQUES.some((t) => t.belt === b));

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-[10px] text-muted-foreground">
      <span>Обводка узла = пояс · заливка = статус · кольцо = готовность пререквизитов:</span>
      {heroBelts.map((b) => (
        <span key={b} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full ring-1 ring-border" style={{ background: theme.belts[b] }} />
          {BELT_LABEL[b]}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: theme.done }} />
        Изучено
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: theme.prog }} />
        В процессе
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-[2px] w-4" style={{ background: theme.edgeIn }} />
        Ведёт к технике
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-[2px] w-4" style={{ background: theme.edgeOut }} />
        Продолжения
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border border-dashed" style={{ borderColor: theme.risk }} />
        Высокий риск
      </span>
    </div>
  );
}
