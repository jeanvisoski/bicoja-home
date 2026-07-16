import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function AppHeader({
  title,
  subtitle,
  back = true,
  right,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean | string;
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border/60">
      <div className="flex items-center gap-2 px-4 h-14">
        {back ? (
          typeof back === "string" ? (
            <Link to={back} className="-ml-2 p-2 rounded-full hover:bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          ) : (
            <button onClick={() => router.history.back()} className="-ml-2 p-2 rounded-full hover:bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )
        ) : (
          <div className="w-2" />
        )}
        <div className="flex-1 min-w-0">
          {title && <h1 className="text-base font-semibold truncate">{title}</h1>}
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}