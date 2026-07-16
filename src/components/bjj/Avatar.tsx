// Составной персонаж: голова сзади, тело ПОВЕРХ — шея головы прячется за
// воротником ги, линия шеи встык (длинные волосы уходят за воротник).
// Константы подобраны по превью-композиту (scripts/slice-avatars.mjs):
// голова 60% ширины, перекрытие 100px в координатах тела (204x341) -> 204/429.
import { bodySrc, headSrc } from "@/lib/bjj/avatar";
import type { StyleProfile } from "@/lib/bjj/types";

export function Avatar({ profile, className }: { profile: StyleProfile; className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`} style={{ aspectRatio: "204 / 429" }}>
      <img
        src={headSrc(profile)}
        alt="Персонаж"
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: 0, width: "60%" }}
      />
      <img src={bodySrc(profile)} alt="" className="absolute bottom-0 left-0 w-full" />
    </div>
  );
}
