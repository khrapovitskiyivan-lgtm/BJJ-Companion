// Звуковые сигналы раннера через Web Audio: без файлов, работает офлайн.
// iOS webview (Telegram) блокирует звук до жеста пользователя — unlockAudio()
// вызывается по тапу «Старт» и создаёт/размораживает AudioContext.

let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // звук не критичен — молча живём без него
  }
}

function tone(freq: number, durMs: number, volume: number, delayMs = 0): void {
  if (!ctx || ctx.state !== "running") return;
  try {
    const t0 = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.05);
  } catch {
    // не роняем таймер из-за звука
  }
}

// Короткий предупреждающий гудок: последние 5 секунд раздела, раз в секунду
export function beepWarn(): void {
  tone(880, 120, 0.25);
}

// Громкий сигнал конца раздела (двойной тон)
export function beepSection(): void {
  tone(660, 450, 0.7);
  tone(880, 450, 0.7, 150);
}

// Громкий финал тренировки (тройной восходящий)
export function beepFinish(): void {
  tone(660, 350, 0.8);
  tone(880, 350, 0.8, 280);
  tone(1100, 600, 0.8, 560);
}
