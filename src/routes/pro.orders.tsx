import { createFileRoute, Link } from "@tanstack/react-router";
import { Wrench, MapPin, Camera, Play, Check, DollarSign, ArrowRight } from "lucide-react";
import { PhoneFrame } from "@/components/confia/PhoneFrame";
import { AppHeader } from "@/components/confia/AppHeader";
import { useState } from "react";

export const Route = createFileRoute("/pro/orders")({
  component: ProOrder,
  head: () => ({ meta: [{ title: "Pedido — CONFIA Pro" }] }),
});

function ProOrder() {
  const [phase, setPhase] = useState<"receber" | "executar" | "recebimento">("receber");

  return (
    <PhoneFrame>
      <AppHeader title="Pedido #A2481" back="/pro" />
      <div className="flex-1 overflow-y-auto pb-32">
        {phase === "receber" && (
          <div className="p-5 space-y-4 animate-float-up">
            <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-400 to-orange-500 text-white font-bold flex items-center justify-center">CS</div>
                <div className="flex-1">
                  <p className="font-semibold">Camila Santos</p>
                  <p className="text-xs text-muted-foreground">Cliente há 2 anos • 4.9 ★</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center"><Wrench className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold">Vazamento na pia</p>
                  <p className="text-xs text-muted-foreground">Categoria: Encanador</p>
                </div>
              </div>
              <p className="text-sm">Vazamento embaixo da pia da cozinha, água pingando desde ontem. Preciso resolver hoje se possível.</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <PhotoTile tint="from-slate-300 to-slate-500" />
              <PhotoTile tint="from-slate-400 to-slate-600" />
              <PhotoTile tint="from-slate-300 to-slate-400" />
            </div>

            <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Vila Mariana, SP</p>
                <p className="text-xs text-muted-foreground">2,1 km de você</p>
              </div>
            </div>

            <div className="rounded-2xl bg-trust-soft/60 border border-trust/20 p-4">
              <p className="text-xs uppercase font-bold text-trust tracking-widest mb-1">Preço sugerido</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-extrabold font-[Manrope]">R$ 180</p>
                <p className="text-xs text-muted-foreground">baseado em serviços similares</p>
              </div>
            </div>
          </div>
        )}

        {phase === "executar" && (
          <div className="p-5 space-y-4 animate-float-up">
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Serviço em andamento</p>
              <p className="text-sm">Registre fotos e observações. O cliente recebe atualizações em tempo real.</p>
            </div>
            <button className="w-full h-14 rounded-2xl border-2 border-dashed border-border flex items-center justify-center gap-2 text-primary font-semibold">
              <Camera className="h-5 w-5" /> Adicionar fotos do serviço
            </button>
            <textarea placeholder="Observações para o cliente..." className="w-full h-32 p-4 rounded-2xl bg-card border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        )}

        {phase === "recebimento" && (
          <div className="p-5 space-y-4 animate-float-up">
            <div className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-float text-center">
              <p className="text-xs opacity-80 uppercase tracking-widest">Recebimento previsto</p>
              <p className="text-4xl font-extrabold font-[Manrope] mt-1">R$ 172,00</p>
              <p className="text-xs opacity-80 mt-1">após taxa de plataforma</p>
            </div>
            <Step done label="Pagamento recebido" desc="Cliente pagou R$ 180" />
            <Step done label="Pagamento protegido" desc="Valor retido pela CONFIA" />
            <Step active label="50% reservado" desc="R$ 86 liberado em 24h" />
            <Step label="50% liberado" desc="Após confirmação do cliente" />
            <Step label="Saque disponível" desc="Transferência para sua conta" />
          </div>
        )}
      </div>
      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-background/0 pt-8 space-y-2">
        {phase === "receber" && (
          <>
            <button onClick={() => setPhase("executar")} className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-card">
              <DollarSign className="h-5 w-5" /> Enviar orçamento
            </button>
            <button className="w-full h-12 rounded-2xl text-muted-foreground font-medium">Recusar</button>
          </>
        )}
        {phase === "executar" && (
          <>
            <button className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-card">
              <Play className="h-5 w-5" /> Iniciar serviço
            </button>
            <button onClick={() => setPhase("recebimento")} className="w-full h-12 rounded-2xl border border-border font-semibold flex items-center justify-center gap-2">
              <Check className="h-4 w-4" /> Concluir serviço
            </button>
          </>
        )}
        {phase === "recebimento" && (
          <Link to="/pro" className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-card">
            Voltar ao painel <ArrowRight className="h-5 w-5" />
          </Link>
        )}
      </div>
    </PhoneFrame>
  );
}

function PhotoTile({ tint }: { tint: string }) {
  return <div className={`aspect-square rounded-2xl bg-gradient-to-br ${tint}`} />;
}
function Step({ done, active, label, desc }: { done?: boolean; active?: boolean; label: string; desc?: string }) {
  return (
    <div className={`p-4 rounded-2xl border flex items-center gap-3 ${done ? "border-trust/30 bg-trust-soft/40" : active ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <div className={`h-9 w-9 rounded-full flex items-center justify-center ${done ? "bg-trust text-primary-foreground" : active ? "bg-primary text-primary-foreground animate-pulse-ring" : "bg-muted text-muted-foreground"}`}>
        {done ? <Check className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-current" />}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
    </div>
  );
}