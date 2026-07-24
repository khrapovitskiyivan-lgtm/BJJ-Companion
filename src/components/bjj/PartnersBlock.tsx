import { useEffect, useRef, useState } from "react";
import { Users, UserPlus, Flame, ChevronDown, Trash2, Check } from "lucide-react";
import { getDeviceId, hasConsent, useDiary, useProfile, useProgress, useReviewed } from "@/lib/bjj/store";
import { isTelegram, getStartParam, haptic, hapticSuccess } from "@/lib/telegram";
import {
  listPartners,
  publishProfile,
  acceptPartner,
  removePartner,
  markPartnersJoined,
  getPendingInvite,
  clearPendingInvite,
  sharePartnerInvite,
  type PartnerProfile,
} from "@/lib/bjj/partners";
import { planStreak, dayStreak, trainedByDate } from "@/lib/bjj/plan";
import { buildPublishInput } from "@/lib/bjj/partnersProfile";
import { BELT_LABEL, BELT_ORDER, STYLE_META } from "@/lib/bjj/constants";
import { STAT_META, STAT_ORDER } from "@/lib/bjj/stats";
import { fetchGlobalStats, type GlobalStats } from "@/lib/bjj/globalStats";
import { track } from "@/lib/bjj/telemetry";
import type { Belt, Style } from "@/lib/bjj/types";
import { Button, Sheet, EmptyState } from "@/components/bjj/ui";

// === БЛОК «ПАРТНЁРЫ» ========================================================
// Живёт на «Моей игре» под «Сегодня». Партнёры — только в Telegram и при согласии
// на отправку данных (имя/фото уходят на сервер). Снизу — строка «Кто в игре»
// (сообщество), доступна всем. Логотип в шапке действия больше не несёт.

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ name, photo, size = 34 }: { name: string; photo: string | null; size?: number }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {initialsOf(name) || "?"}
    </span>
  );
}

// Полоски-сегменты статуса недели: закрашено = сделано, сверхплановые золотом
function WeekSegments({ done, quota }: { done: number; quota: number }) {
  const total = Math.max(quota, done, 1);
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-[2px]"
          style={{
            background:
              i >= quota
                ? "var(--brand-gold)"
                : i < done
                  ? "var(--status-progress)"
                  : "var(--color-muted)",
          }}
        />
      ))}
    </div>
  );
}

