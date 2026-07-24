import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Search, Wrench, Lock, Star, BadgeCheck, ChevronRight, Bell } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { useCategories, categoryIcon } from "@/lib/categories";
import { useUnreadCount } from "@/lib/notifications";
import { ProfileAvatar } from "@/components/bicoja/ProfileAvatar";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { getViewMode } from "@/lib/view-mode";

export const Route = createFileRoute("/home")({
  component: Home,
  head: () => ({ meta: [{ title: "Início — BICOJÁ" }] }),
});

const CATEGORY_TINTS = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-orange-100 text-orange-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-yellow-100 text-yellow-700",
  "bg-teal-100 text-teal-700",
];

function useGreetingName() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data } = useQuery({
    queryKey: ["profile-name", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
  if (data?.full_name) return data.full_name.split(" ")[0];
  if (session?.user.email) return session.user.email.split("@")[0];
  return "visitante";
}

function useIsProvider(profileId: string | undefined) {
  return useQuery({
    queryKey: ["is-provider", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_profiles")
        .select("profile_id")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    enabled: !!profileId,
  });
}

type FeaturedProvider = {
  profile_id: string;
  rating_avg: number;
  rating_count: number;
  jobs_count: number;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};

function useFeaturedProviders() {
  return useQuery({
    queryKey: ["featured-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_profiles")
        .select("profile_id, rating_avg, rating_count, jobs_count, profiles(full_name, avatar_url)")
        .eq("verification_status", "verificado")
        .order("rating_avg", { ascending: false })
        .limit(3)
        .returns<FeaturedProvider[]>();
      if (error) throw error;
      return data;
    },
  });
}

type ActiveOrder = {
  id: string;
  status: string;
  request_id: string;
  provider_profiles: {
    profiles: { full_name: string | null; avatar_url: string | null } | null;
  } | null;
};

function useActiveOrder() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ["active-order", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, request_id, provider_profiles(profiles(full_name, avatar_url))")
        .eq("client_id", userId)
        .not("status", "in", "(concluido,cancelado)")
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<ActiveOrder[]>()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  aceito: "Aceito",
  a_caminho: "A caminho",
  executando: "Em execução",
  fotos_enviadas: "Fotos enviadas",
  aguardando_confirmacao: "Aguardando confirmação",
  em_disputa: "Em disputa",
};

function Home() {
  const { session } = useSession();
  const nav = useNavigate();
  const { data: isProvider, isLoading: checkingRole } = useIsProvider(session?.user.id);
  const greetingName = useGreetingName();
  const { data: categories = [] } = useCategories();
  const { data: pros = [] } = useFeaturedProviders();
  const { data: activeOrder } = useActiveOrder();
  const { data: unreadCount = 0 } = useUnreadCount(session?.user.id);

  // Conta que é só prestador (nunca virou dual-role) continua indo direto
  // pro painel de prestador. Quem já é cliente e prestador, e escolheu ver
  // como cliente pelo alternador, fica aqui em vez de ser jogado de volta.
  const viewingAsClient = getViewMode() === "cliente";

  useEffect(() => {
    if (isProvider && !viewingAsClient) nav({ to: "/pro", replace: true });
  }, [isProvider, viewingAsClient, nav]);

  if (checkingRole || (isProvider && !viewingAsClient)) {
    return (
      <PhoneFrame>
        <AppHeader title="Início" back={false} />
        <div className="flex-1" />
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <AppHeader title="Início" back={false} />
      <div className="flex-1 overflow-y-auto pb-4">
        {/* Greeting */}
        <div className="px-5 pt-8 pb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Olá,</p>
            <h1 className="text-2xl font-extrabold tracking-tight font-[Manrope] capitalize">
              {greetingName}
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

        {/* Search */}
        <div className="px-5">
          <Link
            to="/search"
            className="flex items-center gap-3 h-14 rounded-2xl bg-card border border-border px-4 shadow-card"
          >
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
                <Lock className="h-3 w-3" /> Garantia BICOJÁ
              </div>
              <h3 className="text-xl font-extrabold leading-tight mb-1 font-[Manrope]">
                Pagamento protegido em todo serviço
              </h3>
              <p className="text-sm text-primary-foreground/80">
                Seu dinheiro só é liberado quando você aprovar.
              </p>
            </div>
          </div>
        </div>

        {/* Categories */}
        <section className="mt-6">
          <div className="px-5 flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Categorias</h2>
            <Link to="/search" className="text-xs font-semibold text-primary">
              Ver todas
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3 px-5">
            {categories.map((c, i) => {
              const Icon = categoryIcon(c.icon);
              return (
                <Link
                  to="/search"
                  search={{ category: c.slug }}
                  key={c.id}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div
                    className={`h-14 w-14 rounded-2xl flex items-center justify-center ${CATEGORY_TINTS[i % CATEGORY_TINTS.length]} group-active:scale-95 transition-transform`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-medium text-center leading-tight">
                    {c.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Featured pros */}
        {pros.length > 0 && (
          <section className="mt-7">
            <div className="px-5 flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Prestadores em destaque</h2>
              <Link to="/search" className="text-xs font-semibold text-primary">
                Ver mais
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto px-5 pb-2 [&::-webkit-scrollbar]:hidden">
              {pros.map((p) => {
                const name = p.profiles?.full_name || "Prestador BICOJÁ";
                return (
                  <Link
                    key={p.profile_id}
                    to="/providers/$providerId"
                    params={{ providerId: p.profile_id }}
                    className="min-w-[210px] rounded-2xl bg-card border border-border shadow-card p-4"
                  >
                    <ProfileAvatar
                      name={name}
                      src={p.profiles?.avatar_url}
                      className="h-14 w-14 rounded-2xl text-lg mb-3"
                    />
                    <div className="flex items-center gap-1 mb-0.5">
                      <p className="font-semibold text-sm">{name}</p>
                      <BadgeCheck className="h-4 w-4 text-trust" />
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Star className="h-3.5 w-3.5 fill-warn text-warn" />
                      <span className="font-semibold">{p.rating_avg}</span>
                      <span className="text-muted-foreground">({p.rating_count})</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Popular */}
        <section className="mt-7 px-5">
          <h2 className="text-base font-bold mb-3">Serviços populares</h2>
          <div className="space-y-2">
            {["Instalação de chuveiro", "Reparo de vazamento", "Faxina completa"].map((s, i) => (
              <Link
                to="/request"
                key={s}
                className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border"
              >
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
        {activeOrder && (
          <section className="mt-7 px-5">
            <h2 className="text-base font-bold mb-3">Seu histórico</h2>
            <Link
              to="/tracking"
              search={{ orderId: activeOrder.id }}
              className="block rounded-2xl bg-card border border-border p-4"
            >
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  name={activeOrder.provider_profiles?.profiles?.full_name}
                  src={activeOrder.provider_profiles?.profiles?.avatar_url}
                  className="h-11 w-11 rounded-2xl text-sm"
                />
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {activeOrder.provider_profiles?.profiles?.full_name ?? "Prestador"}
                  </p>
                  <p className="text-xs text-muted-foreground">Pedido em andamento</p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-trust-soft text-trust">
                  {ORDER_STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
                </span>
              </div>
            </Link>
          </section>
        )}
      </div>
      <BottomNav variant="client" />
    </PhoneFrame>
  );
}
