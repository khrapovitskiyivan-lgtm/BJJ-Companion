import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { useProfile } from "@/lib/bjj/store";
import { BELT_LABEL } from "@/lib/bjj/constants";
import { TECHNIQUES } from "@/lib/bjj/data";
import { BookOpen, Dumbbell, LineChart, Network } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

function Home() {
  const { profile } = useProfile();
  const total = TECHNIQUES.length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Ваш профиль
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight">
          {BELT_LABEL[profile.belt]} пояс
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Формат: {profile.gi && profile.noGi ? "Gi + No-Gi" : profile.gi ? "Gi" : "No-Gi"} · Библиотека: {total} техник
        </p>
      </section>

      <section className="grid grid-cols-1 gap-3">
        <NavTile
          to="/library"
          icon={<BookOpen className="h-5 w-5" />}
          title="Библиотека техник"
          desc="Поиск, фильтры по поясу, gi/no-gi и категории"
        />
        <NavTile
          to="/workout"
          icon={<Dumbbell className="h-5 w-5" />}
          title="Умная тренировка"
          desc="Персональный план с разминкой и заминкой"
        />
        <NavTile
          to="/progress"
          icon={<LineChart className="h-5 w-5" />}
          title="Прогресс"
          desc="Отмечайте изученные техники"
        />
        <NavTile
          to="/map"
          icon={<Network className="h-5 w-5" />}
          title="Карта техник"
          desc="Граф связей: пререквизиты и продолжения"
        />
      </section>
    </div>
  );
}

function NavTile({
  to,
  icon,
  title,
  desc,
}: {
  to: "/library" | "/workout" | "/progress" | "/map";
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted"
    >
      <span
        className="grid h-11 w-11 place-items-center rounded-xl"
        style={{ background: "color-mix(in oklch, var(--color-primary) 12%, var(--color-card))", color: "var(--color-primary)" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{desc}</span>
      </span>
    </Link>
  );
}
