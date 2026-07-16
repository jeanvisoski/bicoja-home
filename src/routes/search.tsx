import { createFileRoute, Link } from "@tanstack/react-router";
import { Search as SearchIcon, TrendingUp, Zap, Wrench, PaintRoller, Hammer, Sprout, Sparkles, Key, Home } from "lucide-react";
import { PhoneFrame } from "@/components/confia/PhoneFrame";
import { BottomNav } from "@/components/confia/BottomNav";

export const Route = createFileRoute("/search")({
  component: SearchPage,
  head: () => ({ meta: [{ title: "Buscar — CONFIA" }] }),
});

const all = [
  { icon: Zap, label: "Eletricista" },
  { icon: Wrench, label: "Encanador" },
  { icon: PaintRoller, label: "Pintor" },
  { icon: Hammer, label: "Pedreiro" },
  { icon: Sprout, label: "Jardineiro" },
  { icon: Sparkles, label: "Diarista" },
  { icon: Key, label: "Chaveiro" },
  { icon: Home, label: "Marido de aluguel" },
];

function SearchPage() {
  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-5 pt-8">
          <h1 className="text-2xl font-extrabold font-[Manrope] tracking-tight mb-4">Buscar</h1>
          <div className="flex items-center gap-3 h-14 rounded-2xl bg-card border border-border px-4 shadow-card">
            <SearchIcon className="h-5 w-5 text-muted-foreground" />
            <input placeholder="Serviço, categoria, prestador..." className="flex-1 bg-transparent outline-none text-sm" />
          </div>
        </div>

        <section className="mt-6 px-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Populares agora</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Vazamento", "Faxina", "Chuveiro elétrico", "Pintura de quarto", "Poda de árvore", "Chaveiro 24h"].map((t) => (
              <button key={t} className="h-9 px-4 rounded-full bg-secondary text-sm font-medium">{t}</button>
            ))}
          </div>
        </section>

        <section className="mt-7 px-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Todas as categorias</h2>
          <div className="grid grid-cols-2 gap-2">
            {all.map((c) => (
              <Link to="/request" key={c.label} className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-primary">
                  <c.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold">{c.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}