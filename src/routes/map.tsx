import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueFlow } from "@/components/bjj/flow/TechniqueFlow";
import { TechniquesTabs } from "@/components/bjj/TechniquesTabs";
import { PageHeader } from "@/components/bjj/ui";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

function MapPage() {
  return (
    <AppShell wide>
      <div className="space-y-3">
        <PageHeader kicker="Технический атлас" title="Карта обучения" className="px-1" />
        <TechniquesTabs />
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
