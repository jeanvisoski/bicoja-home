import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, Calendar, CalendarDays, Trash2 } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { MapView } from "@/components/bicoja/MapView";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { useCategories, categoryIcon } from "@/lib/categories";
import { lookupCep, formatCep, geocodeAddressText } from "@/lib/cep";

export const Route = createFileRoute("/request-edit")({
  component: RequestEdit,
  validateSearch: (search: Record<string, unknown>): { requestId?: string } => ({
    requestId: typeof search.requestId === "string" ? search.requestId : undefined,
  }),
  head: () => ({ meta: [{ title: "Editar solicitação — BICOJÁ" }] }),
});

const URGENCY_OPTIONS = [
  { label: "Hoje", value: "hoje", desc: "Preciso agora", icon: Clock },
  { label: "Esta semana", value: "esta_semana", desc: "Nos próximos dias", icon: Calendar },
  { label: "Sem pressa", value: "sem_pressa", desc: "Quando for possível", icon: CalendarDays },
] as const;

type RequestRow = {
  id: string;
  client_id: string;
  category_id: string;
  description: string;
  urgency: "hoje" | "esta_semana" | "sem_pressa";
  status: string;
  availability_start: string | null;
  availability_end: string | null;
  address_id: string | null;
  addresses: {
    id: string;
    street: string;
    number: string | null;
    neighborhood: string | null;
    city: string;
    lat: number | null;
    lng: number | null;
  } | null;
};

