import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Shield } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";

export const Route = createFileRoute("/security")({
  component: SecurityPage,
  head: () => ({ meta: [{ title: "Segurança — BICOJÁ" }] }),
});

function SecurityPage() {
  const { session } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
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
    setPassword("");
    setConfirm("");
    toast.success("Senha atualizada.");
  }

  return (
    <PhoneFrame>
      <AppHeader title="Segurança e privacidade" back="/profile" />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="rounded-2xl bg-card border border-border p-4 mb-6">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Conta</p>
              <p className="text-xs text-muted-foreground">{session?.user.email ?? "—"}</p>
            </div>
          </div>
        </div>

        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Trocar senha
        </h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div className="flex items-center gap-3 h-14 rounded-2xl bg-card border border-border px-4">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-3 h-14 rounded-2xl bg-card border border-border px-4">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmar nova senha"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground mt-6">
          Dados de privacidade e política de uso: leia nossos Termos e Política de Privacidade
          (links no cadastro). Exclusão de conta ainda não está disponível por aqui — fale com o
          suporte.
        </p>
      </div>
    </PhoneFrame>
  );
}
