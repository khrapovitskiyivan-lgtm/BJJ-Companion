import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PolicyContent } from "@/components/bjj/legal";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

// Отдельная страница без AppShell: гейт согласия обёрнут в AppShell, поэтому
// оборачивать сюда нельзя (иначе гейт показался бы поверх документа). Открывается
// из настроек и по прямой ссылке.
function PrivacyPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => router.history.back()}
            aria-label="Назад"
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-base font-bold tracking-tight">Политика конфиденциальности</h1>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-4 pb-16">
        <PolicyContent />
      </main>
    </div>
  );
}
