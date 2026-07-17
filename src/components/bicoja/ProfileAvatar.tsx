import { useState } from "react";

type ProfileAvatarProps = {
  name?: string | null;
  src?: string | null;
  className?: string;
  alt?: string;
};

/** Exibe a foto cadastrada; as iniciais são somente um fallback para perfis antigos. */
export function ProfileAvatar({ name, src, className = "", alt }: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`shrink-0 overflow-hidden bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center font-bold ${className}`}
    >
      {src && !imageFailed ? (
        <img src={src} alt={alt ?? `Foto de ${name ?? "perfil"}`} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
      ) : (
        initials
      )}
    </div>
  );
}
