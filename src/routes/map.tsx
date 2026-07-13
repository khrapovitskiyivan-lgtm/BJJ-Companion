import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueFlow } from "@/components/bjj/flow/TechniqueFlow";
import { TechniquesTabs } from "@/components/bjj/TechniquesTabs";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

function MapPage() {
  return (
    <AppShell wide>
      <div className="space-y-3">
        <header className="flex items-end justify-between px-1">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Технический атлас</p>
            <h1 className="text-xl font-bold tracking-tight">Карта обучения</h1>
          </div>
          <TechniquesTabs />
        </header>
        <ClientOnly
          fallback={
            <div className="h-[640px] w-full rounded-3xl border border-border bg-card" />
          }
        >
          <TechniqueFlow />
        </ClientOnly>
      </div>
    </AppShell>
  );
}
