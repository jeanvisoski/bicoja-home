import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Wrench,
  MapPin,
  Play,
  Check,
  DollarSign,
  ArrowRight,
  Camera,
  Images,
  CalendarClock,
  Send,
  Inbox,
} from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { uploadPhoto } from "@/lib/storage";

export const Route = createFileRoute("/pro/orders")({
  component: ProOrder,
  validateSearch: (search: Record<string, unknown>): { requestId?: string; orderId?: string } => ({
    requestId: typeof search.requestId === "string" ? search.requestId : undefined,
    orderId: typeof search.orderId === "string" ? search.orderId : undefined,
  }),
  head: () => ({ meta: [{ title: "Pedido — BICOJÁ Pro" }] }),
});

type RequestDetail = {
  id: string;
  description: string;
  urgency: string;
  availability_start: string | null;
  availability_end: string | null;
  availability_start_time: string | null;
  availability_end_time: string | null;
  service_categories: { label: string } | null;
  profiles: { full_name: string | null } | null;
};

function useRequestDetail(requestId: string | undefined) {
  return useQuery({
    queryKey: ["pro-request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select(
          "id, description, urgency, availability_start, availability_end, availability_start_time, availability_end_time, service_categories(label), profiles(full_name)",
        )
        .eq("id", requestId)
        .returns<RequestDetail[]>()
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });
}

type OrderDetail = {
  id: string;
  status: string;
  price: number;
  platform_fee: number;
  total: number;
  pricing_type: "fixed" | "range";
  quoted_price_min: number;
  quoted_price_max: number;
  duration_minutes: number | null;
  final_price: number;
  client_id: string;
  service_requests: {
    description: string;
    contact_name: string | null;
    contact_phone: string | null;
    attendee_name: string | null;
    service_categories: { label: string } | null;
  } | null;
  profiles: { full_name: string | null } | null;
};

function useOrderDetail(orderId: string | undefined) {
  return useQuery({
    queryKey: ["pro-order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, price, platform_fee, total, pricing_type, quoted_price_min, quoted_price_max, duration_minutes, final_price, client_id, service_requests(description, contact_name, contact_phone, attendee_name, service_categories(label))",
        )
        .eq("id", orderId)
        .returns<OrderDetail[]>()
        .single();
      if (error) throw error;
      const { data: client } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.client_id)
        .single();
      return { ...data, profiles: client };
    },
    enabled: !!orderId,
  });
}

type ExistingProposal = {
  id: string;
  price: number;
  pricing_type: "fixed" | "range";
  price_min: number;
  price_max: number;
  status: string;
};

