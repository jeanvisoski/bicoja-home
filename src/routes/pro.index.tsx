import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Wallet, Star, Bell, ChevronRight, ShieldCheck, MapPin } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { categoryIcon } from "@/lib/categories";
import { useUnreadCount } from "@/lib/notifications";
import { AppHeader } from "@/components/bicoja/AppHeader";

export const Route = createFileRoute("/pro/")({
  component: ProDashboard,
  head: () => ({ meta: [{ title: "Painel — BICOJÁ Pro" }] }),
});

type ProviderProfile = {
  profile_id: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  headline: string | null;
  specialties: string[];
  city: string | null;
  rating_avg: number;
  rating_count: number;
  jobs_count: number;
  lat: number | null;
  lng: number | null;
  service_radius_km: number;
};

function useProviderProfile(profileId: string | undefined) {
  return useQuery({
    queryKey: ["provider-profile", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_profiles")
        .select(
          "profile_id, headline, specialties, city, rating_avg, rating_count, jobs_count, lat, lng, service_radius_km, profiles(full_name, avatar_url)",
        )
        .eq("profile_id", profileId)
        .maybeSingle<ProviderProfile>();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });
}

function useWallet(providerId: string | undefined) {
  return useQuery({
    queryKey: ["wallet", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("amount, status")
        .eq("provider_id", providerId);
      if (error) throw error;
      const disponivel = data
        .filter((t) => t.status === "disponivel")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const pendente = data
        .filter((t) => t.status === "pendente")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return { disponivel, pendente, total: disponivel + pendente };
    },
    enabled: !!providerId,
  });
}

type OpenRequest = {
  id: string;
  category_id: string;
  description: string;
  urgency: string;
  created_at: string;
  preferred_provider_id: string | null;
  service_categories: { label: string; icon: string } | null;
  profiles: { full_name: string | null } | null;
};

function useOpenRequests() {
  return useQuery({
    queryKey: ["open-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select(
          "id, category_id, description, urgency, created_at, preferred_provider_id, service_categories(label, icon), profiles(full_name)",
        )
        .eq("status", "aberto")
        .order("created_at", { ascending: false })
        .limit(30)
        .returns<OpenRequest[]>();
      if (error) throw error;
      return data;
    },
  });
}

type EligibleRequest = { request_id: string; distance_km: number };
type EligibleDistancesResult = { distances: Map<string, number>; issue: string | null };
function useEligibleRequestDistances(providerId: string | undefined) {
  return useQuery({
    queryKey: ["eligible-open-request-distances", providerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_provider_open_request_distances");
      if (error) {
        console.error("Falha ao consultar solicitações por raio:", error.message);
        return { distances: new Map<string, number>(), issue: error.message } satisfies EligibleDistancesResult;
      }
      return { distances: new Map(((data ?? []) as EligibleRequest[]).map((row) => [row.request_id, Number(row.distance_km)])), issue: null } satisfies EligibleDistancesResult;
    },
    enabled: !!providerId,
  });
}

function useServiceCategoryIds(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-service-category-ids", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_services")
        .select("category_id")
        .eq("provider_id", providerId);
      if (error) throw error;
      return new Set(data.map((service) => service.category_id));
    },
    enabled: !!providerId,
  });
}

function useMyProposalRequestIds(providerId: string | undefined) {
  return useQuery({
    queryKey: ["my-proposal-request-ids", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("request_id")
        .eq("provider_id", providerId);
      if (error) throw error;
      return new Set(data.map((proposal) => proposal.request_id));
    },
    enabled: !!providerId,
  });
}

type MyProviderOrder = {
  id: string;
  status: string;
  price: number;
  total: number;
  created_at: string;
  service_requests: {
    description: string;
    urgency: string;
    service_categories: { label: string } | null;
    profiles: { full_name: string | null } | null;
    addresses: { neighborhood: string | null; city: string | null; state: string | null } | null;
  } | null;
};

const providerOrderStatusLabel: Record<string, string> = {
  aceito: "Confirmado",
  a_caminho: "A caminho",
  executando: "Em execucao",
  fotos_enviadas: "Aguardando cliente",
  aguardando_confirmacao: "Aguardando cliente",
};

