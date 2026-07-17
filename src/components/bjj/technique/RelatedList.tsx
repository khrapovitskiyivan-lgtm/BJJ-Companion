import { Link2, ChevronDown } from "lucide-react";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import type { Technique } from "@/lib/bjj/types";

// Раскрываемая вкладка со связанными техниками (нативный <details>, SSR-безопасно).
export function RelatedList({
  title,
  items,
  empty,
  defaultOpen = false,
}: {
  title: string;
  items: Technique[];
  empty?: string;
  defaultOpen?: boolean;
}) {
  if (items.length === 0 && !empty) return null;

  return (
    <details open={defaultOpen} className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          {title}
          {items.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {items.length}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((t) => (
              <li key={t.id}>
                <TechniqueRow
                  technique={t}
                  inset
                  right={<Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
