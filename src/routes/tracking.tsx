import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, MessageCircle, Phone, BadgeCheck, Star } from "lucide-react";
import { PhoneFrame } from "@/components/confia/PhoneFrame";
import { AppHeader } from "@/components/confia/AppHeader";

export const Route = createFileRoute("/tracking")({
  component: Tracking,
  head: () => ({ meta: [{ title: "Andamento — CONFIA" }] }),
});

const steps = [
  { label: "Pedido recebido", time: "14:02", done: true },
  { label: "Prestador aceitou", time: "14:05", done: true },
  { label: "A caminho", time: "14:10", done: true, active: true },
  { label: "Executando", time: "—", done: false },
  { label: "Fotos enviadas", time: "—", done: false },
  { label: "Aguardando confirmação", time: "—", done: false },
  { label: "Concluído", time: "—", done: false },
];

function Tracking() {
  return (
    <PhoneFrame>
      <AppHeader title="Reparo hidráulico" subtitle="Pedido #A2481" back="/home" />

      <div className="flex-1 overflow-y-auto">
        <div className="relative h-56 bg-secondary overflow-hidden">
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 30% 40%, oklch(0.72 0.16 155 / 0.15), transparent 60%), radial-gradient(circle at 70% 60%, oklch(0.32 0.14 265 / 0.15), transparent 60%)" }} />
          <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(oklch(0.9 0.01 260) 1px, transparent 1px), linear-gradient(90deg, oklch(0.9 0.01 260) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 224" preserveAspectRatio="none">
            <path d="M 60 180 Q 150 120 220 130 T 340 60" stroke="oklch(0.32 0.14 265)" strokeWidth="3" strokeDasharray="8 6" fill="none" strokeLinecap="round" />
          </svg>
          <div className="absolute" style={{ left: "12%", top: "72%" }}>
            <div className="h-5 w-5 rounded-full bg-primary border-2 border-background shadow-float" />
          </div>
          <div className="absolute" style={{ right: "12%", top: "22%" }}>
            <div className="h-6 w-6 rounded-full bg-trust border-2 border-background shadow-float animate-pulse-ring" />
          </div>
          <div className="absolute bottom-3 left-3 right-3 bg-background/95 backdrop-blur rounded-2xl p-3 shadow-card flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full bg-trust animate-pulse" />
            <span className="font-semibold">João está a 8 min de você</span>
          </div>
        </div>

        <div className="px-5 pt-4">
          <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-bold flex items-center justify-center">JP</div>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <p className="font-semibold">João Pereira</p>
                  <BadgeCheck className="h-4 w-4 text-trust" />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-warn text-warn" />
                  <span className="font-semibold text-foreground">4.9</span> • 342 avaliações
                </div>
              </div>
              <Link to="/messages" className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-primary" />
              </Link>
              <button className="h-11 w-11 rounded-full bg-primary flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary-foreground" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 pt-6 pb-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Linha do tempo</h3>
          <div className="relative">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-4 pb-5 relative">
                {i < steps.length - 1 && (
                  <div className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${s.done ? "bg-trust" : "bg-border"}`} />
                )}
                <div className={`h-8 w-8 rounded-full flex items-center justify-center relative z-10 ${s.done ? "bg-trust text-primary-foreground" : "bg-muted text-muted-foreground"} ${s.active ? "ring-4 ring-trust/20" : ""}`}>
                  {s.done ? <Check className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-current" />}
                </div>
                <div className="flex-1 pt-1">
                  <p className={`text-sm font-semibold ${s.done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.time}</p>
                </div>
              </div>
            ))}
          </div>

          <Link to="/confirm" className="block mt-2 h-14 rounded-2xl border border-primary text-primary font-semibold text-center leading-[3.5rem]">
            Ver conclusão (demo)
          </Link>
        </div>
      </div>
    </PhoneFrame>
  );
}