import { describe, it, expect, beforeEach } from "vitest";
import { CONSENT_VERSION, hasConsent } from "./consent";

// hasConsent читает профиль из localStorage (когда снимок не инициализирован
// хуком). Проверяем, что на сервер пускает только явное согласие текущей версии.
const KEY = "bjj.profile.v1";

function setProfile(p: Record<string, unknown>) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

describe("hasConsent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("false, пока гейт не пройден (нет полей согласия)", () => {
    expect(hasConsent()).toBe(false);
  });

  it("false в локальном режиме", () => {
    setProfile({ consentChoice: "local", consentVersion: CONSENT_VERSION });
    expect(hasConsent()).toBe(false);
  });

  it("true при явном согласии текущей версии", () => {
    setProfile({ consentChoice: "accepted", consentVersion: CONSENT_VERSION });
    expect(hasConsent()).toBe(true);
  });

  it("false, если версия согласия устарела (нужно повторное согласие)", () => {
    setProfile({ consentChoice: "accepted", consentVersion: CONSENT_VERSION - 1 });
    expect(hasConsent()).toBe(false);
  });
});
