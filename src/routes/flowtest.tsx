import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueFlow } from "@/components/bjj/flow/TechniqueFlow";

// Временный роут для обкатки нового графа на React Flow (позже заменит vis-network в /map).
export const Route = createFileRoute("/flowtest")({
  component: () => (
    <AppShell wide>
      <TechniqueFlow />
    </AppShell>
  ),
});
