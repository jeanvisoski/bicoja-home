import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, BadgeCheck, Clock, Inbox } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { ProfileAvatar } from "@/components/bicoja/ProfileAvatar";
import { BottomNav } from "@/components/bicoja/BottomNav";

export const Route = createFileRoute("/proposals")({
  component: Proposals,
  validateSearch: (search: Record<string, unknown>): { requestId?: string } => ({
    requestId: typeof search.requestId === "string" ? search.requestId : undefined,
  }),
  head: () => ({ meta: [{ title: "Propostas — BICOJÁ" }] }),
});

type ProposalRow = {
  id: string;
  price: number;
  pricing_type: "fixed" | "range";
  price_min: number;
  price_max: number;
  eta_minutes: number | null;
  duration_minutes: number | null;
  status: string;
  provider_profiles: {
    profile_id: string;
    rating_avg: number;
    rating_count: number;
    jobs_count: number;
    verification_status: string;
    profiles: { full_name: string | null; avatar_url: string | null } | null;
  } | null;
};

function useProposals(requestId: string | undefined) {
  return useQuery({
    queryKey: ["proposals", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select(
          "id, price, pricing_type, price_min, price_max, eta_minutes, duration_minutes, status, provider_profiles(profile_id, rating_avg, rating_count, jobs_count, verification_status, profiles(full_name, avatar_url))",
        )
        .eq("request_id", requestId)
        .order("price")
        .returns<ProposalRow[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });
}

function Proposals() {
  const { requestId } = Route.useSearch();
  const { session } = useSession();
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { data: proposals = [], isLoading } = useProposals(requestId);

  async function hire(proposalId: string) {
    if (!session) {
      toast.error("Entre na sua conta para contratar.");
      nav({ to: "/login" });
      return;
    }
    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal || !requestId) return;

    const { data: orderId, error } = await supabase.rpc("create_checkout_order", { p_proposal_id: proposalId });
    if (error || !orderId) {
      toast.error(error?.message ?? "Nao foi possivel criar o checkout.");
      return;
    }

    const { data: requestPhotos } = await supabase.from("request_photos").select("photo_url").eq("request_id", requestId);
    if (requestPhotos?.length) {
      await supabase.from("order_photos").insert(requestPhotos.map((p) => ({ order_id: orderId, kind: "antes", photo_url: p.photo_url })));
    }
    queryClient.invalidateQueries({ queryKey: ["proposals", requestId] });
    nav({ to: "/payment", search: { orderId } });
  }

  return (
    <PhoneFrame>
      <AppHeader
        title="Propostas recebidas"
        subtitle={
          isLoading
            ? "Carregando..."
            : `${proposals.length} ${proposals.length === 1 ? "profissional" : "profissionais"} responderam`
        }
        back
        right={
          <Link to="/orders" className="text-xs font-semibold text-primary px-1">Pedidos</Link>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!requestId && (
          <EmptyState message="Nenhuma solicitação selecionada. Volte e crie um pedido primeiro." />
        )}
        {requestId && !isLoading && proposals.length === 0 && (
          <EmptyState message="Ainda não chegaram propostas. Prestadores verificados vão ver sua solicitação e enviar orçamentos em breve." />
        )}
        {proposals.map((p, idx) => {
          const provider = p.provider_profiles;
          const name = provider?.profiles?.full_name || "Prestador BICOJÁ";
          return (
            <div
              key={p.id}
              className="rounded-2xl bg-card border border-border shadow-card p-4 animate-float-up"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="flex items-start gap-3">
                <ProfileAvatar name={name} src={provider?.profiles?.avatar_url} className="h-14 w-14 rounded-2xl text-lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-semibold truncate">{name}</p>
                    {provider?.verification_status === "verificado" && (
                      <BadgeCheck className="h-4 w-4 text-trust shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {provider?.jobs_count ?? 0} serviços
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-warn text-warn" />
                      <span className="font-semibold">{provider?.rating_avg ?? 0}</span>
                      <span className="text-muted-foreground">({provider?.rating_count ?? 0})</span>
                    </span>
                    {p.duration_minutes && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Serviço: {p.duration_minutes} min
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Orçamento</p>
                  <p className="text-lg font-extrabold text-foreground font-[Manrope]">
                    {p.pricing_type === "range"
                      ? `R$ ${Number(p.price_min).toFixed(2)} – ${Number(p.price_max).toFixed(2)}`
                      : `R$ ${Number(p.price).toFixed(2)}`}
                  </p>
                  {p.pricing_type === "range" && <p className="text-[10px] text-muted-foreground">valor final após o serviço</p>}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  to="/providers/$providerId"
                  params={{ providerId: provider?.profile_id ?? "" }}
                  className="h-11 rounded-xl border border-border bg-card font-semibold text-sm flex items-center justify-center gap-2"
                >
                  Ver perfil
                </Link>
                <button
                  onClick={() => hire(p.id)}
                  disabled={p.status !== "pendente"}
                  className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  {p.status === "aceita" ? "Contratado" : p.status === "recusada" ? "Não selecionado" : "Contratar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <BottomNav variant="client" />
    </PhoneFrame>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6 text-muted-foreground">
      <Inbox className="h-10 w-10 mb-3 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
