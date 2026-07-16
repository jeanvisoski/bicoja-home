import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, ShieldCheck } from "lucide-react";
import { PhoneFrame } from "@/components/confia/PhoneFrame";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({ meta: [{ title: "Entrar — CONFIA" }] }),
});

function SocialButton({ children, icon }: { children: string; icon: React.ReactNode }) {
  return (
    <button className="w-full h-14 rounded-2xl bg-card border border-border flex items-center justify-center gap-3 font-semibold text-foreground active:scale-[0.99] transition-transform shadow-card">
      {icon}
      {children}
    </button>
  );
}

function Login() {
  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col px-6 pt-14 pb-8">
        <div className="text-center mb-10">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-hero items-center justify-center mb-5 shadow-float">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-[Manrope]">Entrar na CONFIA</h1>
          <p className="text-muted-foreground mt-2 text-sm">Rápido, seguro e sem burocracia.</p>
        </div>

        <div className="space-y-3">
          <SocialButton icon={<GoogleIcon />}>Continuar com Google</SocialButton>
          <SocialButton icon={<AppleIcon />}>Continuar com Apple</SocialButton>
          <SocialButton icon={<Mail className="h-5 w-5" />}>Continuar com email</SocialButton>
        </div>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Link
          to="/home"
          className="w-full h-12 rounded-2xl text-primary font-semibold flex items-center justify-center hover:bg-muted"
        >
          Continuar como visitante
        </Link>

        <p className="text-[11px] text-muted-foreground text-center mt-auto pt-6 leading-relaxed">
          Ao continuar você concorda com nossos <span className="text-primary font-medium">Termos</span> e <span className="text-primary font-medium">Política de Privacidade</span>.
        </p>
      </div>
    </PhoneFrame>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
  );
}
function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
  );
}