import { ShieldCheck, Lock, Headphones, Scale, Star, BadgeCheck } from "lucide-react";
import type { ComponentType } from "react";

const map: Record<string, { icon: ComponentType<{ className?: string }>; label: string }> = {
  verified: { icon: BadgeCheck, label: "Verificado" },
  payment: { icon: Lock, label: "Pagamento protegido" },
  support: { icon: Headphones, label: "Suporte humano" },
  mediation: { icon: Scale, label: "Mediação de conflitos" },
  reviews: { icon: Star, label: "Avaliações reais" },
  shield: { icon: ShieldCheck, label: "Garantia BICOJÁ" },
};

export function TrustBadge({ kind, size = "sm" }: { kind: keyof typeof map; size?: "sm" | "md" }) {
  const { icon: Icon, label } = map[kind];
  const cls = size === "md" ? "text-sm px-3 py-1.5" : "text-xs px-2.5 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-trust-soft text-trust font-medium ${cls}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function TrustRow() {
  return (
    <div className="flex flex-wrap gap-1.5">
      <TrustBadge kind="verified" />
      <TrustBadge kind="payment" />
      <TrustBadge kind="support" />
    </div>
  );
}