function PartnerRow({ p, onOpen }: { p: PartnerProfile; onOpen: () => void }) {
  const name = p.name || "Партнёр";
  const done = p.week_done;
  const quota = p.quota;
  const met = quota != null && done >= quota;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 text-left transition hover:bg-muted"
    >
      <Avatar name={name} photo={p.photo_url} />
      {p.belt && (
        <span
          className="h-5 w-2 shrink-0 rounded-[3px]"
          style={{ background: `var(--belt-${p.belt})` }}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p
          className="mt-0.5 inline-flex items-center gap-1.5 text-xs"
          style={{ color: met ? "var(--status-done)" : "var(--color-muted-foreground)" }}
        >
          {quota != null ? `${done} из ${quota}` : `${done} трен.`}
          {p.week_streak >= 2 && (
            <span
              className="inline-flex items-center gap-0.5"
              style={{ color: "var(--brand-gold-ink)" }}
            >
              <Flame className="h-3 w-3" />
              {p.week_streak} нед
            </span>
          )}
        </p>
      </div>
      {quota != null && <WeekSegments done={done} quota={quota} />}
    </button>
  );
}

function PartnerDetail({
  p,
  onClose,
  onRemove,
}: {
  p: PartnerProfile;
  onClose: () => void;
  onRemove: () => void;
}) {
  const name = p.name || "Партнёр";
  const met = p.quota != null && p.week_done >= p.quota;
  return (
    <Sheet title={name} onClose={onClose}>
      <div className="flex items-center gap-3">
        <Avatar name={name} photo={p.photo_url} size={48} />
        <div className="text-xs text-muted-foreground">
          {p.belt && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-3.5 w-2 rounded-[2px]"
                style={{ background: `var(--belt-${p.belt as Belt})` }}
              />
              {BELT_LABEL[p.belt as Belt]} пояс
            </span>
          )}
          <span className="ml-1">
            {[p.gi && "Gi", p.nogi && "No-Gi"].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-muted p-3">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Эта неделя:{" "}
          <span
            className="font-medium"
            style={{ color: met ? "var(--status-done)" : "var(--color-foreground)" }}
          >
            {p.quota != null ? `${p.week_done} из ${p.quota}` : `${p.week_done} трен.`}
          </span>
        </span>
        {p.week_streak >= 2 && (
          <span
            className="ml-auto inline-flex items-center gap-1 text-xs"
            style={{ color: "var(--brand-gold-ink)" }}
          >
            <Flame className="h-3.5 w-3.5" />
            серия {p.week_streak} нед
          </span>
        )}
      </div>

      {p.style && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Стиль игры</p>
          <p className="mt-1 text-sm font-semibold">
            {STYLE_META[p.style as Style]?.ru ?? p.style}
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          Характеристики
        </p>
        <div className="space-y-1.5">
          {STAT_ORDER.map((stat) => {
            const v = Math.round(p.stats?.[stat] ?? 0);
            return (
              <div key={stat} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">
                  {STAT_META[stat].ru}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${v}%`, background: "var(--status-progress)" }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Button variant="danger" size="sm" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
        Удалить из партнёров
      </Button>
    </Sheet>
  );
}

// Сообщество: распределение по поясам (инлайн, раскрывается в блоке)
function CommunityBars({ stats }: { stats: GlobalStats }) {
  const max = Math.max(1, ...BELT_ORDER.map((b) => stats.belts[b] ?? 0));
  return (
    <div className="space-y-1.5">
      {BELT_ORDER.map((b) => {
        const cnt = stats.belts[b] ?? 0;
        return (
          <div key={b} className="flex items-center gap-2">
            <span
              className="h-3 w-6 shrink-0 rounded ring-1 ring-black/10"
              style={{ background: `var(--belt-${b})` }}
            />
            <span className="w-20 shrink-0 text-xs text-muted-foreground">{BELT_LABEL[b]}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.round((cnt / max) * 100)}%`,
                  background: "var(--status-progress)",
                }}
              />
            </span>
            <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">{cnt}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PartnersBlock() {
  const { profile, hydrated } = useProfile();
  const { progress } = useProgress();
  const { entries, practiceCount } = useDiary();
  const { reviewed } = useReviewed();

  const [partners, setPartners] = useState<PartnerProfile[] | null>(null);
  const [detail, setDetail] = useState<PartnerProfile | null>(null);
  const [showAll, setShowAll] = useState(false); // список > 5 сворачивается
  const [communityOpen, setCommunityOpen] = useState(false);
  const [community, setCommunity] = useState<GlobalStats | null | undefined>(undefined);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // lastFetchRef троттлит обновление по фокусу/интервалу.
  const lastFetchRef = useRef(0);
  const hasPartners = (partners?.length ?? 0) > 0;

  // Порядок: отстающие по недельному плану — сверху (кого подтолкнуть видно сразу),
  // внутри — по величине недобора, затем по имени.
  const sortedPartners = partners
    ? [...partners].sort((a, b) => {
        const met = (p: PartnerProfile) => (p.quota != null && p.week_done >= p.quota ? 1 : 0);
        if (met(a) !== met(b)) return met(a) - met(b);
        const deficit = (p: PartnerProfile) => (p.quota ?? 0) - p.week_done;
        if (deficit(b) !== deficit(a)) return deficit(b) - deficit(a);
        return (a.name || "").localeCompare(b.name || "");
      })
    : null;

  const inTg = isTelegram();
  const enabled = inTg && hasConsent();

  const currentInput = () =>
    buildPublishInput({
      device: getDeviceId(),
      profile,
      progress,
      practiceCount: practiceCount(),
      entries,
      reviewed,
      today: new Date(),
    });

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2500);
  };

  const reload = async () => {
    lastFetchRef.current = Date.now();
    const list = await listPartners();
    setPartners(list);
    if (list.length > 0) markPartnersJoined();
  };

  // Монтирование: загрузить список + приглашение из deep-link
  useEffect(() => {
    if (!enabled || !hydrated) return;
    void reload();
    // код из отложенного приглашения (пойман в AppShell при запуске) либо из start_param
    const code = getPendingInvite() || getStartParam();
    if (code && /^[A-Z0-9]{8}$/.test(code)) setPendingCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hydrated]);

  // Возврат в приложение (webview снова активен) — обновить список, не чаще раза в 10с
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchRef.current < 10000) return;
      void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Автообновление списка, пока блок открыт и приложение активно (раз в 45с,
  // только если есть партнёры) — чтобы статус партнёра подтягивался без действий
  useEffect(() => {
    if (!enabled || !hasPartners) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 45000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hasPartners]);

  const onInvite = async () => {
    haptic();
    setBusy(true);
    const code = await sharePartnerInvite(currentInput());
    setBusy(false);
    if (!code) return flash("Не получилось. Попробуй позже");
    track("invite_created");
  };

  const onAccept = async (code: string) => {
    setPendingCode(null);
    clearPendingInvite(); // одна попытка: не переспрашиваем на каждом заходе
    setBusy(true);
    const status = await acceptPartner(code);
    if (status === "ok") {
      markPartnersJoined();
      void publishProfile(currentInput()); // чтобы пригласивший увидел тебя
      await reload();
      hapticSuccess();
      track("invite_accepted");
      flash("Партнёр добавлен");
    } else {
      flash(
        status === "exists"
          ? "Уже в партнёрах"
          : status === "self"
            ? "Это твоя ссылка"
            : status === "limit"
              ? "Достигнут лимит 10 партнёров"
              : "Приглашение не найдено",
      );
    }
    setBusy(false);
  };

  const onRemove = async (tg: number) => {
    setBusy(true);
    await removePartner(tg);
    setDetail(null);
    await reload();
    setBusy(false);
  };

  const toggleCommunity = () => {
    setCommunityOpen((v) => !v);
    if (community === undefined) fetchGlobalStats().then(setCommunity);
  };

  // Холодный старт: активный призыв в пустом состоянии, если есть недельный темп
  const today = new Date();
  const trained = trainedByDate(entries);
  const weeksStreak = profile.frequency ? planStreak(trained, profile.frequency, today) : 0;
  const daysStreakNoPlan = profile.frequency ? 0 : dayStreak(trained, today);
  const hasMomentum = weeksStreak >= 1 || daysStreakNoPlan >= 3;
  const momentumLine =
    weeksStreak >= 2
      ? `Серия ${weeksStreak} нед. в плане — держи темп с партнёром`
      : daysStreakNoPlan >= 3
        ? `${daysStreakNoPlan} дн. подряд — держи темп с партнёром`
        : "Ты в темпе — позови партнёра по залу";

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Партнёры</h2>
        {enabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onInvite}
            disabled={busy}
            className="text-primary"
          >
            <UserPlus className="h-4 w-4" />
            Пригласить
          </Button>
        )}
      </div>

      {/* Приглашение по deep-link */}
      {pendingCode && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
          <span className="flex-1 text-sm">Принять приглашение в партнёры?</span>
          <Button variant="primary" size="sm" onClick={() => onAccept(pendingCode)} disabled={busy}>
            <Check className="h-3.5 w-3.5" />
            Принять
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              clearPendingInvite();
              setPendingCode(null);
            }}
            disabled={busy}
          >
            Позже
          </Button>
        </div>
      )}

      <div className="mt-3">
        {!inTg ? (
          <p className="text-sm text-muted-foreground">Партнёры доступны в приложении Telegram.</p>
        ) : !hasConsent() ? (
          <p className="text-sm text-muted-foreground">
            Партнёры доступны при включённой синхронизации: Настройки → Конфиденциальность.
          </p>
        ) : partners === null ? (
          <p className="text-sm text-muted-foreground">Загружаем…</p>
        ) : partners.length === 0 ? (
          hasMomentum ? (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
              <p className="text-sm font-medium">{momentumLine}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Держать недельный план вместе проще.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  track("partner_nudge");
                  void onInvite();
                }}
                disabled={busy}
                className="mt-2"
              >
                <UserPlus className="h-4 w-4" />
                Позвать партнёра
              </Button>
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Пока никого"
              hint="Пригласи партнёра — держать недельный план вместе проще."
            />
          )
        ) : (
          <div className="space-y-2">
            {(showAll ? sortedPartners! : sortedPartners!.slice(0, 5)).map((p) => (
              <PartnerRow
                key={p.tg_user_id}
                p={p}
                onOpen={() => {
                  track("partner_opened");
                  setDetail(p);
                }}
              />
            ))}
            {partners.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="w-full pt-1 text-center text-xs font-medium text-primary"
              >
                {showAll ? "Свернуть" : `Показать всех (${partners.length})`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Сообщество: кто в игре — раскрывается внутри блока */}
      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={toggleCommunity}
          className="flex w-full items-center gap-2 text-left"
        >
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Кто в игре{community ? `: ${community.players}` : ""}
          </span>
          <ChevronDown
            className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${communityOpen ? "rotate-180" : ""}`}
          />
        </button>
        {communityOpen && (
          <div className="mt-3">
            {community === undefined ? (
              <p className="text-xs text-muted-foreground">Загружаем…</p>
            ) : community === null ? (
              <p className="text-xs text-muted-foreground">Не удалось загрузить.</p>
            ) : (
              <CommunityBars stats={community} />
            )}
          </div>
        )}
      </div>

      {toast && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
          {toast}
        </p>
      )}

      {detail && (
        <PartnerDetail
          p={detail}
          onClose={() => setDetail(null)}
          onRemove={() => onRemove(detail.tg_user_id)}
        />
      )}
    </section>
  );
}
