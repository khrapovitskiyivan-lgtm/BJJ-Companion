import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueGraph } from "@/components/bjj/TechniqueGraph";
import { useProgress, useProfile } from "@/lib/bjj/store";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

function MapPage() {
  return (
    <AppShell>
      <div className="space-y-3">
        <header className="px-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Технический атлас</p>
          <h1 className="text-xl font-bold tracking-tight">Созвездие приёмов</h1>
        </header>
        <ClientOnly
          fallback={
            <div className="h-[640px] w-full rounded-3xl border border-white/10 bg-[#0a0b0e]" />
          }
        >
          <GraphInner />
        </ClientOnly>
      </div>
    </AppShell>
  );
}

function GraphInner() {
  const { progress } = useProgress();
  const { profile } = useProfile();
  return <TechniqueGraph progress={progress} profile={profile} />;
}
