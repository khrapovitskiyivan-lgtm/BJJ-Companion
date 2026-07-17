// Wake Lock: экран не гаснет, пока идёт таймер раннера. Человек включает
// отсчёт и идёт заниматься — телефон лежит рядом, сигналы слышны, JS не
// замораживается. Поддержка: iOS 16.4+, Chrome/Android. Где нет — молча
// не работает (страховка — пересчёт таймера по настенным часам).

interface Sentinel {
  release(): Promise<void>;
}

let sentinel: Sentinel | null = null;

export async function acquireWakeLock(): Promise<void> {
  if (typeof navigator === "undefined") return;
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<Sentinel> } }).wakeLock;
    if (!wl) return;
    // Всегда запрашиваем заново: после ухода в фон прежний лок отпускается системой
    const next = await wl.request("screen");
    try {
      void sentinel?.release();
    } catch {
      // прежний уже отпущен системой
    }
    sentinel = next;
  } catch {
    // нет поддержки или запрещено — живём без лока
  }
}

export function releaseWakeLock(): void {
  try {
    void sentinel?.release();
  } catch {
    // уже отпущен
  }
  sentinel = null;
}
