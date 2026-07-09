import { useMemo, useState, useCallback } from "react";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { BELT_ORDER } from "@/lib/bjj/constants";
import { currentFocus, nextToLearn, learningPath } from "@/lib/bjj/recommend";
import type { ProgressMap } from "@/lib/bjj/store";
import type { Belt, StyleProfile, Technique } from "@/lib/bjj/types";
import { Target, Flag } from "lucide-react";

import { PALETTE, type EdgeItem, type FocusDir, type BaseFilter, type GiFilter, type FocusMode } from "./graphUtils";
import { GraphCanvas } from "./GraphCanvas";
import { GraphControls } from "./GraphControls";
import { GraphSearchBar } from "./GraphSearchBar";
import { GraphFilters } from "./GraphFilters";
import { FocusPanel } from "./FocusPanel";
import { MilestoneCard } from "./MilestoneCard";
import { Minimap } from "./Minimap";
import { Legend } from "./Legend";

export function TechniqueGraph({
  progress, profile,
}: {
  progress: ProgressMap;
  profile: StyleProfile;
}) {
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [dir, setDir] = useState<FocusDir>("both");
  const [filter, setFilter] = useState<BaseFilter>("myBelt");
  const [giFilter, setGiFilter] = useState<GiFilter>("all");
  const [legalOnly, setLegalOnly] = useState(false);
  const [safetyLens, setSafetyLens] = useState(false);
  const [query, setQuery] = useState("");
  const [heroMode, setHeroMode] = useState(false);
  const [heroBelt, setHeroBelt] = useState<Belt>(profile.belt);
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>("my-level");
  const [showMinimap, setShowMinimap] = useState(true);

  const theme = profile.theme === "dark" ? PALETTE.dark : PALETTE.light;

  // Рёбра
  const edges = useMemo<EdgeItem[]>(() => {
    const out: EdgeItem[] = [];
    const arrow = { to: { enabled: true, scaleFactor: 0.35 } };
    for (const t of TECHNIQUES) {
      for (const p of t.prerequisites)
        if (TECH_BY_ID[p]) out.push({ id: `p${p}-${t.id}`, from: p, to: t.id, kind: "prereq", arrows: arrow });
      for (const c of t.chain_to)
        if (TECH_BY_ID[c]) out.push({ id: `c${t.id}-${c}`, from: t.id, to: c, kind: "chain", arrows: arrow });
      for (const s of t.common_setups)
        if (TECH_BY_ID[s]) out.push({ id: `s${t.id}-${s}`, from: t.id, to: s, kind: "setup", dashes: true });
    }
    return out;
  }, []);

  // Поиск
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return TECHNIQUES.filter(
      (t) => t.nameRu.toLowerCase().includes(q) || t.nameEn.toLowerCase().includes(q) || t.label.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  // Рекомендации
  const focusTech = useMemo(() => currentFocus(TECHNIQUES, progress), [progress]);
  const recommendations = useMemo(
    () => nextToLearn(TECHNIQUES, progress, profile.belt, 4),
    [progress, profile.belt],
  );

  // Фильтры
  const beltIdx = (b: Belt) => BELT_ORDER.indexOf(b);
  const matchesFilter = useCallback(
    (t: Technique): boolean => {
      const s = progress[t.id] ?? "not_started";
      if (giFilter === "gi" && !t.gi) return false;
      if (giFilter === "nogi" && !t.noGi) return false;
      if (legalOnly && !t.legal_ibjjf_gi && !t.legal_ibjjf_nogi) return false;
      if (focusMode === "my-level") {
        const diff = Math.abs(beltIdx(t.belt) - beltIdx(profile.belt));
        if (diff > 1) return false;
      }
      if (filter === "myBelt") return beltIdx(t.belt) <= beltIdx(profile.belt);
      if (filter === "mastered") return s === "done";
      if (filter === "available") {
        if (beltIdx(t.belt) > beltIdx(profile.belt)) return false;
        return t.prerequisites.every((p) => progress[p] === "done") && s !== "done";
      }
      return true;
    },
    [filter, giFilter, legalOnly, progress, profile.belt, focusMode],
  );

  // Фокус
  const focusSet = useMemo<Set<number> | null>(() => {
    if (focusedId == null) return null;
    const t = TECH_BY_ID[focusedId];
    if (!t) return null;
    if (dir === "path") return new Set(learningPath(t, progress).map((x) => x.id));
    const set = new Set<number>([focusedId]);
    for (const e of edges) {
      if (dir === "both") {
        if (e.from === focusedId) set.add(e.to);
        if (e.to === focusedId) set.add(e.from);
      } else if (dir === "up") {
        if (e.to === focusedId) set.add(e.from);
      } else if (dir === "down") {
        if (e.from === focusedId) set.add(e.to);
      }
    }
    return set;
  }, [focusedId, dir, edges, progress]);

  const dimmed = focusSet !== null || filter !== "all" || giFilter !== "all" || legalOnly;
  const focusedTech = focusedId != null ? TECH_BY_ID[focusedId] : null;
  const heroBelts = BELT_ORDER.filter((b) => TECHNIQUES.some((t) => t.belt === b));

  const stats = useMemo(() => {
    let done = 0;
    for (const t of TECHNIQUES) if (progress[t.id] === "done") done++;
    return { total: TECHNIQUES.length, done, pct: Math.round((done / TECHNIQUES.length) * 100) };
  }, [progress]);

  const jumpTo = useCallback((id: number) => {
    setFocusedId(id);
    // netRef.current?.focus(id, { ... }) — нужно пробросить ref из GraphCanvas
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      <GraphSearchBar
        query={query}
        onQueryChange={setQuery}
        results={searchResults}
        onSelect={(t) => { setQuery(""); jumpTo(t.id); }}
        theme={theme}
        stats={stats}
      />

      <div className="px-4 pb-2">
        <GraphFilters
          filter={filter} onFilterChange={(f) => { setFilter(f); setFocusedId(null); }}
          giFilter={giFilter} onGiFilterChange={setGiFilter}
          legalOnly={legalOnly} onLegalOnlyToggle={() => setLegalOnly(!legalOnly)}
          safetyLens={safetyLens} onSafetyLensToggle={() => setSafetyLens(!safetyLens)}
          showFilters={showFilters} onShowFiltersToggle={() => setShowFilters(!showFilters)}
          showLegend={showLegend} onShowLegendToggle={() => setShowLegend(!showLegend)}
        />
      </div>

      <div className="relative h-[520px] w-full" style={{ background: theme.canvasBg }}>
        <GraphCanvas
          progress={progress} profile={profile} edges={edges}
          focusedId={focusedId} onNodeClick={setFocusedId}
          heroMode={heroMode} heroBelt={heroBelt} focusMode={focusMode}
          matchesFilter={matchesFilter} focusSet={focusSet} dir={dir} dimmed={dimmed}
        />

        {showMinimap && (
          <Minimap profile={profile} edges={edges} theme={theme} mainNetRef={/* ref из GraphCanvas */ null as any} />
        )}

        <GraphControls
          heroMode={heroMode} focusMode={focusMode} showMinimap={showMinimap}
          heroBelt={heroBelt} heroBelts={heroBelts} theme={theme}
          onToggleHero={() => setHeroMode(!heroMode)}
          onOverviewFit={() => { /* net.fit() */ }}
          onFocusMyLevel={() => setFocusMode("my-level")}
          onToggleMinimap={() => setShowMinimap(!showMinimap)}
          onSelectHeroBelt={setHeroBelt}
        />

        {focusedId == null && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
            Клик по узлу — связи · «Путь» — цепочка изучения
          </div>
        )}
      </div>

      {focusedTech && (
        <FocusPanel
          tech={focusedTech} progress={progress} dir={dir} onDir={setDir}
          onClose={() => setFocusedId(null)} onJump={jumpTo}
        />
      )}

      <div className="grid grid-cols-1 gap-2 border-t border-border p-3 sm:grid-cols-2">
        <MilestoneCard
          icon={<Target className="h-4 w-4" />}
          caption="Текущий фокус"
          tech={focusTech}
          empty="Отметьте технику «в процессе» — она появится здесь"
          onClick={(t) => jumpTo(t.id)}
        />
        <MilestoneCard
          icon={<Flag className="h-4 w-4" />}
          caption="Следующая цель"
          tech={recommendations[0] ?? null}
          extra={recommendations.slice(1)}
          empty="Всё доступное освоено!"
          onClick={(t) => jumpTo(t.id)}
          highlight
        />
      </div>

      {showLegend && <Legend theme={theme} />}
    </div>
  );
}
