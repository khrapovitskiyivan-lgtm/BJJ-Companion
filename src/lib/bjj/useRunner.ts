import { useEffect, useRef, useState } from "react";
import { advanceBy, initialPhase, type RunPhase, type RunSection } from "./runner";
import { beepWarn, beepSection, beepFinish } from "./sound";
import { acquireWakeLock, releaseWakeLock } from "./wakeLock";

// Общий движок раннеров (тренировка и сценарии).
// Отсчёт по настенным часам: интервал лишь пересчитывает, сколько секунд
// прошло по Date.now — после сна телефона таймер догоняет разом (advanceBy),
// а не «замерзает». Пока идёт отсчёт, держим экран включённым (Wake Lock).
// Сигналы: warn играем только в живом тике (каждая из последних 5 секунд),
// section/finish — и при догоне (пусть с опозданием, но прозвучит).
export function useRunner(sections: RunSection[], initial?: RunPhase) {
  const [phase, setPhase] = useState<RunPhase>(() => initial ?? initialPhase(sections));
  const [paused, setPaused] = useState(true);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const lastTsRef = useRef(0);

  useEffect(() => {
    if (paused || phaseRef.current.finished) return;
    lastTsRef.current = Date.now();

    const sync = () => {
      const elapsed = Math.floor((Date.now() - lastTsRef.current) / 1000);
      if (elapsed < 1) return;
      lastTsRef.current += elapsed * 1000; // остаток < 1 сек сохраняем — без дрейфа
      const { next, signals } = advanceBy(sections, phaseRef.current, elapsed);
      if (signals.includes("finish")) beepFinish();
      else if (signals.includes("section")) beepSection();
      else if (elapsed === 1 && signals.includes("warn")) beepWarn();
      phaseRef.current = next;
      setPhase(next);
      if (next.finished) setPaused(true);
    };

    const t = setInterval(sync, 500);
    // Возврат из фона: не ждём интервала, пересчитываем сразу
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [paused, sections]);

  // Wake lock на время отсчёта; после возврата в видимость перезапрашиваем
  useEffect(() => {
    if (paused || phase.finished) {
      releaseWakeLock();
      return;
    }
    void acquireWakeLock();
    const onVis = () => {
      if (document.visibilityState === "visible" && !phaseRef.current.finished) void acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      releaseWakeLock();
    };
  }, [paused, phase.finished]);

  const reset = () => {
    setPhase(initialPhase(sections));
    setPaused(true);
  };

  return { phase, setPhase, paused, setPaused, reset };
}
