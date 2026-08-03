// === ЛОГОТИП BJJ COMPANION ===
// Logo — компактный знак-иконка для шапки/аватара (public/mark.png: буквы BJJ
// в золотой C на navy-плитке). BrandLogo — полноразмерный webp (public/logo.webp,
// эмблема-грэпплеры) в белой карточке для заставок (онбординг, «О приложении»).

// Полный лого-локап (заставка): онбординг, «О приложении».
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-xs overflow-hidden rounded-2xl bg-white p-2 shadow-sm ${className}`}>
      <img
        src="/logo.webp"
        alt="BJJ Companion"
        width={1200}
        height={686}
        loading="eager"
        className="h-auto w-full"
      />
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/mark.png"
      alt=""
      width={size}
      height={size}
      className="shrink-0"
    />
  );
}