function useExistingProposal(requestId: string | undefined, providerId: string | undefined) {
  return useQuery({
    queryKey: ["existing-proposal", requestId, providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, price, pricing_type, price_min, price_max, status")
        .eq("request_id", requestId)
        .eq("provider_id", providerId)
        .maybeSingle<ExistingProposal>();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId && !!providerId,
  });
}

type MyProposal = {
  id: string;
  request_id: string;
  price: number;
  status: string;
  created_at: string;
  service_requests: {
    description: string;
    service_categories: { label: string } | null;
  } | null;
};

function useMyProposals(providerId: string | undefined) {
  return useQuery({
    queryKey: ["my-proposals", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select(
          "id, request_id, price, status, created_at, service_requests(description, service_categories(label))",
        )
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false })
        .returns<MyProposal[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

const PROPOSAL_STATUS: Record<string, string> = {
  pendente: "Aguardando resposta",
  aceita: "Aceita",
  recusada: "Não selecionada",
  expirada: "Expirada",
};

function ProOrder() {
  const { requestId, orderId } = Route.useSearch();
  const { session } = useSession();
  const nav = useNavigate();
  const queryClient = useQueryClient();

  const { data: request } = useRequestDetail(requestId);
  const { data: order } = useOrderDetail(orderId);
  const { data: existingProposal } = useExistingProposal(requestId, session?.user.id);
  const { data: myProposals = [], isLoading: loadingProposals } = useMyProposals(session?.user.id);

  const [price, setPrice] = useState("");
  const [pricingType, setPricingType] = useState<"fixed" | "range">("fixed");
  const [priceMax, setPriceMax] = useState("");
  const [eta, setEta] = useState("");
  const [duration, setDuration] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [note, setNote] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [scheduledEndTime, setScheduledEndTime] = useState("");
  const [scheduleTouched, setScheduleTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const locationWatchRef = useRef<number | null>(null);
  const lastLocationSentRef = useRef(0);

  async function publishLiveLocation(position: GeolocationPosition, force = false) {
    if (!session || !orderId) return false;
    const now = Date.now();
    if (!force && now - lastLocationSentRef.current < 10_000) return true;
    const { latitude, longitude, accuracy } = position.coords;
    const { error } = await supabase.from("order_provider_locations").upsert(
      {
        order_id: orderId,
        provider_id: session.user.id,
        lat: latitude,
        lng: longitude,
        accuracy_meters: Number.isFinite(accuracy) ? accuracy : null,
      },
      { onConflict: "order_id" },
    );
    if (error) {
      if (force) toast.error(`NÃ£o foi possÃ­vel compartilhar sua localizaÃ§Ã£o: ${error.message}`);
      return false;
    }
    lastLocationSentRef.current = now;
    return true;
  }

  function stopLiveTracking() {
    if (locationWatchRef.current != null)
      navigator.geolocation.clearWatch(locationWatchRef.current);
    locationWatchRef.current = null;
  }

  async function startLiveTracking(showError = false) {
    if (!orderId || !session || !navigator.geolocation) {
      if (showError)
        toast.error("Ative a localizaÃ§Ã£o do aparelho para compartilhar o deslocamento.");
      return false;
    }
    const initialPosition = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 10_000,
      });
    });
    if (!initialPosition) {
      if (showError)
        toast.error("NÃ£o foi possÃ­vel obter sua localizaÃ§Ã£o. Verifique a permissÃ£o do GPS.");
      return false;
    }
    const saved = await publishLiveLocation(initialPosition, true);
    if (!saved) return false;
    if (locationWatchRef.current == null) {
      locationWatchRef.current = navigator.geolocation.watchPosition(
        (position) => void publishLiveLocation(position),
        () => undefined,
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
      );
    }
    return true;
  }

  useEffect(() => {
    if (order?.status === "a_caminho") void startLiveTracking();
    else stopLiveTracking();
    return stopLiveTracking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status, orderId, session?.user.id]);

  // Pré-preenche com a janela que o cliente informou -- o prestador confirma
  // ou ajusta a data/horário real dentro (ou perto) dela ao enviar o orçamento.
  useEffect(() => {
    if (!request || scheduleTouched) return;
    if (request.urgency === "hoje") {
      setScheduledDate(new Date().toISOString().slice(0, 10));
    } else if (request.availability_start) {
      setScheduledDate(request.availability_start);
    }
    if (request.availability_start_time)
      setScheduledStartTime(request.availability_start_time.slice(0, 5));
    if (request.availability_end_time)
      setScheduledEndTime(request.availability_end_time.slice(0, 5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  async function handlePickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !session) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadPhoto(session.user.id, "orders", file);
      setPhotos((p) => [...p, url]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar foto.");
    }
    setUploadingPhoto(false);
  }

  async function sendProposal() {
    if (!session || !requestId) return;
    const min = Number(price);
    const max = pricingType === "range" ? Number(priceMax) : min;
    if (!min || !max || max < min) {
      toast.error("Informe valores válidos para o orçamento.");
      return;
    }
    if (!scheduledDate || !scheduledStartTime || !scheduledEndTime) {
      toast.error("Informe a data e o horário em que você fará o serviço.");
      return;
    }
    if (scheduledEndTime <= scheduledStartTime) {
      toast.error("O horário final precisa ser depois do horário inicial.");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("proposals").insert({
      request_id: requestId,
      provider_id: session.user.id,
      price: min,
      pricing_type: pricingType,
      price_min: min,
      price_max: max,
      eta_minutes: Number(eta) || null,
      duration_minutes: Number(duration) || null,
      message: note || null,
      scheduled_date: scheduledDate,
      scheduled_start_time: scheduledStartTime,
      scheduled_end_time: scheduledEndTime,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Orçamento enviado ao cliente.");
    nav({ to: "/pro" });
  }

  async function advanceOrder(nextStatus: string, eventNote?: string) {
    if (!orderId) return false;
    if (nextStatus === "fotos_enviadas" && photos.length === 0) {
      toast.error("Envie ao menos uma foto do serviço concluído antes de finalizar.");
      return false;
    }
    let amount: number | null = null;
    if (nextStatus === "fotos_enviadas") {
      amount = Number(finalPrice);
      if (
        !amount ||
        !order ||
        amount < Number(order.quoted_price_min) ||
        amount > Number(order.quoted_price_max)
      ) {
        toast.error(
          `Informe o valor final dentro do orçamento aceito: R$ ${Number(order?.quoted_price_min ?? 0).toFixed(2)} a R$ ${Number(order?.quoted_price_max ?? 0).toFixed(2)}.`,
        );
        return false;
      }
    }
    setSending(true);
    if (nextStatus === "fotos_enviadas") {
      const { error: photosError } = await supabase
        .from("order_photos")
        .insert(photos.map((photo_url) => ({ order_id: orderId, kind: "depois", photo_url })));
      if (photosError) {
        setSending(false);
        toast.error(photosError.message);
        return false;
      }
    }
    const { error } = await supabase.rpc("transition_order", {
      p_order_id: orderId,
      p_next_status: nextStatus,
      p_final_price: amount,
      p_note: eventNote ?? null,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (nextStatus === "fotos_enviadas")
      toast.success("Fotos enviadas ao cliente para confirmação.");
    queryClient.invalidateQueries({ queryKey: ["pro-order", orderId] });
    if (nextStatus === "executando") {
      stopLiveTracking();
      await supabase.from("order_provider_locations").delete().eq("order_id", orderId);
    }
    return true;
  }

  async function markOnTheWay() {
    const transitioned = await advanceOrder("a_caminho", "Prestador informou que estÃ¡ a caminho.");
    if (!transitioned) return;
    const locationStarted = await startLiveTracking(true);
    if (!locationStarted)
      toast.warning(
        "O pedido estÃ¡ a caminho, mas a localizaÃ§Ã£o ao vivo nÃ£o pÃ´de ser iniciada.",
      );
  }

  // Modo "receber": ver uma solicitação aberta e enviar orçamento (ainda não é um pedido).
  if (requestId) {
    return (
      <PhoneFrame>
        <AppHeader title="Nova solicitação" back="/pro" />
        <div className="flex-1 overflow-y-auto pb-32">
          <div className="p-5 space-y-4 animate-float-up">
            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{request?.service_categories?.label ?? "Serviço"}</p>
                  <p className="text-xs text-muted-foreground">
                    {request?.profiles?.full_name ?? "Cliente"}
                  </p>
                </div>
              </div>
              <p className="text-sm">{request?.description}</p>
            </div>

            <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">
                Endereço completo aparece após você ser contratado.
              </p>
            </div>

            {request?.availability_start && request.availability_end && (
              <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
                <CalendarClock className="h-5 w-5 text-primary" />
                <p className="text-sm">
                  <span className="font-semibold">Cliente disponível: </span>
                  {request.urgency === "hoje"
                    ? "Hoje"
                    : `${new Date(`${request.availability_start}T12:00:00`).toLocaleDateString("pt-BR")} até ${new Date(`${request.availability_end}T12:00:00`).toLocaleDateString("pt-BR")}`}
                  {request.availability_start_time && request.availability_end_time
                    ? ` · ${request.availability_start_time.slice(0, 5)}–${request.availability_end_time.slice(0, 5)}`
                    : ""}
                </p>
              </div>
            )}

            {existingProposal ? (
              <div className="rounded-2xl bg-trust-soft/60 border border-trust/20 p-4">
                <p className="text-sm font-semibold text-trust">
                  Você já enviou um orçamento para este cliente.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Valor enviado:{" "}
                  {existingProposal.pricing_type === "range"
                    ? `R$ ${Number(existingProposal.price_min).toFixed(2)} – ${Number(existingProposal.price_max).toFixed(2)}`
                    : `R$ ${Number(existingProposal.price).toFixed(2)}`}{" "}
                  · Status: {existingProposal.status}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-trust-soft/60 border border-trust/20 p-4 space-y-3">
                <p className="text-xs uppercase font-bold text-trust tracking-widest">
                  Seu orçamento
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPricingType("fixed")}
                    className={`h-10 rounded-xl text-xs font-semibold border ${pricingType === "fixed" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
                  >
                    Valor fechado
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingType("range")}
                    className={`h-10 rounded-xl text-xs font-semibold border ${pricingType === "range" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
                  >
                    Faixa de valor
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder={pricingType === "range" ? "Valor mínimo" : "Valor fechado"}
                    className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-lg font-bold outline-none"
                  />
                </div>
                {pricingType === "range" && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">até R$</span>
                    <input
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="Valor máximo"
                      className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-lg font-bold outline-none"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Chega em (min)</span>
                  <input
                    value={eta}
                    onChange={(e) => setEta(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="Ex.: 30"
                    className="w-20 h-11 px-3 rounded-xl bg-background border border-border text-sm font-semibold outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Duração (min)</span>
                  <input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="Ex.: 60"
                    className="w-20 h-11 px-3 rounded-xl bg-background border border-border text-sm font-semibold outline-none"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Quando você fará o serviço</p>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => {
                      setScheduledDate(e.target.value);
                      setScheduleTouched(true);
                    }}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      type="time"
                      value={scheduledStartTime}
                      onChange={(e) => {
                        setScheduledStartTime(e.target.value);
                        setScheduleTouched(true);
                      }}
                      className="w-full h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                    />
                    <input
                      type="time"
                      value={scheduledEndTime}
                      onChange={(e) => {
                        setScheduledEndTime(e.target.value);
                        setScheduleTouched(true);
                      }}
                      min={scheduledStartTime || undefined}
                      className="w-full h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                    />
                  </div>
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Mensagem para o cliente (opcional)"
                  className="w-full h-20 p-3 rounded-xl bg-background border border-border text-sm resize-none outline-none"
                />
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-background/0 pt-8">
          <button
            onClick={sendProposal}
            disabled={
              sending || !price || (pricingType === "range" && !priceMax) || !!existingProposal
            }
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-card disabled:opacity-50"
          >
            <DollarSign className="h-5 w-5" />{" "}
            {existingProposal
              ? "Orçamento já enviado"
              : sending
                ? "Enviando..."
                : "Enviar orçamento"}
          </button>
        </div>
      </PhoneFrame>
    );
  }

  // Modo execução: pedido já contratado, prestador avança o status.
  if (orderId) {
    const status = order?.status;
    const executing = status === "aceito" || status === "a_caminho" || status === "executando";
    const waitingPayment = status === "fotos_enviadas" || status === "aguardando_confirmacao";
    const done = status === "concluido";

    return (
      <PhoneFrame>
        <AppHeader title="Pedido" subtitle={orderId.slice(0, 8)} back="/pro" />
        <div className="flex-1 overflow-y-auto pb-32">
          {executing && (
            <div className="p-5 space-y-4 animate-float-up">
              <div className="rounded-2xl bg-card border border-border p-4">
                <p className="font-semibold">
                  {order?.service_requests?.service_categories?.label}
                </p>
                <p className="text-xs text-muted-foreground mb-2">{order?.profiles?.full_name}</p>
                <p className="text-sm">{order?.service_requests?.description}</p>
                {order?.service_requests?.contact_name && (
                  <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-3">
                    <span className="font-semibold text-foreground">Contato no local: </span>
                    {order.service_requests.contact_name} · {order.service_requests.contact_phone}
                    {order.service_requests.attendee_name
                      ? ` · Recebe: ${order.service_requests.attendee_name}`
                      : ""}
                  </p>
                )}
              </div>
              <div className="rounded-2xl bg-trust-soft/50 border border-trust/20 p-4 space-y-2">
                <p className="text-sm font-semibold">Valor final do serviço</p>
                <p className="text-xs text-muted-foreground">
                  {order?.pricing_type === "range"
                    ? `Faixa aceita: R$ ${Number(order.quoted_price_min).toFixed(2)} a R$ ${Number(order.quoted_price_max).toFixed(2)}.`
                    : `Valor fechado aceito: R$ ${Number(order?.quoted_price_min ?? 0).toFixed(2)}.`}{" "}
                  Informe o total antes de enviar a conclusão.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm">R$</span>
                  <input
                    value={finalPrice}
                    onChange={(e) => setFinalPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Total realizado"
                    inputMode="decimal"
                    className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-card border border-border p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
                  Status: {status}
                </p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Observações para o cliente..."
                  className="w-full h-24 p-3 rounded-xl bg-background border border-border text-sm resize-none outline-none"
                />
              </div>
              <input
                ref={libraryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePickPhoto}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePickPhoto}
              />
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-[11px] font-medium">
                    {uploadingPhoto ? "Enviando..." : "Foto do serviço"}
                  </span>
                </button>
                <button
                  onClick={() => libraryInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  <Images className="h-6 w-6" />
                  <span className="text-[11px] font-medium">Biblioteca</span>
                </button>
                {photos.map((url) => (
                  <div key={url} className="aspect-square rounded-2xl overflow-hidden">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {(waitingPayment || done) && (
            <div className="p-5 space-y-4 animate-float-up">
              <div className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-float text-center">
                <p className="text-xs opacity-80 uppercase tracking-widest">Valor do serviço</p>
                <p className="text-4xl font-extrabold font-[Manrope] mt-1">
                  R$ {order?.price?.toFixed(2)}
                </p>
                <p className="text-xs opacity-80 mt-1">
                  {done
                    ? "Pagamento liberado — veja sua carteira"
                    : "aguardando confirmação do cliente"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-background/0 pt-8 space-y-2">
          {status === "aceito" && (
            <button
              onClick={markOnTheWay}
              disabled={sending}
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-card disabled:opacity-50"
            >
              <MapPin className="h-5 w-5" /> Estou a caminho
            </button>
          )}
          {status === "a_caminho" && (
            <button
              onClick={() => advanceOrder("executando")}
              disabled={sending}
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-card disabled:opacity-50"
            >
              <Play className="h-5 w-5" /> Iniciar serviço
            </button>
          )}
          {status === "executando" && (
            <button
              onClick={() => advanceOrder("fotos_enviadas", note || undefined)}
              disabled={sending || photos.length === 0 || !finalPrice}
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-card disabled:opacity-50"
            >
              <Check className="h-4 w-4" />{" "}
              {photos.length === 0
                ? "Envie uma foto para concluir"
                : !finalPrice
                  ? "Informe o valor final"
                  : "Enviar para confirmação"}
            </button>
          )}
          {(waitingPayment || done) && (
            <button
              onClick={() => nav({ to: "/pro" })}
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-card"
            >
              Voltar ao painel <ArrowRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <AppHeader title="Meus pedidos" back="/pro" />
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <Send className="h-4 w-4 text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Candidaturas enviadas
          </p>
        </div>
        {loadingProposals && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Carregando candidaturas...
          </p>
        )}
        {!loadingProposals && myProposals.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Você ainda não enviou nenhum orçamento.</p>
            <p className="text-xs mt-1">As oportunidades compatíveis aparecem no painel.</p>
          </div>
        )}
        <div className="space-y-3">
          {myProposals.map((proposal) => (
            <Link
              key={proposal.id}
              to="/pro/orders"
              search={{ requestId: proposal.request_id }}
              className="block rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Wrench className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {proposal.service_requests?.service_categories?.label ?? "Serviço"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {proposal.service_requests?.description ?? "Solicitação"}
                  </p>
                  <p className="text-xs font-medium text-primary mt-2">
                    Seu orçamento: R$ {Number(proposal.price).toFixed(2)}
                  </p>
                </div>
                <span
                  className={`text-[10px] text-right font-bold rounded-full px-2 py-1 ${proposal.status === "aceita" ? "bg-emerald-100 text-emerald-700" : proposal.status === "pendente" ? "bg-amber-100 text-amber-700" : "bg-secondary text-muted-foreground"}`}
                >
                  {PROPOSAL_STATUS[proposal.status] ?? proposal.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav variant="pro" />
    </PhoneFrame>
  );
}
