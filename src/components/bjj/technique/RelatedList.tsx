import { Link } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import type { Technique } from "@/lib/bjj/types";

export function RelatedList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Technique[];
  empty?: string;
}) {
  if (items.length === 0 && !empty) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                to="/technique/$id"
                params={{ id: String(t.id) }}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5 transition-colors hover:bg-muted"
                style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.nameRu}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {GROUP_LABEL[t.group]} · {BELT_LABEL[t.belt]}
                  </span>
                </span>
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
