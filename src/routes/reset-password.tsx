import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { supabase } from "@/lib/supabase";
import { passwordStrength } from "@/lib/format";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  head: () => ({ meta: [{ title: "Nova senha — BICOJÁ" }] }),
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const nav = useNavigate();

  const strength = passwordStrength(password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!strength.isStrong) {
      toast.error(
        "Sua senha precisa ser forte: pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo.",
      );
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada! Entre com a nova senha.");
    nav({ to: "/login" });
  }

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col px-6 pt-14 pb-8">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-hero items-center justify-center mb-5 shadow-float">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-[Manrope]">Nova senha</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Escolha uma senha forte para sua conta.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3" autoComplete="off">
          <div className="flex items-center gap-3 h-14 rounded-2xl bg-card border border-border px-4 shadow-card">
            <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha"
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-muted-foreground shrink-0"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {password.length > 0 && (
            <div className="px-1 -mt-2">
              <div className="flex gap-1 mb-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${i < strength.score ? strength.color : "bg-secondary"}`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Força da senha: <span className="font-semibold">{strength.label}</span>
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 h-14 rounded-2xl bg-card border border-border px-4 shadow-card">
            <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nova senha"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 shadow-card active:scale-[0.99] transition-transform disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </PhoneFrame>
  );
}
