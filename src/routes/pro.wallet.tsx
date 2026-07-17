import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Clock3, WalletCards } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";

export const Route = createFileRoute("/pro/wallet")({
  component: ProWallet,
  head: () => ({ meta: [{ title: "Carteira — BICOJÁ Pro" }] }),
});

type WalletTransaction = {
  id: string;
  type: "credito_pendente" | "credito_liberado" | "saque";
  amount: number;
  status: "pendente" | "disponivel" | "pago";
  available_at: string | null;
  created_at: string;
  orders: { service_requests: { service_categories: { label: string } | null } | null } | null;
};

type PayoutDestination = { pix_key: string; pix_key_type: string; holder_name: string; status: string };

function usePayoutDestination(providerId: string | undefined) {
  return useQuery({
    queryKey: ["payout-destination", providerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_payout_destinations").select("pix_key, pix_key_type, holder_name, status").eq("provider_id", providerId).maybeSingle<PayoutDestination>();
      if (error) throw error;
      return data;
    }, enabled: !!providerId,
  });
}

function useWalletTransactions(providerId: string | undefined) {
  return useQuery({
    queryKey: ["wallet-transactions", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id, type, amount, status, available_at, created_at, orders(service_requests(service_categories(label)))")
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false })
        .returns<WalletTransaction[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

function ProWallet() {
  const { session } = useSession();
  const { data: transactions = [], isLoading } = useWalletTransactions(session?.user.id);
  const { data: destination, refetch: refetchDestination } = usePayoutDestination(session?.user.id);
  const [pixKey, setPixKey] = useState("");
  const [keyType, setKeyType] = useState("cpf");
  const [holderName, setHolderName] = useState("");
  const [savingDestination, setSavingDestination] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const available = transactions
    .filter((transaction) => transaction.status === "disponivel")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const pending = transactions
    .filter((transaction) => transaction.status === "pendente")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  async function saveDestination() {
    if (!session || !pixKey.trim() || !holderName.trim()) return toast.error("Informe chave Pix e nome do titular.");
    setSavingDestination(true);
    const { error } = await supabase.from("provider_payout_destinations").upsert({ provider_id: session.user.id, method: "pix", pix_key: pixKey.trim(), pix_key_type: keyType, holder_name: holderName.trim(), status: destination?.status === "verificado" ? "verificado" : "pendente", updated_at: new Date().toISOString() });
    setSavingDestination(false);
    if (error) return toast.error(error.message);
    toast.success("Chave Pix enviada para validacao.");
    setPixKey(""); setHolderName("");
    refetchDestination();
  }

  async function requestPayout() {
    setRequestingPayout(true);
    const { error } = await supabase.rpc("request_provider_payout");
    setRequestingPayout(false);
    if (error) return toast.error(error.message);
    toast.success("Saque solicitado. A equipe fara a transferencia apos validar.");
  }

  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto pb-5">
        <header className="px-5 pt-8 pb-5 bg-hero text-primary-foreground">
          <p className="text-xs uppercase tracking-widest font-semibold opacity-80">Carteira profissional</p>
          <p className="text-4xl font-extrabold font-[Manrope] mt-1">R$ {available.toFixed(2)}</p>
          <p className="text-sm opacity-85 mt-1">Saldo disponível para receber</p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-[10px] uppercase tracking-wider opacity-75">Disponível</p><p className="font-bold mt-1">R$ {available.toFixed(2)}</p></div>
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-[10px] uppercase tracking-wider opacity-75">A liberar</p><p className="font-bold mt-1">R$ {pending.toFixed(2)}</p></div>
          </div>
        </header>

        <section className="px-5 mt-6">
          <div className="rounded-2xl border border-border bg-card p-4 mb-5">
            <h2 className="font-bold text-sm">Receber por Pix</h2>
            {destination?.status === "verificado" ? <p className="text-xs text-trust mt-1">Chave Pix verificada. Saldo disponivel pode ser solicitado.</p> : <p className="text-xs text-muted-foreground mt-1">Cadastre uma chave Pix. A equipe precisa validar antes do primeiro saque.</p>}
            <div className="mt-3 space-y-2"><select value={keyType} onChange={(e) => setKeyType(e.target.value)} className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm"><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="telefone">Telefone</option><option value="aleatoria">Chave aleatoria</option></select><input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder={destination ? "Nova chave Pix (opcional)" : "Chave Pix"} className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm" /><input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder={destination ? "Novo titular (opcional)" : "Nome do titular"} className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm" /></div>
            <div className="grid grid-cols-2 gap-2 mt-3"><button onClick={saveDestination} disabled={savingDestination} className="h-10 rounded-xl border border-primary text-primary text-xs font-semibold disabled:opacity-50">{savingDestination ? "Salvando..." : "Salvar chave"}</button><button onClick={requestPayout} disabled={requestingPayout || available <= 0 || destination?.status !== "verificado"} className="h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">{requestingPayout ? "Solicitando..." : `Sacar R$ ${available.toFixed(2)}`}</button></div>
          </div>
          <div className="flex items-center justify-between mb-3"><h1 className="text-base font-bold">Extrato</h1><span className="text-xs text-muted-foreground">Recebimentos e saques</span></div>
          {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Carregando carteira...</p>}
          {!isLoading && transactions.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-7 text-center text-muted-foreground"><WalletCards className="h-9 w-9 mx-auto mb-3 opacity-50" /><p className="text-sm">Ainda não há movimentações.</p><p className="text-xs mt-1">Os ganhos aparecem aqui quando um cliente contrata e confirma seu serviço.</p></div>
          )}
          <div className="space-y-2">
            {transactions.map((transaction) => {
              const isWithdrawal = transaction.type === "saque";
              const pendingTransaction = transaction.status === "pendente";
              const label = isWithdrawal ? "Saque" : pendingTransaction ? "Recebimento em processamento" : "Recebimento liberado";
              return (
                <div key={transaction.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isWithdrawal ? "bg-rose-100 text-rose-700" : pendingTransaction ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{isWithdrawal ? <ArrowUpRight className="h-5 w-5" /> : pendingTransaction ? <Clock3 className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted-foreground truncate">{transaction.orders?.service_requests?.service_categories?.label ?? new Date(transaction.created_at).toLocaleDateString("pt-BR")}</p></div>
                  <p className={`text-sm font-bold ${isWithdrawal ? "text-rose-700" : "text-emerald-700"}`}>{isWithdrawal ? "−" : "+"} R$ {Number(transaction.amount).toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <BottomNav variant="pro" />
    </PhoneFrame>
  );
}
