// Конфиг плеера Bunny.net Stream. LIBRARY_ID публичный (не секрет), из env.
export const BUNNY_LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID as
  | string
  | undefined;

// Строит embed-URL Bunny iframe-плеера. libraryId параметризован для тестов.
// Формат: https://iframe.mediadelivery.net/embed/{libraryId}/{guid}
// Токен-параметр (Фаза 1 монетизации) добавится здесь одной точкой.
export function bunnyEmbedUrl(
  videoId: string,
  libraryId: string | undefined = BUNNY_LIBRARY_ID,
): string {
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
}