const PROVIDER_ACTIVE_STATUSES = [
  "aceito",
  "a_caminho",
  "executando",
  "fotos_enviadas",
  "aguardando_confirmacao",
];

function useMyProviderOrders(providerId: string | undefined) {
  return useQuery({
    queryKey: ["my-provider-orders", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, price, total, created_at, service_requests(description, urgency, service_categories(label), profiles(full_name), addresses(neighborhood, city, state))")
        .eq("provider_id", providerId)
        .in("status", PROVIDER_ACTIVE_STATUSES)
        .order("created_at", { ascending: false })
        .returns<MyProviderOrder[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

function ProDashboard() {
  const { session } = useSession();
  const nav = useNavigate();
  const userId = session?.user.id;
  const { data: provider, isLoading: loadingProvider } = useProviderProfile(userId);
  const { data: wallet } = useWallet(provider?.profile_id);
  const { data: openRequestsRaw = [] } = useOpenRequests();
  const { data: serviceCategoryIds = new Set<string>() } = useServiceCategoryIds(provider?.profile_id);
  const { data: eligibleResult = { distances: new Map<string, number>(), issue: null } } = useEligibleRequestDistances(provider?.profile_id);
  const eligibleDistances = eligibleResult.distances;
  const { data: proposalRequestIds = new Set<string>() } = useMyProposalRequestIds(provider?.profile_id);
  const { data: myOrders = [] } = useMyProviderOrders(provider?.profile_id);
  const { data: unreadCount = 0 } = useUnreadCount(userId);

  const hasLocation = provider?.lat != null && provider?.lng != null;

  const openRequests = openRequestsRaw
    .filter((r) => !r.preferred_provider_id || r.preferred_provider_id === provider?.profile_id)
    .filter((r) => serviceCategoryIds.has(r.category_id))
    .filter((r) => !proposalRequestIds.has(r.id))
    .filter((r) => eligibleDistances.has(r.id))
    .map((r) => ({ ...r, distanceKm: eligibleDistances.get(r.id) ?? null }))
    .sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });

  if (!session) {
    return (
      <PhoneFrame>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <ShieldCheck className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">
            Entre na sua conta para acessar o painel de prestador.
          </p>
          <Link
            to="/login"
            className="h-12 px-6 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center"
          >
            Entrar
          </Link>
        </div>
      </PhoneFrame>
    );
  }

  if (loadingProvider) {
    return (
      <PhoneFrame>
        <div className="flex-1" />
      </PhoneFrame>
    );
  }

  if (!provider) {
    return (
      <PhoneFrame>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <ShieldCheck className="h-12 w-12 text-muted-foreground" />
          <p className="font-semibold">Esta conta não é de prestador</p>
          <p className="text-sm text-muted-foreground">
            Contas de cliente e de prestador são separadas. Para oferecer serviços na BICOJÁ, saia
            desta conta e crie uma conta nova escolhendo "Quero oferecer serviços".
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              nav({ to: "/login" });
            }}
            className="h-12 px-6 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center"
          >
            Sair e criar conta de prestador
          </button>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <AppHeader title="Painel profissional" back={false} />
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-5 pt-8 pb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Bom dia,</p>
            <h1 className="text-2xl font-extrabold tracking-tight font-[Manrope]">
              {provider.profiles?.full_name || provider.headline || "Prestador"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="h-11 w-11 rounded-full bg-card border border-border flex items-center justify-center relative"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-destructive" />
              )}
            </Link>
          </div>
        </div>

        <div className="px-5">
          <div className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-float relative overflow-hidden">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
            <div className="relative">
              <p className="text-xs opacity-80 uppercase tracking-widest font-semibold">
                Saldo total
              </p>
              <p className="text-4xl font-extrabold font-[Manrope] mt-1">
                R$ {(wallet?.total ?? 0).toFixed(2)}
              </p>
              <div className="flex items-center gap-1 text-xs mt-1 opacity-90">
                <TrendingUp className="h-3 w-3" /> {provider.jobs_count} serviços concluídos
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat
                  label="Saldo disponível"
                  value={`R$ ${(wallet?.disponivel ?? 0).toFixed(2)}`}
                />
                <MiniStat label="A liberar" value={`R$ ${(wallet?.pendente ?? 0).toFixed(2)}`} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 mt-5 grid grid-cols-2 gap-3">
          <Kpi
            icon={Star}
            value={String(provider.rating_avg)}
            label="Avaliação média"
            tint="bg-amber-100 text-amber-700"
          />
          <Kpi
            icon={Wallet}
            value={String(provider.jobs_count)}
            label="Serviços"
            tint="bg-emerald-100 text-emerald-700"
          />
        </div>

        <section className="px-5 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Novos pedidos</h2>
          </div>
          {!hasLocation && (
            <Link
              to="/pro/profile"
              className="flex items-center gap-2 mb-3 p-3 rounded-2xl bg-secondary text-xs font-medium"
            >
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              Defina sua localização no perfil para ver os pedidos mais próximos primeiro.
            </Link>
          )}
          <div className="space-y-3">
            {serviceCategoryIds.size === 0 && (
              <Link to="/pro/profile" className="block rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
                Cadastre ao menos um serviço no seu perfil para receber oportunidades daquela categoria.
              </Link>
            )}
            {openRequests.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {serviceCategoryIds.size === 0 ? "" : eligibleResult.issue ? "Não foi possível validar o raio agora. Atualize a configuração do banco e tente novamente." : "Nenhuma solicitação aberta nas suas categorias dentro do seu raio no momento."}
              </p>
            )}
            {openRequests.map((r) => {
              const Icon = categoryIcon(r.service_categories?.icon ?? "Wrench");
              return (
                <Link
                  key={r.id}
                  to="/pro/orders"
                  search={{ requestId: r.id }}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border shadow-card"
                >
                  <div className="h-11 w-11 rounded-2xl flex items-center justify-center bg-sky-100 text-sky-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">
                        {r.service_categories?.label ?? "Serviço"}
                      </p>
                      {r.urgency === "hoje" && (
                        <span className="text-[9px] font-bold uppercase text-destructive bg-destructive/10 rounded-full px-1.5 py-0.5">
                          Hoje
                        </span>
                      )}
                      {r.preferred_provider_id && (
                        <span className="text-[9px] font-bold uppercase text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                          Direto
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.profiles?.full_name ?? "Cliente"}
                      {r.distanceKm != null ? ` • ${r.distanceKm.toFixed(1)} km` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>

        {myOrders.length > 0 && (
          <section className="px-5 mt-6">
            <h2 className="text-base font-bold mb-3">Meus pedidos em andamento</h2>
            <div className="space-y-3">
              {myOrders.map((o) => (
                <Link
                  key={o.id}
                  to="/pro/orders"
                  search={{ orderId: o.id }}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border shadow-card"
                >
                  <div className="h-11 w-11 rounded-2xl flex items-center justify-center bg-emerald-100 text-emerald-700">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {o.service_requests?.service_categories?.label ?? "Serviço"}
                    </p>
                    <p className="text-xs text-foreground/80 line-clamp-2 mt-0.5">{o.service_requests?.description ?? "Detalhes indisponiveis"}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {o.service_requests?.profiles?.full_name ?? "Cliente"}
                      {o.service_requests?.addresses?.city ? ` • ${o.service_requests.addresses.neighborhood ? `${o.service_requests.addresses.neighborhood}, ` : ""}${o.service_requests.addresses.city}/${o.service_requests.addresses.state ?? ""}` : ""}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-[11px] text-primary font-medium">{providerOrderStatusLabel[o.status] ?? o.status}</p>
                      <span className="text-[11px] font-bold text-primary">R$ {Number(o.price).toFixed(2)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      <BottomNav variant="pro" />
    </PhoneFrame>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
      <p className="text-[10px] uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-lg font-extrabold font-[Manrope]">{value}</p>
    </div>
  );
}

function Kpi({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof Star;
  value: string;
  label: string;
  tint: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-2 ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xl font-extrabold font-[Manrope]">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