function useRequestForEdit(requestId: string | undefined) {
  return useQuery({
    queryKey: ["request-for-edit", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select(
          "id, client_id, category_id, description, urgency, status, availability_start, availability_end, address_id, addresses(id, street, number, neighborhood, city, lat, lng)",
        )
        .eq("id", requestId)
        .single<RequestRow>();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });
}

function RequestEdit() {
  const nav = useNavigate();
  const { requestId } = Route.useSearch();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data: request, isLoading } = useRequestForEdit(requestId);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<(typeof URGENCY_OPTIONS)[number]["value"] | null>(null);
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!request || loaded) return;
    setCategoryId(request.category_id);
    setDesc(request.description);
    setUrgency(request.urgency);
    setAvailabilityStart(request.availability_start ?? "");
    setAvailabilityEnd(request.availability_end ?? "");
    if (request.addresses) {
      setStreet(request.addresses.street);
      setHouseNumber(request.addresses.number ?? "");
      setNeighborhood(request.addresses.neighborhood ?? "");
      setCity(request.addresses.city);
      setLat(request.addresses.lat);
      setLng(request.addresses.lng);
    }
    setLoaded(true);
  }, [request, loaded]);

  async function handleCepLookup() {
    setCepLoading(true);
    setCepError(null);
    try {
      const found = await lookupCep(cep);
      setStreet(found.street);
      setNeighborhood(found.neighborhood);
      setCity(found.city);
      const geo = await geocodeAddressText(
        `${found.street}, ${found.city}, ${found.state}, Brasil`,
      );
      if (geo) {
        setLat(geo.lat);
        setLng(geo.lng);
      }
    } catch (err) {
      setCepError(err instanceof Error ? err.message : "Não foi possível consultar o CEP.");
    }
    setCepLoading(false);
  }

  const editable = request?.status === "aberto" || request?.status === "em_negociacao";

  async function save() {
    if (!request || !categoryId || !urgency) return;
    setSaving(true);

    if (request.address_id) {
      const { error: addrError } = await supabase
        .from("addresses")
        .update({
          street: street.trim(),
          number: houseNumber.trim() || null,
          neighborhood: neighborhood.trim() || null,
          city: city.trim(),
          lat,
          lng,
        })
        .eq("id", request.address_id);
      if (addrError) {
        setSaving(false);
        toast.error(`Falha ao atualizar endereço: ${addrError.message}`);
        return;
      }
    }

    const { error } = await supabase
      .from("service_requests")
      .update({
        category_id: categoryId,
        description: desc,
        urgency,
        availability_start: availabilityStart || null,
        availability_end: availabilityEnd || null,
      })
      .eq("id", request.id);

    setSaving(false);
    if (error) {
      toast.error(`Falha ao salvar: ${error.message}`);
      return;
    }
    toast.success("Solicitação atualizada.");
    await queryClient.invalidateQueries({ queryKey: ["my-pending-requests"] });
    nav({ to: "/orders" });
  }

  async function cancelRequest() {
    if (!request) return;
    if (!window.confirm("Tem certeza que deseja cancelar esta solicitação?")) return;
    setCancelling(true);
    const { error } = await supabase
      .from("service_requests")
      .update({ status: "cancelado" })
      .eq("id", request.id);
    setCancelling(false);
    if (error) {
      toast.error(`Falha ao cancelar: ${error.message}`);
      return;
    }
    toast.success("Solicitação cancelada.");
    await queryClient.invalidateQueries({ queryKey: ["my-pending-requests"] });
    nav({ to: "/orders" });
  }

  if (!session || isLoading) {
    return (
      <PhoneFrame>
        <AppHeader title="Editar solicitação" back="/orders" />
        <div className="flex-1" />
      </PhoneFrame>
    );
  }

  if (!request || request.client_id !== session.user.id) {
    return (
      <PhoneFrame>
        <AppHeader title="Editar solicitação" back="/orders" />
        <div className="flex-1 flex items-center justify-center px-8 text-center text-sm text-muted-foreground">
          Solicitação não encontrada.
        </div>
      </PhoneFrame>
    );
  }

  if (!editable) {
    return (
      <PhoneFrame>
        <AppHeader title="Editar solicitação" back="/orders" />
        <div className="flex-1 flex items-center justify-center px-8 text-center text-sm text-muted-foreground">
          Esta solicitação já foi contratada e não pode mais ser editada ou cancelada por aqui.
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <AppHeader title="Editar solicitação" back="/orders" />
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 pb-32">
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Categoria
          </p>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => {
              const Icon = categoryIcon(c.icon);
              const active = categoryId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`p-3 rounded-2xl border text-left transition-all ${active ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card"}`}
                >
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center mb-2 ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="font-semibold text-xs">{c.label}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Descrição
          </p>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full h-32 p-4 rounded-2xl bg-card border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </section>

        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Endereço
          </p>
          <MapView
            lat={lat}
            lng={lng}
            draggable
            onChange={(la, ln) => {
              setLat(la);
              setLng(ln);
            }}
            height={180}
          />
          <div className="mt-3 p-3 rounded-2xl bg-card border border-border space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Buscar pelo CEP</p>
            <div className="flex gap-2">
              <input
                value={cep}
                onChange={(e) => setCep(formatCep(e.target.value))}
                placeholder="00000-000"
                inputMode="numeric"
                className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
              />
              <button
                onClick={handleCepLookup}
                disabled={cepLoading || cep.replace(/\D/g, "").length !== 8}
                className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40"
              >
                {cepLoading ? "Buscando..." : "Buscar"}
              </button>
            </div>
            {cepError && <p className="text-xs text-destructive">{cepError}</p>}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Rua"
              className="flex-1 h-11 px-3 rounded-xl bg-card border border-border text-sm outline-none"
            />
            <input
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              placeholder="Número"
              className="w-24 h-11 px-3 rounded-xl bg-card border border-border text-sm outline-none"
            />
          </div>
          <input
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            placeholder="Bairro"
            className="w-full mt-2 h-11 px-3 rounded-xl bg-card border border-border text-sm outline-none"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Cidade"
            className="w-full mt-2 h-11 px-3 rounded-xl bg-card border border-border text-sm outline-none"
          />
        </section>

        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Urgência
          </p>
          <div className="space-y-2">
            {URGENCY_OPTIONS.map((u) => {
              const active = urgency === u.value;
              return (
                <button
                  key={u.value}
                  onClick={() => setUrgency(u.value)}
                  className={`w-full p-3 rounded-2xl border flex items-center gap-3 text-left transition-all ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                >
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}
                  >
                    <u.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{u.label}</p>
                    <p className="text-xs text-muted-foreground">{u.desc}</p>
                  </div>
                  {active && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 p-4 rounded-2xl bg-card border border-border space-y-3">
            <div><p className="font-semibold text-sm">Período em que estará em casa</p><p className="text-xs text-muted-foreground">O prestador verá esta janela de atendimento.</p></div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">De<input type="date" value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} className="w-full mt-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none" /></label>
              <label className="text-xs text-muted-foreground">Até<input type="date" value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} min={availabilityStart} className="w-full mt-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none" /></label>
            </div>
          </div>
        </section>

        <button
          onClick={cancelRequest}
          disabled={cancelling}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 text-destructive font-semibold text-sm disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {cancelling ? "Cancelando..." : "Cancelar solicitação"}
        </button>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-background/0 pt-8">
        <button
          onClick={save}
          disabled={saving || !categoryId || !urgency || !street.trim() || !city.trim()}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 shadow-card active:scale-[0.99] transition-transform disabled:opacity-40 disabled:pointer-events-none"
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </PhoneFrame>
  );
}
