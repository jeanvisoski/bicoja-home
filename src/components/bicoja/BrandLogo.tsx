type BrandLogoProps = {
  className?: string;
  variant?: "mark" | "full" | "lockup";
};

/** Logo oficial BicoJá. A imagem fica em public para estar disponível em todas as rotas. */
export function BrandLogo({ className = "", variant = "mark" }: BrandLogoProps) {
  if (variant === "full") {
    return (
      <img
        src="/bicaja-logo.png"
        alt="BicoJá"
        className={`object-contain ${className}`}
      />
    );
  }

  if (variant === "lockup") {
    return (
      <span
        aria-label="BicoJá"
        className={`relative inline-flex shrink-0 overflow-hidden ${className}`}
      >
        <img
          src="/bicaja-logo.png"
          alt="BicoJá"
          className="absolute left-1/2 top-[-27%] h-[220%] w-auto max-w-none -translate-x-1/2 object-contain"
        />
      </span>
    );
  }

  return (
    <span
      aria-label="BicoJá"
      className={`relative inline-flex shrink-0 overflow-hidden rounded-xl bg-slate-800 ${className}`}
    >
      <img
        src="/bicaja-logo.png"
        alt=""
        aria-hidden="true"
        className="absolute h-[210%] w-[210%] max-w-none object-cover left-[-55%] top-[-8%]"
      />
    </span>
  );
}
