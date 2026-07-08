import { createFileRoute, redirect } from "@tanstack/react-router";

// Главный экран — Прогресс (профиль и настройки — в шапке).
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/progress" });
  },
});
