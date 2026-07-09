import { Link } from "@tanstack/react-router";
import { Home, BookOpen, ChevronRight } from "lucide-react";
import type { Technique } from "@/lib/bjj/types";
import { GROUP_LABEL } from "@/lib/bjj/constants";

export function Breadcrumbs({ tech }: { tech: Technique }) {
  return (
    <nav aria-label="Навигация" className="flex items-center gap-1 text-xs text-muted-foreground">
      <Link to="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
        <Home className="h-3 w-3" />
        Главная
      </Link>
      <ChevronRight className="h-3 w-3" />
      <Link to="/library" className="flex items-center gap-1 hover:text-foreground transition-colors">
        <BookOpen className="h-3 w-3" />
        Библиотека
      </Link>
      <ChevronRight className="h-3 w-3" />
      <span className="text-foreground font-medium truncate max-w-[120px] sm:max-w-none">
        {tech.nameRu}
      </span>
    </nav>
  );
}
