import { useEffect, useState } from "react";

// Статичная заставка при запуске: логотип на белом с лёгкой анимацией появления.
// Видео убрано — webview Telegram (iOS) не автоплеит его и показывает кнопку play.
// Показывается один раз за сессию. Флаг ставится ПРИ ЗАКРЫТИИ (StrictMode-safe).
const SESSION_KEY = "bjj.splashShown";

export function SplashScreen() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setShow(true);
    // ~2.5с: приложение монтируется ПОД оверлеем и греет данные (профиль/прогресс + синк).
    const t = setTimeout(dismiss, 2500);
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
      onClick={dismiss}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{ width: "100vw", height: "100dvh" }}
    >
      <img src="/logo.png" alt="BJJ Companion" className="splash-logo w-[62%] max-w-[320px] select-none" draggable={false} />
    </div>
  );
}
