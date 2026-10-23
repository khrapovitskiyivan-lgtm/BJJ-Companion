import { useEffect, useState } from "react";
import { Check, Copy, Heart } from "lucide-react";
import { Button, Sheet } from "@/components/bjj/ui";
import { SUPPORT, hasSupportDetails, markSupportIntroSeen, supportIntroSeen } from "@/lib/bjj/support";

// Строка реквизита с копированием в буфер
function Detail({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value.replace(/\s+/g, label === "Карта" ? "" : " ").trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* буфер недоступен — значение видно на экране */
    }
  }
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium tabular-nums">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Скопировать: ${label}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

// Содержимое «Поддержать проект»: благодарность + реквизиты
export function SupportContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed">
        Спасибо, что пользуетесь BJJ Companion! Приложение бесплатное и останется таким: это мой вклад
        в сообщество бразильского джиу-джитсу.
      </p>
      {hasSupportDetails() ? (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Если хотите отблагодарить и поддержать развитие (съёмку видео, новые техники, сервер), можно
            перевести любую сумму. Даже символическая поддержка очень мотивирует.
          </p>
          <div className="space-y-2">
            {SUPPORT.sbpPhone && <Detail label="СБП по номеру телефона" value={SUPPORT.sbpPhone} />}
            {SUPPORT.card && <Detail label="Карта" value={SUPPORT.card} />}
            {SUPPORT.holder && <Detail label="Получатель" value={SUPPORT.holder} />}
            {SUPPORT.bank && <Detail label="Банк" value={SUPPORT.bank} />}
          </div>
        </>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Лучшая благодарность: тренируйтесь, отмечайте прогресс и расскажите о приложении партнёрам по
          залу.
        </p>
      )}
      <p className="text-sm font-medium">Спасибо! Ос.</p>
    </div>
  );
}

export function SupportSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet kicker="BJJ Companion" title="Поддержать проект" onClose={onClose}>
      <SupportContent />
    </Sheet>
  );
}

// Одноразовое окно при входе: приложение бесплатное, вклад в сообщество
export function SupportIntro() {
  const [open, setOpen] = useState(false);
  const [support, setSupport] = useState(false);
  // читаем флаг после гидрации: на сервере окна нет
  useEffect(() => {
    if (!supportIntroSeen()) setOpen(true);
  }, []);

  function close() {
    markSupportIntroSeen();
    setOpen(false);
  }

  if (support) return <SupportSheet onClose={() => setSupport(false)} />;
  if (!open) return null;
  return (
    <Sheet kicker="BJJ Companion" title="Это приложение бесплатное" onClose={close}>
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          Я сделал BJJ Companion как вклад в сообщество бразильского джиу-джитсу. Здесь нет платных функций
          и подписок: всё доступно каждому.
        </p>
        <p className="text-muted-foreground">
          Тренируйтесь, записывайте прогресс, разбирайте технику и делитесь приложением с партнёрами по
          залу. Если захотите отблагодарить, в настройках есть раздел «Поддержать проект».
        </p>
        <p className="font-medium">Ос!</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" size="md" fullWidth onClick={close}>
          Понятно
        </Button>
        {hasSupportDetails() && (
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => {
              markSupportIntroSeen();
              setOpen(false);
              setSupport(true);
            }}
          >
            <Heart className="h-4 w-4" />
            Поддержать
          </Button>
        )}
      </div>
    </Sheet>
  );
}
