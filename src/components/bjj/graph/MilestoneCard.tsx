import { Link2 } from "lucide-react";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import type { Technique } from "@/lib/bjj/types";

interface MilestoneCardProps {
  icon: React.ReactNode;
  caption: string;
  tech: Technique | null;
  extra?: Technique[];
  empty: string;
  onClick: (t: Technique) => void;
  highlight?: boolean;
}

export function MilestoneCard({
  icon, caption, tech, extra, empty, onClick, highlight,
}: MilestoneCardProps) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        highlight ? "border-ring/50 bg-primary/5" : "border-border bg-background"
      }`}
    >
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {caption}
      </p>
      {tech ? (
        <>
          <button onClick={() => onClick(tech)} className="mt-1 block text-left text-sm font-semibold hover:underline">
            {tech.nameRu}
          </button>
          <p className="text-[11px] text-muted-foreground">
            {GROUP_LABEL[tech.group]} · {BELT_LABEL[tech.belt]} · сложность {tech.difficulty}/5
          </p>
          {extra && extra.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {extra.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onClick(t)}
                  className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
