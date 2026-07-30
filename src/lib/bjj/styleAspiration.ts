// Флаг «промпт выбора стиля закрыт» в localStorage. SSR-guard как в videoInterest.ts.
const KEY = "bjj.styleAspiration.dismissed.v1";

export function isStyleAspirationDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissStyleAspiration(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // приватный режим/квота: молча
  }
}
