import { useEffect, useRef, useState } from "react";

// Полноэкранная видео-заставка при запуске.
// Показывается один раз за сессию, muted-autoplay, авто-скрытие по окончании + «Пропустить».
// SSR-safe: старт скрытым, показ включается в effect (без hydration mismatch).
// StrictMode-safe: флаг «показано» ставится ПРИ ЗАКРЫТИИ, а не при монтировании,
// иначе двойной mount в dev глушит показ на выжившем инстансе.
const SESSION_KEY = "bjj.splashShown";

export function SplashScreen() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return; // уже показывали в этой сессии
    setShow(true);
    // Заставка ~4с. Приложение монтируется ПОД оверлеем и всё это время греет данные
    // (гидратация профиля/прогресса + облачная синхронизация Supabase, до 3с) — к снятию
    // заставки экран уже наполнен.
    const t = setTimeout(dismiss, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setFading(true);
    setTimeout(() => setShow(false), 350);
  };

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-white transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{ width: "100vw", height: "100dvh" }}
    >
      {/* Видео целиком (логотип вписан в экран). Фон ролика — чисто белый (замерено),
          поэтому белый контейнер сливается с ним в единый полноэкранный кадр без полос. */}
      <video
        ref={videoRef}
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        onEnded={dismiss}
        onError={dismiss}
        className="absolute inset-0 h-full w-full object-contain"
      />
      <button
        onClick={dismiss}
        className="absolute bottom-6 right-6 rounded-full border border-white/25 bg-black/40 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur transition hover:bg-black/60"
      >
        Пропустить
      </button>
    </div>
  );
}
