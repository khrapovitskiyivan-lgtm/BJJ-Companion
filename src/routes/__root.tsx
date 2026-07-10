import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SplashScreen } from "../components/bjj/SplashScreen";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BJJ Companion — библиотека техник и умные тренировки" },
      {
        name: "description",
        content:
          "Компаньон для бразильского джиу-джитсу: библиотека техник, генератор тренировок и трекинг прогресса по поясам.",
      },
      { name: "author", content: "BJJ Companion" },
      { property: "og:title", content: "BJJ Companion — библиотека техник и умные тренировки" },
      {
        property: "og:description",
        content:
          "Библиотека приёмов БЖЖ, умный генератор тренировок и трекинг прогресса. Русский и английский.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },

      { name: "twitter:title", content: "BJJ Companion — библиотека техник и умные тренировки" },
      { name: "description", content: "Компаньон для бразильского джиу-джитсу: библиотека техник, генератор тренировок и трекинг прогресса по поясам." },
      { property: "og:description", content: "Компаньон для бразильского джиу-джитсу: библиотека техник, генератор тренировок и трекинг прогресса по поясам." },
      { name: "twitter:description", content: "Компаньон для бразильского джиу-джитсу: библиотека техник, генератор тренировок и трекинг прогресса по поясам." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ea3ba16d-0d89-4c14-8ec9-220fdd877148/id-preview-f9b26ae7--1461c968-c6f7-47db-bb4d-611f39c197ff.lovable.app-1783325590165.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ea3ba16d-0d89-4c14-8ec9-220fdd877148/id-preview-f9b26ae7--1461c968-c6f7-47db-bb4d-611f39c197ff.lovable.app-1783325590165.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SplashScreen />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
