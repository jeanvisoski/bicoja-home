import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, AlertTriangle, Sparkles } from "lucide-react";
import { PhoneFrame } from "@/components/confia/PhoneFrame";
import { AppHeader } from "@/components/confia/AppHeader";

export const Route = createFileRoute("/confirm")({
  component: Confirm,
  head: () => ({ meta: [{ title: "Confirmar conclusão — CONFIA" }] }),
});

function Confirm() {
  return (
    <PhoneFrame>
      <AppHeader title="Conclusão" subtitle="Reparo hidráulico" back="/tracking" />

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32">
        <div className="rounded-2xl bg-trust-soft/50 p-4 flex items-start gap-3 border border-trust/20">
          <Sparkles className="h-5 w-5 text-trust mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Serviço finalizado!</p>
            <p className="text-xs text-muted-foreground">Confira as fotos e confirme a conclusão para liberar o pagamento.</p>
          </div>
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-6 mb-3">Antes</h3>
        <div className="grid grid-cols-2 gap-2">
          <PhotoTile tint="from-slate-300 to-slate-500" />
          <PhotoTile tint="from-slate-400 to-slate-600" />
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-6 mb-3">Depois</h3>
        <div className="grid grid-cols-2 gap-2">
          <PhotoTile tint="from-emerald-300 to-emerald-500" />
          <PhotoTile tint="from-teal-300 to-emerald-600" />
        </div>

        <div className="mt-6 p-4 rounded-2xl bg-card border border-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Observações do prestador</p>
          <p className="text-sm">Troquei o sifão e a conexão da torneira. Testei por 15 minutos — sem vazamentos. Recomendo trocar a válvula em 6 meses.</p>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-background/0 pt-8 space-y-2">
        <Link to="/rate" className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 shadow-card active:scale-[0.99] transition-transform">
          <Check className="h-5 w-5" /> Confirmar conclusão
        </Link>
        <button className="w-full h-12 rounded-2xl text-destructive font-semibold flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Reportar problema
        </button>
      </div>
    </PhoneFrame>
  );
}

function PhotoTile({ tint }: { tint: string }) {
  return (
    <div className={`aspect-[4/3] rounded-2xl bg-gradient-to-br ${tint} shadow-card`} />
  );
}