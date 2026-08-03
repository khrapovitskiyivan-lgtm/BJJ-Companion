// Уровень доступа к видео. Явный override (demo|pro) из video-urls.json имеет
// приоритет; иначе demo если техника в стартовом наборе (уже курирован как
// «бесплатно новичку»), иначе pro. Single-source: демо не дублируется в json.
export function deriveVideoAccess(accessOverride, isInStarter) {
  if (accessOverride === 'demo' || accessOverride === 'pro') return accessOverride;
  return isInStarter ? 'demo' : 'pro';
}
