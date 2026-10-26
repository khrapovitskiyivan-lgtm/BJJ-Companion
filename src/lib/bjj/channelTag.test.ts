import { describe, it, expect } from "vitest";
import { TECHNIQUES, TECH_BY_ID } from "./data";
import { buildAppLine, buildChannelIndex, matchCaption, missingTags, stripAppLine, techniqueTag } from "./channelTag";
import fixture from "./channelTag.fixture.json";

const idx = buildChannelIndex(TECHNIQUES);

describe("techniqueTag", () => {
  it("совпадает с тегами, уже расставленными в канале инструментом разметки", () => {
    const diff = TECHNIQUES.filter((t) => (fixture as Record<string, string>)[t.id] !== techniqueTag(t)).map(
      (t) => `${t.id}: ${techniqueTag(t)} != ${(fixture as Record<string, string>)[t.id]}`,
    );
    expect(diff).toEqual([]);
  });
});

describe("matchCaption", () => {
  it("находит технику по хэштегу", () => {
    expect(matchCaption("Тренировка\n\n#омоплата", idx).fromTags).toEqual([33]);
  });
  it("узнаёт сленг владельца: клемп, продёргивание, свой тег #ахилл", () => {
    expect(matchCaption("Принципы прохода открытого гарда, выход нижнего в позицию клемп", idx).ids).toContain(382);
    expect(matchCaption("Тейкдаун с продергиванием", idx).ids).toContain(692);
    expect(matchCaption("Выход на ахилл\n\n#ахилл", idx).fromTags).toEqual([49]);
  });
  it("находит по названию с окончанием и не дублирует найденное по тегу", () => {
    const m = matchCaption("Делаем омоплату из гарда #омоплата", idx);
    expect(m.ids.filter((id) => id === 33)).toHaveLength(1);
  });
  it("не засчитывает одиночные общие слова", () => {
    expect(matchCaption("Выход за спину из гарда", idx).fromText).toEqual([]);
  });
  it("несколько техник в одной подписи", () => {
    const m = matchCaption("Спайдер свип, треугольник, омоплата", idx);
    expect(m.ids).toEqual(expect.arrayContaining([31, 33]));
  });
});

describe("missingTags", () => {
  it("возвращает только отсутствующие теги, не путая префиксы", () => {
    const t33 = techniqueTag(TECH_BY_ID[33]);
    expect(missingTags(`текст ${t33}`, [33], TECH_BY_ID)).toEqual([]);
    expect(missingTags("текст #омоплата_x", [33], TECH_BY_ID)).toEqual([t33]);
  });
});

describe("строка со ссылками на карточки", () => {
  it("до трёх техник, смещения указывают на названия", () => {
    const { line, links } = buildAppLine([90, 703, 93, 94], TECH_BY_ID);
    expect(links).toHaveLength(3);
    expect(line.slice(links[0].offset, links[0].offset + links[0].length)).toBe(TECH_BY_ID[90].title.split(" (")[0]);
    expect(links[1].url).toBe("https://t.me/companionminiapp_bot?startapp=t703");
  });
  it("без техник: ссылка на бота", () => {
    expect(buildAppLine([], TECH_BY_ID).links[0].url).toBe("https://t.me/companionminiapp_bot");
  });
  it("снимает новую и старую строку, остальной текст не трогает", () => {
    const body = "Проход\n\n#нислайс";
    expect(stripAppLine(body + "\n\n" + buildAppLine([90], TECH_BY_ID).line)).toBe(body);
    expect(stripAppLine(body + "\n\nВсе техники и дневник тренировок: @companionminiapp_bot")).toBe(body);
    expect(stripAppLine(body)).toBe(body);
  });
});
