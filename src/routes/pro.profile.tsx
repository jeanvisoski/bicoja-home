import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Star, Wrench, ChevronRight, LogOut } from "lucide-react";
import { PhoneFrame } from "@/components/confia/PhoneFrame";
import { BottomNav } from "@/components/confia/BottomNav";
import { TrustBadge } from "@/components/confia/TrustBadge";

export const Route = createFileRoute("/pro/profile")({
  component: ProProfile,
  head: () => ({ meta: [{ title: "Perfil — CONFIA Pro" }] }),
});

function ProProfile() {
  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="bg-hero text-primary-foreground px-5 pt-10 pb-16 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute right-4 top-4">
            <TrustBadge kind="verified" />
          </div>
          <div className="relative flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 border-4 border-white/20 flex items-center justify-center text-3xl font-extrabold shadow-float">JP</div>
            <div className="flex items-center gap-1 mt-3">
              <p className="text-xl font-extrabold font-[Manrope]">João Pereira</p>
              <BadgeCheck className="h-5 w-5" />
            </div>
            <p className="text-sm opacity-90">Encanador • São Paulo</p>
            <div className="flex items-center gap-4 mt-4 text-sm">
              <Stat value="4.9" label="Nota" />
              <div className="h-8 w-px bg-white/20" />
              <Stat value="512" label="Serviços" />
              <div className="h-8 w-px bg-white/20" />
              <Stat value="3 anos" label="Plataforma" />
            </div>
          </div>
        </div>

        <div className="px-5 -mt-8">
          <div className="rounded-2xl bg-card border border-border shadow-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Especialidades</p>
            <div className="flex flex-wrap gap-2">
              {["Vazamentos", "Chuveiro", "Torneiras", "Ralos", "Caixa d'água"].map((s) => (
                <span key={s} className="h-8 px-3 rounded-full bg-secondary text-xs font-semibold flex items-center">{s}</span>
              ))}
            </div>
          </div>
        </div>

        <section className="px-5 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Portfólio</h2>
            <button className="text-xs font-semibold text-primary">Adicionar</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["from-sky-300 to-blue-500", "from-emerald-300 to-teal-500", "from-amber-300 to-orange-500", "from-rose-300 to-pink-500", "from-violet-300 to-purple-500", "from-slate-300 to-slate-500"].map((t, i) => (
              <div key={i} className={`aspect-square rounded-2xl bg-gradient-to-br ${t}`} />
            ))}
          </div>
        </section>

        <section className="px-5 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Últimas avaliações</h2>
            <button className="text-xs font-semibold text-primary">Ver todas</button>
          </div>
          <div className="space-y-2">
            {[
              { n: "Camila S.", c: "Rápido e organizado, deixou tudo limpo!" },
              { n: "Rafael T.", c: "Ótimo profissional, super atencioso." },
            ].map((r, i) => (
              <div key={i} className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold">{r.n}</p>
                  <div className="flex">
                    {[1,2,3,4,5].map(k => <Star key={k} className="h-3 w-3 fill-warn text-warn" />)}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{r.c}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="px-5 mt-6">
          <button className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-destructive font-semibold">
            <LogOut className="h-4 w-4" /> Sair da conta
          </button>
        </div>
      </div>
      <BottomNav variant="pro" />
    </PhoneFrame>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-base font-extrabold font-[Manrope]">{value}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}