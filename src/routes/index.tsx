import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BrandLogo } from "@/components/bicoja/BrandLogo";

export const Route = createFileRoute("/")({
  component: Onboarding,
});

const slides = [
  {
    eyebrow: "Bem-vindo à BICOJÁ",
    title: "Contrate profissionais com segurança.",
    body: "Eletricistas, encanadores, diaristas e mais — verificados, avaliados e prontos para atender.",
    tint: "from-primary to-primary/70",
  },
  {
    eyebrow: "Pagamento protegido",
    title: "Seu dinheiro só é liberado quando o serviço termina.",
    body: "A BICOJÁ guarda o valor até você confirmar que ficou tudo certo. Sem surpresas.",
    tint: "from-trust to-trust/70",
  },
  {
    eyebrow: "Prestadores verificados",
    title: "Cada profissional passa por checagem.",
    body: "Identidade, documentos e reputação conferidos. Aqui só entra quem inspira confiança.",
    tint: "from-primary to-trust",
  },
];

function Onboarding() {
  const [i, setI] = useState(0);
  const S = slides[i];
  const last = i === slides.length - 1;
  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col px-6 pt-10 pb-8">
        <div className="flex items-center justify-between">
          <BrandLogo variant="lockup" className="h-16 w-32" />
          {!last && (
            <Link to="/login" className="text-sm text-muted-foreground font-medium">
              Pular
            </Link>
          )}
        </div>

        <div
          key={i}
          className="flex-1 flex flex-col items-center justify-center text-center animate-float-up"
        >
          <div className={`h-56 w-56 rounded-[40%] bg-gradient-to-br ${S.tint} flex items-center justify-center shadow-float mb-10 overflow-hidden`}>
            <BrandLogo variant="full" className="h-full w-full scale-[1.25]" />
          </div>
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
            {S.eyebrow}
          </p>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground mb-4 font-[Manrope]">
            {S.title}
          </h2>
          <p className="text-base text-muted-foreground max-w-xs">{S.body}</p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, k) => (
            <span
              key={k}
              className={`h-1.5 rounded-full transition-all ${k === i ? "w-8 bg-primary" : "w-1.5 bg-border"}`}
            />
          ))}
        </div>

        {last ? (
          <Link
            to="/login"
            className="h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center shadow-card active:scale-[0.98] transition-transform"
          >
            Começar
          </Link>
        ) : (
          <button
            onClick={() => setI(i + 1)}
            className="h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 shadow-card active:scale-[0.98] transition-transform"
          >
            Continuar <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </PhoneFrame>
  );
}
