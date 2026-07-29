import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Shield, Download } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { downloadJson, exportMyData } from "@/lib/data-export";

export const Route = createFileRoute("/security")({
  component: SecurityPage,
  head: () => ({ meta: [{ title: "Segurança — BICOJÁ" }] }),
});

function SecurityPage() {
  const { session } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportData() {
    if (!session) return;
    setExporting(true);
    try {
      const data = await exportMyData(session.user.id);
      downloadJson(`bicoja-meus-dados-${new Date().toISOString().slice(0, 10)}.json`, data);
      toast.success("Seus dados foram baixados.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar seus dados.");
    } finally {
      setExporting(false);
    }
  }

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

  async function deleteAccount() {
    if (
      !window.confirm(
        "Deseja excluir sua conta? Seus dados pessoais serão removidos e esta ação não pode ser desfeita.",
      )
    )
      return;
    setDeleting(true);
    const { error } = await supabase.functions.invoke("delete-account");
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.auth.signOut();
    toast.success("Conta excluída. Seus dados pessoais foram removidos.");
    window.location.assign("/login");
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

        <section className="mt-8 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" /> Baixar meus dados
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Gera um arquivo com tudo que a BICOJÁ guarda sobre você: perfil, endereços, pedidos,
            propostas, avaliações e mensagens enviadas.
          </p>
          <button
            onClick={exportData}
            disabled={exporting}
            className="mt-4 h-11 w-full rounded-xl border border-border text-sm font-semibold disabled:opacity-50"
          >
            {exporting ? "Gerando..." : "Baixar meus dados (.json)"}
          </button>
        </section>

        <section className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
          <h2 className="text-sm font-bold text-destructive">Excluir conta</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Seus dados pessoais, endereços e arquivos serão removidos. Dados mínimos de pedidos e
            pagamentos podem ser mantidos anonimizados quando exigidos por lei.
          </p>
          <button
            onClick={deleteAccount}
            disabled={deleting}
            className="mt-4 h-11 w-full rounded-xl border border-destructive text-sm font-semibold text-destructive disabled:opacity-50"
          >
            {deleting ? "Excluindo..." : "Excluir minha conta"}
          </button>
        </section>

        <p className="text-[11px] text-muted-foreground mt-6 text-center">
          Leia nossos{" "}
          <Link to="/terms" className="text-primary font-semibold">
            Termos de Uso
          </Link>{" "}
          e{" "}
          <Link to="/privacy" className="text-primary font-semibold">
            Política de Privacidade
          </Link>
          .
        </p>
      </div>
      <BottomNav variant="client" />
    </PhoneFrame>
  );
}
