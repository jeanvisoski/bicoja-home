import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Wrench, ChevronRight, Inbox, Pencil } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { categoryIcon } from "@/lib/categories";
import { ProfileAvatar } from "@/components/bicoja/ProfileAvatar";
import { AppHeader } from "@/components/bicoja/AppHeader";

export const Route = createFileRoute("/orders")({
  component: Orders,
  head: () => ({ meta: [{ title: "Pedidos — BICOJÁ" }] }),
});

const ACTIVE_STATUSES = [
  "aceito",
  "a_caminho",
  "executando",
  "fotos_enviadas",
  "aguardando_confirmacao",
  "em_disputa",
];
const STATUS_LABEL: Record<string, string> = {
  aceito: "Aceito",
  a_caminho: "A caminho",
  executando: "Em execução",
  fotos_enviadas: "Fotos enviadas",
  aguardando_confirmacao: "Aguardando confirmação",
  em_disputa: "Em disputa",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

type MyOrder = {
  id: string;
  status: string;
  created_at: string;
  service_requests: { service_categories: { label: string } | null } | null;
  provider_profiles: { profiles: { full_name: string | null; avatar_url: string | null } | null } | null;
};

function useMyOrders(clientId: string | undefined) {
  return useQuery({
    queryKey: ["my-orders", clientId],
    queryFn: async () => {
      // Aplica conclusoes que venceram o prazo configurado antes de montar a lista.
      await supabase.rpc("complete_due_orders");
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, created_at, service_requests(service_categories(label)), provider_profiles(profiles(full_name, avatar_url))",
        )
        .eq("client_id", clientId)
        .neq("status", "aguardando_pagamento")
        .order("created_at", { ascending: false })
        .returns<MyOrder[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

type PendingRequest = {
  id: string;
  created_at: string;
  service_categories: { label: string; icon: string } | null;
};

function useMyPendingRequests(clientId: string | undefined) {
  return useQuery({
    queryKey: ["my-pending-requests", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id, created_at, service_categories(label, icon)")
        .eq("client_id", clientId)
        .in("status", ["aberto", "em_negociacao"])
        .order("created_at", { ascending: false })
        .returns<PendingRequest[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

function Orders() {
  const { session } = useSession();
  const [tab, setTab] = useState<"ativos" | "historico">("ativos");
  const { data: orders = [] } = useMyOrders(session?.user.id);
  const { data: pendingRequests = [] } = useMyPendingRequests(session?.user.id);

  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const past = orders.filter((o) => !ACTIVE_STATUSES.includes(o.status));
  const list = tab === "ativos" ? active : past;

  return (
    <PhoneFrame>
      <AppHeader title="Pedidos" back={false} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-8 pb-2">
          <h1 className="text-2xl font-extrabold font-[Manrope] tracking-tight">Seus pedidos</h1>
        </div>
        <div className="px-5 mt-2">
          <div className="grid grid-cols-2 p-1 bg-secondary rounded-2xl">
            {(["ativos", "historico"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`h-10 rounded-xl text-sm font-semibold transition-all ${tab === t ? "bg-background shadow-card text-foreground" : "text-muted-foreground"}`}
              >
                {t === "ativos" ? "Ativos" : "Histórico"}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 mt-4 space-y-3 pb-6">
          {tab === "ativos" && pendingRequests.length > 0 && (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
                Aguardando propostas
              </p>
              {pendingRequests.map((r) => {
                const Icon = categoryIcon(r.service_categories?.icon ?? "Wrench");
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border shadow-card"
                  >
                    <Link
                      to="/proposals"
                      search={{ requestId: r.id }}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-amber-100 text-amber-700 shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {r.service_categories?.label ?? "Serviço"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          Aguardando prestadores enviarem orçamento
                        </p>
                      </div>
                    </Link>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        Aberto
                      </span>
                      <Link
                        to="/request-edit"
                        search={{ requestId: r.id }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-primary"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </Link>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1 pt-3">
                Contratados
              </p>
            </>
          )}

          {list.length === 0 && pendingRequests.length === 0 && (
            <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
              <Inbox className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">
                {tab === "ativos"
                  ? "Nenhum pedido em andamento."
                  : "Nenhum pedido no histórico ainda."}
              </p>
            </div>
          )}
          {list.length === 0 && tab === "ativos" && pendingRequests.length > 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum pedido contratado ainda.
            </p>
          )}
          {list.map((o) => (
            <Link
              key={o.id}
              to="/tracking"
              search={{ orderId: o.id }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border shadow-card"
            >
              <ProfileAvatar name={o.provider_profiles?.profiles?.full_name} src={o.provider_profiles?.profiles?.avatar_url} className="h-12 w-12 rounded-2xl text-sm" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {o.service_requests?.service_categories?.label ?? "Serviço"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {o.provider_profiles?.profiles?.full_name ?? "Prestador"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-trust-soft text-trust">
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}
