import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, MessageCircle, Phone, BadgeCheck, Star } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { MapView } from "@/components/bicoja/MapView";
import { ProfileAvatar } from "@/components/bicoja/ProfileAvatar";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/tracking")({
  component: Tracking,
  validateSearch: (search: Record<string, unknown>): { orderId?: string } => ({
    orderId: typeof search.orderId === "string" ? search.orderId : undefined,
  }),
  head: () => ({ meta: [{ title: "Andamento — BICOJÁ" }] }),
});

const STATUS_ORDER = [
  "aceito",
  "a_caminho",
  "executando",
  "fotos_enviadas",
  "aguardando_confirmacao",
  "concluido",
] as const;

const STEPS = [
  "Pedido recebido",
  "Prestador aceitou",
  "A caminho",
  "Executando",
  "Fotos enviadas",
  "Aguardando confirmação",
  "Concluído",
];

type OrderTracking = {
  id: string;
  status: string;
  service_requests: {
    description: string;
    service_categories: { label: string } | null;
    addresses: { lat: number | null; lng: number | null } | null;
  } | null;
  provider_profiles: {
    profiles: { full_name: string | null; avatar_url: string | null } | null;
    rating_avg: number;
    rating_count: number;
    lat: number | null;
    lng: number | null;
  } | null;
};

function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order-tracking", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, service_requests(description, service_categories(label), addresses(lat, lng)), provider_profiles(profiles(full_name, avatar_url), rating_avg, rating_count, lat, lng)",
        )
        .eq("id", orderId)
        .returns<OrderTracking[]>()
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

function Tracking() {
  const { orderId } = Route.useSearch();
  const { data: order } = useOrder(orderId);

  const statusIndex = order
    ? STATUS_ORDER.indexOf(order.status as (typeof STATUS_ORDER)[number])
    : -1;
  // "aceito" já cobre os dois primeiros passos visuais (recebido + prestador aceitou).
  const doneThreshold = statusIndex;

  const provider = order?.provider_profiles;
  const providerName = provider?.profiles?.full_name ?? "Prestador";
  const canReviewCompletion = order?.status === "fotos_enviadas" || order?.status === "aguardando_confirmacao";
  const address = order?.service_requests?.addresses;
  const mapLat = address?.lat ?? provider?.lat ?? null;
  const mapLng = address?.lng ?? provider?.lng ?? null;
  const trackingMessage: Record<string, string> = {
    aceito: "Pedido confirmado. Aguarde o prestador informar a saída.",
    a_caminho: `${providerName} está a caminho`,
    executando: `${providerName} está executando o serviço`,
    fotos_enviadas: "O prestador enviou as fotos da conclusão.",
    aguardando_confirmacao: "Aguardando sua confirmação da conclusão.",
    concluido: "Serviço concluído.",
  };
  const category = order?.service_requests?.service_categories?.label ?? "Serviço";

  return (
    <PhoneFrame>
      <AppHeader
        title={category}
        subtitle={orderId ? `Pedido #${orderId.slice(0, 8)}` : ""}
        back
        right={<Link to="/orders" className="text-xs font-semibold text-primary px-1">Pedidos</Link>}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="relative h-56 overflow-hidden">
          <MapView lat={mapLat} lng={mapLng} height={224} />
          <div className="absolute bottom-3 left-3 right-3 bg-background/95 backdrop-blur rounded-2xl p-3 shadow-card flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full bg-trust animate-pulse" />
            <span className="font-semibold">{trackingMessage[order?.status ?? ""] ?? "Atualizando pedido..."}</span>
          </div>
        </div>

        <div className="px-5 pt-4">
          <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <ProfileAvatar name={providerName} src={provider?.profiles?.avatar_url} className="h-12 w-12 rounded-2xl" />
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <p className="font-semibold">{providerName}</p>
                  <BadgeCheck className="h-4 w-4 text-trust" />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-warn text-warn" />
                  <span className="font-semibold text-foreground">
                    {provider?.rating_avg ?? 0}
                  </span>{" "}
                  • {provider?.rating_count ?? 0} avaliações
                </div>
              </div>
              <Link
                to="/messages"
                className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center"
              >
                <MessageCircle className="h-5 w-5 text-primary" />
              </Link>
              <button className="h-11 w-11 rounded-full bg-primary flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary-foreground" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 pt-6 pb-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Linha do tempo
          </h3>
          <div className="relative">
            {STEPS.filter((label) => label !== "Prestador aceitou").map((label, i) => {
              const done = i <= doneThreshold;
              const active = i === doneThreshold;
              return (
                <div key={label} className="flex gap-4 pb-5 relative">
                  {i < STEPS.length - 1 && (
                    <div
                      className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${done ? "bg-trust" : "bg-border"}`}
                    />
                  )}
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center relative z-10 ${done ? "bg-trust text-primary-foreground" : "bg-muted text-muted-foreground"} ${active ? "ring-4 ring-trust/20" : ""}`}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-current" />
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <p
                      className={`text-sm font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {canReviewCompletion ? (
            <Link
              to="/confirm"
              search={{ orderId }}
              className="block mt-2 h-14 rounded-2xl border border-primary text-primary font-semibold text-center leading-[3.5rem]"
            >
              Revisar conclusão
            </Link>
          ) : (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              A revisão ficará disponível quando o prestador enviar as fotos finais.
            </p>
          )}
        </div>
      </div>
      <BottomNav variant="client" />
    </PhoneFrame>
  );
}
