import type { Style } from "@/lib/bjj/types";
import { STYLE_META } from "@/lib/bjj/constants";
import { STYLE_ICONS } from "@/lib/bjj/styleIcons";

// Бейджи игровых стилей техники (строгие lucide-иконки, как в навигации).
export function StyleBadges({ styles }: { styles: Style[] }) {
  if (!styles?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {styles.map((s) => {
        const meta = STYLE_META[s];
        const Icon = STYLE_ICONS[s];
        return (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
            {meta.ru}
          </span>
        );
      })}
    </div>
  );
}
