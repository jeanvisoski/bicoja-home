import { createFileRoute, Link } from "@tanstack/react-router";
import { Wrench, Sparkles, Zap, ChevronRight } from "lucide-react";
import { PhoneFrame } from "@/components/confia/PhoneFrame";
import { BottomNav } from "@/components/confia/BottomNav";
import { useState } from "react";

export const Route = createFileRoute("/orders")({
  component: Orders,
  head: () => ({ meta: [{ title: "Pedidos — CONFIA" }] }),
});

const active = [
  { icon: Wrench, title: "Reparo hidráulico", pro: "João Pereira", status: "A caminho", tone: "bg-trust-soft text-trust", tint: "bg-sky-100 text-sky-700", to: "/tracking" },
  { icon: Sparkles, title: "Faxina completa", pro: "Ana Ribeiro", status: "Agendado", tone: "bg-secondary text-primary", tint: "bg-violet-100 text-violet-700", to: "/tracking" },
];
const past = [
  { icon: Zap, title: "Troca de disjuntor", pro: "Marcos Silva", status: "Concluído", tint: "bg-amber-100 text-amber-700" },
  { icon: Wrench, title: "Instalação chuveiro", pro: "Rafael Costa", status: "Concluído", tint: "bg-sky-100 text-sky-700" },
];

function Orders() {
  const [tab, setTab] = useState<"ativos" | "historico">("ativos");
  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-8 pb-2">
          <h1 className="text-2xl font-extrabold font-[Manrope] tracking-tight">Seus pedidos</h1>
        </div>
        <div className="px-5 mt-2">
          <div className="grid grid-cols-2 p-1 bg-secondary rounded-2xl">
            {(["ativos", "historico"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`h-10 rounded-xl text-sm font-semibold transition-all ${tab === t ? "bg-background shadow-card text-foreground" : "text-muted-foreground"}`}
              >
                {t === "ativos" ? "Ativos" : "Histórico"}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 mt-4 space-y-3 pb-6">
          {(tab === "ativos" ? active : past).map((o, i) => (
            <Link key={i} to={"to" in o ? (o as any).to : "/tracking"} className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border shadow-card">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${o.tint}`}>
                <o.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{o.title}</p>
                <p className="text-xs text-muted-foreground truncate">{o.pro}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${"tone" in o ? (o as any).tone : "bg-secondary text-muted-foreground"}`}>{o.status}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}