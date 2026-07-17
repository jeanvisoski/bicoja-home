import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, ClipboardList, MessageCircle, User, LayoutDashboard, Wallet } from "lucide-react";
import type { ComponentType } from "react";

type Item = { to: string; label: string; icon: ComponentType<{ className?: string }> };

const clientItems: Item[] = [
  { to: "/home", label: "Início", icon: Home },
  { to: "/search", label: "Buscar", icon: Search },
  { to: "/orders", label: "Pedidos", icon: ClipboardList },
  { to: "/messages", label: "Mensagens", icon: MessageCircle },
  { to: "/profile", label: "Perfil", icon: User },
];

const proItems: Item[] = [
  { to: "/pro", label: "Painel", icon: LayoutDashboard },
  { to: "/pro/orders", label: "Pedidos", icon: ClipboardList },
  { to: "/pro/wallet", label: "Carteira", icon: Wallet },
  { to: "/messages", label: "Mensagens", icon: MessageCircle },
  { to: "/pro/profile", label: "Perfil", icon: User },
];

export function BottomNav({ variant = "client" }: { variant?: "client" | "pro" }) {
  const items = variant === "pro" ? proItems : clientItems;
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky bottom-0 z-40 bg-card/95 backdrop-blur border-t border-border">
      <div className="grid grid-cols-5 px-1 pt-1.5 pb-2 safe-bottom">
        {items.map((it) => {
          const active = path === it.to || (it.to !== "/pro" && path.startsWith(it.to));
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className="flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors"
            >
              <div className={`flex items-center justify-center h-9 w-14 rounded-full transition-all ${active ? "bg-primary/10" : ""}`}>
                <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
