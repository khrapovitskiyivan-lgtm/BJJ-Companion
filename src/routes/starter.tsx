import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/bjj/AppShell";
import { PageHeader } from "@/components/bjj/ui";
import { TechniquesTabs } from "@/components/bjj/TechniquesTabs";
import { StarterSet } from "@/components/bjj/StarterSet";
import { useProfile } from "@/lib/bjj/store";
import { track } from "@/lib/bjj/telemetry";

export const Route = createFileRoute("/starter")({
  component: StarterPage,
});

function StarterPage() {
  const { profile, hydrated } = useProfile();
  const navigate = Route.useNavigate();
  const isWhite = profile.belt === "white";

  // Гейт пояса на клиенте (пояс в localStorage, beforeLoad его не видит):
  // не белый -> на карту. Ждём hydrated, иначе ложный редирект/мигание.
  useEffect(() => {
    if (hydrated && !isWhite) navigate({ to: "/map", replace: true });
  }, [hydrated, isWhite, navigate]);

  useEffect(() => {
    if (hydrated && isWhite) track("starter_open", undefined, { dailyDedup: true });
  }, [hydrated, isWhite]);

  return (
    <AppShell>
      <div className="space-y-3">
        <PageHeader kicker="Для новичка" title="С чего начать" className="px-1" />
        <TechniquesTabs />
        {hydrated && isWhite ? (
          <StarterSet />
        ) : (
          <div className="h-40 rounded-2xl border border-border bg-card" />
        )}
      </div>
    </AppShell>
  );
}
