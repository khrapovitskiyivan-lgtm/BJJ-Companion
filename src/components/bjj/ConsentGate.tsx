import { useState } from "react";
import { Check, ShieldCheck, WifiOff } from "lucide-react";
import { Button, Sheet } from "@/components/bjj/ui";
import { PolicyContent, TermsContent } from "./legal";

// === ГЕЙТ СОГЛАСИЯ =========================================================
// Первый экран при первом запуске, до онбординга. Пока согласие не пройдено,
// отправщики (telemetry/globalStats/tgReport/sync) молчат - см. hasConsent() в
// store.ts. Два исхода:
//   onAccept - разрешить отправку данных на сервер (consentChoice 'accepted');
//   onLocal  - локальный режим без отправки (consentChoice 'local').
export function ConsentGate({ onAccept, onLocal }: { onAccept: () => void; onLocal: () => void }) {
  const [checked, setChecked] = useState(false);
  const [view, setView] = useState<"main" | "local">("main");
  const [doc, setDoc] = useState<null | "privacy" | "terms">(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-between px-6 py-10">
        {view === "main" ? (
          <>
            <div className="flex-1 flex flex-col justify-center space-y-6 py-8">
              <div>
                <img
                  src="/logo.webp"
                  alt="BJJ Companion"
                  className="mx-auto mb-4 h-auto w-full max-w-[220px]"
                />
                <h1 className="text-center text-xl font-bold tracking-tight">Прежде чем начать</h1>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Чтобы синхронизировать прогресс, показывать статистику и слать напоминания,
                  приложению нужно ваше согласие на обработку данных.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Что передаётся с согласия
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  <li>идентификатор устройства и выбранный пояс;</li>
                  <li>обезличенные события использования (без содержания записей);</li>
                  <li>в Telegram - id аккаунта и счётчики плана для напоминаний;</li>
                  <li>при входе по e-mail - прогресс и заметки для синхронизации.</li>
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Дневник и данные из Telegram (имя, фото) остаются на устройстве. Данные хранятся у
                  поставщика за пределами РФ (трансграничная передача). Подробности - в{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline"
                    onClick={() => setDoc("privacy")}
                  >
                    Политике конфиденциальности
                  </button>
                  .
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3">
                <span
                  role="checkbox"
                  aria-checked={checked}
                  tabIndex={0}
                  onClick={() => setChecked((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setChecked((v) => !v);
                    }
                  }}
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors"
                  style={{
                    borderColor: checked ? "var(--color-primary)" : "var(--color-border)",
                    background: checked ? "var(--color-primary)" : "transparent",
                  }}
                >
                  {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                </span>
                <span className="text-sm text-foreground">
                  Я прочитал(а) и принимаю{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline"
                    onClick={(e) => {
                      e.preventDefault();
                      setDoc("privacy");
                    }}
                  >
                    Политику конфиденциальности
                  </button>{" "}
                  и{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline"
                    onClick={(e) => {
                      e.preventDefault();
                      setDoc("terms");
                    }}
                  >
                    Условия использования
                  </button>
                  .
                </span>
              </label>
            </div>

            <div className="mt-6 space-y-2">
              <Button variant="primary" size="lg" fullWidth disabled={!checked} onClick={onAccept}>
                Продолжить
              </Button>
              <Button variant="ghost" size="md" fullWidth onClick={() => setView("local")}>
                Использовать локально, без отправки данных
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 flex flex-col justify-center space-y-6 py-8">
              <div>
                <div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{
                    background: "color-mix(in oklch, var(--color-primary) 12%, transparent)",
                  }}
                >
                  <WifiOff className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-center text-xl font-bold tracking-tight">Локальный режим</h1>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Данные остаются только на этом устройстве и на сервер не передаются.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-status-done">Работает</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                    <li>дневник тренировок, план и календарь;</li>
                    <li>библиотека техник, карта, отработка и сценарии;</li>
                    <li>прогресс, стиль и характеристики.</li>
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Недоступно без согласия
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                    <li>синхронизация между устройствами;</li>
                    <li>глобальная статистика игроков;</li>
                    <li>напоминания бота в Telegram;</li>
                    <li>партнёры по залу (появится позже).</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  Согласие можно включить позже в настройках.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <Button variant="primary" size="lg" fullWidth onClick={onLocal}>
                Продолжить локально
              </Button>
              <Button variant="secondary" size="md" fullWidth onClick={() => setView("main")}>
                Назад
              </Button>
            </div>
          </>
        )}
      </div>

      {doc === "privacy" && (
        <Sheet title="Политика конфиденциальности" onClose={() => setDoc(null)}>
          <PolicyContent />
        </Sheet>
      )}
      {doc === "terms" && (
        <Sheet title="Условия использования" onClose={() => setDoc(null)}>
          <TermsContent />
        </Sheet>
      )}
    </div>
  );
}
