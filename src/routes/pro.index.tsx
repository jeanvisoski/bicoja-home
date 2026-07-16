import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, Wallet, Star, Bell, ChevronRight, Wrench, Sparkles, Zap } from "lucide-react";
import { PhoneFrame } from "@/components/confia/PhoneFrame";
import { BottomNav } from "@/components/confia/BottomNav";

export const Route = createFileRoute("/pro/")({
  component: ProDashboard,
  head: () => ({ meta: [{ title: "Painel — CONFIA Pro" }] }),
});

function ProDashboard() {
  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-5 pt-8 pb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Bom dia,</p>
            <h1 className="text-2xl font-extrabold tracking-tight font-[Manrope]">João 👋</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-11 w-11 rounded-full bg-card border border-border flex items-center justify-center relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-destructive" />
            </button>
            <Link to="/home" className="h-11 px-3 rounded-full bg-card border border-border flex items-center text-xs font-semibold">
              Ver como cliente
            </Link>
          </div>
        </div>

        <div className="px-5">
          <div className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-float relative overflow-hidden">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
            <div className="relative">
              <p className="text-xs opacity-80 uppercase tracking-widest font-semibold">Ganhos do mês</p>
              <p className="text-4xl font-extrabold font-[Manrope] mt-1">R$ 4.320</p>
              <div className="flex items-center gap-1 text-xs mt-1 opacity-90"><TrendingUp className="h-3 w-3" /> +18% vs mês passado</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat label="Saldo disponível" value="R$ 1.140" />
                <MiniStat label="A liberar" value="R$ 680" />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 mt-5 grid grid-cols-2 gap-3">
          <Kpi icon={Star} value="4.9" label="Avaliação média" tint="bg-amber-100 text-amber-700" />
          <Kpi icon={Wallet} value="512" label="Serviços" tint="bg-emerald-100 text-emerald-700" />
        </div>

        <section className="px-5 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Novos pedidos</h2>
            <Link to="/pro/orders" className="text-xs font-semibold text-primary">Ver todos</Link>
          </div>
          <div className="space-y-3">
            <Job icon={Wrench} tint="bg-sky-100 text-sky-700" title="Vazamento na pia" client="Camila S." distance="2.1 km" price="R$ 180" urgent />
            <Job icon={Sparkles} tint="bg-violet-100 text-violet-700" title="Faxina completa" client="Rodrigo M." distance="4.8 km" price="R$ 250" />
            <Job icon={Zap} tint="bg-amber-100 text-amber-700" title="Troca de disjuntor" client="Marina L." distance="1.2 km" price="R$ 120" />
          </div>
        </section>

        <section className="px-5 mt-6">
          <h2 className="text-base font-bold mb-3">Agenda de hoje</h2>
          <div className="rounded-2xl bg-card border border-border p-4">
            <div className="flex items-start gap-3">
              <div className="text-center pr-3 border-r border-border">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Hoje</p>
                <p className="text-2xl font-extrabold text-primary font-[Manrope]">15:00</p>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Reparo hidráulico</p>
                <p className="text-xs text-muted-foreground">Camila Santos • Vila Mariana</p>
              </div>
              <span className="text-[10px] font-bold uppercase text-trust bg-trust-soft rounded-full px-2 py-1">Confirmado</span>
            </div>
          </div>
        </section>
      </div>
      <BottomNav variant="pro" />
    </PhoneFrame>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
      <p className="text-[10px] uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-lg font-extrabold font-[Manrope]">{value}</p>
    </div>
  );
}

function Kpi({ icon: Icon, value, label, tint }: { icon: any; value: string; label: string; tint: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-2 ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xl font-extrabold font-[Manrope]">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Job({ icon: Icon, tint, title, client, distance, price, urgent }: { icon: any; tint: string; title: string; client: string; distance: string; price: string; urgent?: boolean }) {
  return (
    <Link to="/pro/orders" className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border shadow-card">
      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate">{title}</p>
          {urgent && <span className="text-[9px] font-bold uppercase text-destructive bg-destructive/10 rounded-full px-1.5 py-0.5">Hoje</span>}
        </div>
        <p className="text-xs text-muted-foreground">{client} • {distance}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-extrabold font-[Manrope]">{price}</p>
        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
      </div>
    </Link>
  );
}