// Приложение бесплатное: вклад автора в сообщество BJJ. Добровольная поддержка —
// переводом по реквизитам ниже. Пока реквизиты пустые, кнопка доната не показывается
// (сообщение о бесплатности работает и без них).

export const SUPPORT = {
  card: "", // номер карты, например "2200 0000 0000 0000"
  holder: "", // получатель, например "Иван Х."
  bank: "", // банк, например "Т-Банк"
  sbpPhone: "", // телефон для СБП, например "+7 900 000-00-00"
};

export const hasSupportDetails = () => !!(SUPPORT.card || SUPPORT.sbpPhone);

// Окно «приложение бесплатное» показывается один раз (на устройство)
const INTRO_KEY = "bjj.supportIntro.v1";

export function supportIntroSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return true; // нет хранилища — не надоедаем
  }
}

export function markSupportIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* ignore */
  }
}
