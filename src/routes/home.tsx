import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Zap, Wrench, PaintRoller, Hammer, Sprout, Sparkles, Key, Home as HomeIcon, Lock, Star, BadgeCheck, ChevronRight, Bell } from "lucide-react";
import { PhoneFrame } from "@/components/confia/PhoneFrame";
import { BottomNav } from "@/components/confia/BottomNav";

export const Route = createFileRoute("/home")({
  component: Home,
  head: () => ({ meta: [{ title: "Início — CONFIA" }] }),
});

const categories = [
  { icon: Zap, label: "Eletricista", tint: "bg-amber-100 text-amber-700" },
  { icon: Wrench, label: "Encanador", tint: "bg-sky-100 text-sky-700" },
  { icon: PaintRoller, label: "Pintor", tint: "bg-rose-100 text-rose-700" },
  { icon: Hammer, label: "Pedreiro", tint: "bg-orange-100 text-orange-700" },
  { icon: Sprout, label: "Jardineiro", tint: "bg-emerald-100 text-emerald-700" },
  { icon: Sparkles, label: "Diarista", tint: "bg-violet-100 text-violet-700" },
  { icon: Key, label: "Chaveiro", tint: "bg-yellow-100 text-yellow-700" },
  { icon: HomeIcon, label: "Marido de aluguel", tint: "bg-teal-100 text-teal-700" },
];

const pros = [
  { name: "Marcos Silva", role: "Eletricista", rating: 4.9, reviews: 214, initials: "MS", tint: "from-amber-400 to-orange-500" },
  { name: "Ana Ribeiro", role: "Diarista", rating: 5.0, reviews: 189, initials: "AR", tint: "from-violet-400 to-fuchsia-500" },
  { name: "João Pereira", role: "Encanador", rating: 4.8, reviews: 342, initials: "JP", tint: "from-sky-400 to-blue-500" },
];

function Home() {
  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto pb-4">
        {/* Greeting */}
        <div className="px-5 pt-8 pb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Olá,</p>
            <h1 className="text-2xl font-extrabold tracking-tight font-[Manrope]">Camila 👋</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-11 w-11 rounded-full bg-card border border-border flex items-center justify-center relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-destructive" />
            </button>
            <Link to="/pro" className="h-11 px-3 rounded-full bg-card border border-border flex items-center text-xs font-semibold">
              Sou prestador
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="px-5">
          <Link to="/search" className="flex items-center gap-3 h-14 rounded-2xl bg-card border border-border px-4 shadow-card">
            <Search className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Do que você precisa hoje?</span>
          </Link>
        </div>

        {/* Trust banner */}
        <div className="px-5 mt-5">
          <div className="relative overflow-hidden rounded-3xl bg-hero p-5 text-primary-foreground shadow-float">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute -right-4 bottom-0 h-24 w-24 rounded-full bg-white/10" />
            <div className="relative">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest bg-white/15 rounded-full px-2.5 py-1 mb-3">
                <Lock className="h-3 w-3" /> Garantia CONFIA
              </div>
              <h3 className="text-xl font-extrabold leading-tight mb-1 font-[Manrope]">Pagamento protegido em todo serviço</h3>
              <p className="text-sm text-primary-foreground/80">Seu dinheiro só é liberado quando você aprovar.</p>
            </div>
          </div>
        </div>

        {/* Categories */}
        <section className="mt-6">
          <div className="px-5 flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Categorias</h2>
            <Link to="/search" className="text-xs font-semibold text-primary">Ver todas</Link>
          </div>
          <div className="grid grid-cols-4 gap-3 px-5">
            {categories.map((c) => (
              <Link
                to="/request"
                key={c.label}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${c.tint} group-active:scale-95 transition-transform`}>
                  <c.icon className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-medium text-center leading-tight">{c.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured pros */}
        <section className="mt-7">
          <div className="px-5 flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Prestadores em destaque</h2>
            <Link to="/proposals" className="text-xs font-semibold text-primary">Ver mais</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 [&::-webkit-scrollbar]:hidden">
            {pros.map((p) => (
              <Link to="/proposals" key={p.name} className="min-w-[210px] rounded-2xl bg-card border border-border shadow-card p-4">
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${p.tint} flex items-center justify-center text-white font-bold text-lg mb-3`}>
                  {p.initials}
                </div>
                <div className="flex items-center gap-1 mb-0.5">
                  <p className="font-semibold text-sm">{p.name}</p>
                  <BadgeCheck className="h-4 w-4 text-trust" />
                </div>
                <p className="text-xs text-muted-foreground mb-2">{p.role}</p>
                <div className="flex items-center gap-1 text-xs">
                  <Star className="h-3.5 w-3.5 fill-warn text-warn" />
                  <span className="font-semibold">{p.rating}</span>
                  <span className="text-muted-foreground">({p.reviews})</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Popular */}
        <section className="mt-7 px-5">
          <h2 className="text-base font-bold mb-3">Serviços populares</h2>
          <div className="space-y-2">
            {["Instalação de chuveiro", "Reparo de vazamento", "Faxina completa"].map((s, i) => (
              <Link to="/request" key={s} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-primary font-bold">
                  {i + 1}
                </div>
                <span className="flex-1 text-sm font-medium">{s}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>

        {/* History */}
        <section className="mt-7 px-5">
          <h2 className="text-base font-bold mb-3">Seu histórico</h2>
          <Link to="/tracking" className="block rounded-2xl bg-card border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Reparo hidráulico</p>
                <p className="text-xs text-muted-foreground">Em andamento • João Pereira</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-trust-soft text-trust">A caminho</span>
            </div>
          </Link>
        </section>
      </div>
      <BottomNav variant="client" />
    </PhoneFrame>
  );
}