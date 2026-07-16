// Составной персонаж: тело снизу, голова слоем сверху по центру.
// Константы подобраны по превью-композиту (scripts/slice-avatars.mjs).
import { bodySrc, headSrc } from "@/lib/bjj/avatar";
import type { StyleProfile } from "@/lib/bjj/types";

export function Avatar({ profile, className }: { profile: StyleProfile; className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`} style={{ aspectRatio: "204 / 437" }}>
      <img src={bodySrc(profile)} alt="" className="absolute bottom-0 left-0 w-full" />
      <img
        src={headSrc(profile)}
        alt="Персонаж"
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: 0, width: "60%" }}
      />
    </div>
  );
}
