import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  ImagePlus,
  Loader2,
  MapPin,
  Clock,
  Calendar,
  CalendarDays,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  LocateFixed,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { TrustBadge } from "@/components/bicoja/TrustBadge";
import { MapView } from "@/components/bicoja/MapView";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { useCategories, categoryIcon } from "@/lib/categories";
import { uploadPhoto } from "@/lib/storage";
import { locateCurrentAddress } from "@/lib/geocode";
import { lookupCep, formatCep, geocodeAddressText } from "@/lib/cep";
import { ensureProfile } from "@/lib/profile";
import { isInsideActiveServiceArea, useLaunchRegionSettings } from "@/lib/launch-regions";

export const Route = createFileRoute("/request")({
  component: RequestFlow,
  validateSearch: (
    search: Record<string, unknown>,
  ): { category?: string; providerId?: string } => ({
    category: typeof search.category === "string" ? search.category : undefined,
    providerId: typeof search.providerId === "string" ? search.providerId : undefined,
  }),
  head: () => ({ meta: [{ title: "Solicitar serviço — BICOJÁ" }] }),
});

function usePreferredProvider(providerId: string | undefined) {
  return useQuery({
    queryKey: ["preferred-provider", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_profiles")
        .select("headline, profiles(full_name)")
        .eq("profile_id", providerId)
        .maybeSingle<{ headline: string | null; profiles: { full_name: string | null } | null }>();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

type SavedAddress = {
  id: string;
  cep: string | null;
  street: string;
  number: string | null;
  neighborhood: string | null;
  city: string;
  state: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  label: string | null;
};

function useRequestDefaults(userId: string | undefined) {
  return useQuery({
    queryKey: ["request-defaults", userId],
    queryFn: async () => {
      const [addressListResult, profileResult] = await Promise.all([
        supabase
          .from("addresses")
          .select("id, cep, street, number, neighborhood, city, state, lat, lng, is_default, label")
          .eq("profile_id", userId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .returns<SavedAddress[]>(),
        supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
      ]);
      if (addressListResult.error) throw addressListResult.error;
      if (profileResult.error) throw profileResult.error;
      const list = addressListResult.data ?? [];
      return { address: list[0] ?? null, addressList: list, profile: profileResult.data };
    },
    enabled: !!userId,
  });
}

const ADDRESS_LABEL_TEXT: Record<string, string> = {
  casa: "Casa",
  trabalho: "Trabalho",
  outro: "Outro",
};

const STEPS = ["Categoria", "Detalhes", "Endereço", "Disponibilidade", "Confirmar"];

const URGENCY_OPTIONS = [
  { label: "Hoje", value: "hoje", desc: "Preciso agora", icon: Clock },
  { label: "Esta semana", value: "esta_semana", desc: "Nos próximos dias", icon: Calendar },
  { label: "Sem pressa", value: "sem_pressa", desc: "Quando for possível", icon: CalendarDays },
] as const;

const DRAFT_KEY = "bicoja_request_draft";

type RequestDraft = {
  step: number;
  categorySlug: string | undefined;
  categoryId: string | null;
  desc: string;
  photos: string[];
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  cep: string;
  urgency: string | null;
  availabilityStart: string;
  availabilityEnd: string;
  availabilityStartTime: string;
  availabilityEndTime: string;
  contactName: string;
  contactPhone: string;
  attendeeName: string;
};

function loadDraft(currentCategorySlug: string | undefined): RequestDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RequestDraft;
    // Um link novo com categoria diferente (ou nova) da do rascunho salvo é
    // uma nova intenção do cliente, não uma continuação -- descarta o
    // rascunho velho pra não pular o "pular categoria" e voltar a perguntar
    // de novo (era exatamente essa a reclamação de repetição).
    if (currentCategorySlug && parsed.categorySlug !== currentCategorySlug) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearDraft() {
  window.sessionStorage.removeItem(DRAFT_KEY);
}

function RequestFlow() {
  const nav = useNavigate();
  const { category: preselectedSlug, providerId } = Route.useSearch();
  const { session } = useSession();
  const { data: categories = [] } = useCategories();
  const { data: preferredProvider } = usePreferredProvider(providerId);
  const { data: defaults } = useRequestDefaults(session?.user.id);
  const { data: launchRegions } = useLaunchRegionSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const locateAttemptRef = useRef(0);
  const draft = useRef(loadDraft(preselectedSlug)).current;

  // Recarregar a página no meio do fluxo não deve voltar pra categoria --
  // restaura o rascunho salvo (sessionStorage) se existir um.
  const [step, setStep] = useState(draft?.step ?? 0);
  const [categoryId, setCategoryId] = useState<string | null>(draft?.categoryId ?? null);
  const [desc, setDesc] = useState(draft?.desc ?? "");
  const [photos, setPhotos] = useState<string[]>(draft?.photos ?? []);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [street, setStreet] = useState(draft?.street ?? "");
  const [houseNumber, setHouseNumber] = useState(draft?.houseNumber ?? "");
  const [neighborhood, setNeighborhood] = useState(draft?.neighborhood ?? "");
  const [city, setCity] = useState(draft?.city ?? "");
  const [state, setState] = useState(draft?.state ?? "");
  const [lat, setLat] = useState<number | null>(draft?.lat ?? null);
  const [lng, setLng] = useState<number | null>(draft?.lng ?? null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [usingOtherAddress, setUsingOtherAddress] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [cep, setCep] = useState(draft?.cep ?? "");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<(typeof URGENCY_OPTIONS)[number]["value"] | null>(
    (draft?.urgency as (typeof URGENCY_OPTIONS)[number]["value"] | null) ?? null,
  );
  const [availabilityStart, setAvailabilityStart] = useState(draft?.availabilityStart ?? "");
  const [availabilityEnd, setAvailabilityEnd] = useState(draft?.availabilityEnd ?? "");
  const [availabilityStartTime, setAvailabilityStartTime] = useState(
    draft?.availabilityStartTime ?? "",
  );
  const [availabilityEndTime, setAvailabilityEndTime] = useState(draft?.availabilityEndTime ?? "");
  const [contactName, setContactName] = useState(draft?.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(draft?.contactPhone ?? "");
  const [attendeeName, setAttendeeName] = useState(draft?.attendeeName ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const nextDraft: RequestDraft = {
      step,
      categorySlug: preselectedSlug,
      categoryId,
      desc,
      photos,
      street,
      houseNumber,
      neighborhood,
      city,
      state,
      lat,
      lng,
      cep,
      urgency,
      availabilityStart,
      availabilityEnd,
      availabilityStartTime,
      availabilityEndTime,
      contactName,
      contactPhone,
      attendeeName,
    };
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
  }, [
    step,
    preselectedSlug,
    categoryId,
    desc,
    photos,
    street,
    houseNumber,
    neighborhood,
    city,
    state,
    lat,
    lng,
    cep,
    urgency,
    availabilityStart,
    availabilityEnd,
    availabilityStartTime,
    availabilityEndTime,
    contactName,
    contactPhone,
    attendeeName,
  ]);

  useEffect(() => {
    if (categoryId || categories.length === 0) return;
    const preselected = preselectedSlug
      ? categories.find((c) => c.slug === preselectedSlug)
      : undefined;
    setCategoryId((preselected ?? categories[0]).id);
  }, [categories, preselectedSlug, categoryId]);

  // Quando o cliente já chegou aqui com uma categoria definida (veio da home,
  // da busca ou do perfil de um prestador), ela já está decidida -- pular a
  // etapa de seleção em vez de fazer escolher de novo é o motivo #1 de
  // reclamação de fricção nesse fluxo. Um rascunho retomado da mesma
  // categoria já nasce "pulado" também, senão o botão voltar reexibiria uma
  // etapa que o cliente nunca viu nesta sessão.
  const [categoryStepSkipped, setCategoryStepSkipped] = useState(
    () => !!(draft && preselectedSlug),
  );
  useEffect(() => {
    if (draft || categoryStepSkipped || step !== 0) return;
    if (!preselectedSlug || categories.length === 0) return;
    if (categories.some((c) => c.slug === preselectedSlug)) {
      setCategoryStepSkipped(true);
      setStep(1);
    }
  }, [draft, categoryStepSkipped, step, preselectedSlug, categories]);

  useEffect(() => {
    if (!defaults || usingOtherAddress || street) return;
    const address = defaults.address;
    if (address) {
      setStreet(address.street);
      setHouseNumber(address.number ?? "");
      setNeighborhood(address.neighborhood ?? "");
      setCity(address.city);
      setState(address.state ?? "");
      setCep(formatCep(address.cep ?? ""));
      setLat(address.lat);
      setLng(address.lng);
    }
    setContactName(defaults.profile?.full_name ?? "");
    setContactPhone(defaults.profile?.phone ?? "");
  }, [defaults, usingOtherAddress, street]);

  function selectSavedAddress(address: SavedAddress) {
    setStreet(address.street);
    setHouseNumber(address.number ?? "");
    setNeighborhood(address.neighborhood ?? "");
    setCity(address.city);
    setState(address.state ?? "");
    setCep(formatCep(address.cep ?? ""));
    setLat(address.lat);
    setLng(address.lng);
    setUsingOtherAddress(false);
    setShowAddressPicker(false);
  }

  async function locateMe() {
    const attempt = ++locateAttemptRef.current;
    setLocating(true);
    setLocateError(null);
    try {
      const found = await locateCurrentAddress();
      if (attempt !== locateAttemptRef.current) return;
      setStreet(found.street);
      setNeighborhood(found.neighborhood);
      setCity(found.city);
      setState(found.state);
      setLat(found.lat);
      setLng(found.lng);
      setEditingAddress(true);
    } catch (err) {
      if (attempt !== locateAttemptRef.current) return;
      setLocateError(
        err instanceof Error ? err.message : "Não foi possível obter sua localização.",
      );
    }
    if (attempt === locateAttemptRef.current) setLocating(false);
  }

  function enterAddressManually() {
    locateAttemptRef.current += 1;
    setLocating(false);
    setLocateError(null);
    setEditingAddress(true);
  }

  useEffect(() => {
    if (step === 2 && !defaults?.address && !street && !locating && !locateError) {
      locateMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, defaults?.address]);

  async function handleCepLookup() {
    setCepLoading(true);
    setCepError(null);
    try {
      const found = await lookupCep(cep);
      setStreet(found.street);
      setNeighborhood(found.neighborhood);
      setCity(found.city);
      setState(found.state);
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

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const areaAvailable = isInsideActiveServiceArea(launchRegions, city, state);

  const canNext =
    (step === 0 && categoryId) ||
    (step === 1 && desc.length > 5) ||
    (step === 2 &&
      cep.replace(/\D/g, "").length === 8 &&
      street.trim() &&
      houseNumber.trim() &&
      neighborhood.trim() &&
      city.trim() &&
      state.trim() &&
      areaAvailable &&
      lat != null &&
      lng != null) ||
    (step === 3 &&
      urgency &&
      availabilityStartTime &&
      availabilityEndTime &&
      availabilityEndTime > availabilityStartTime &&
      (urgency === "hoje" ||
        (availabilityStart && availabilityEnd && availabilityEnd >= availabilityStart))) ||
    (step === 4 && contactName.trim() && contactPhone.trim());

  async function handlePickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !session) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadPhoto(session.user.id, "requests", file);
      setPhotos((p) => [...p, url].slice(0, 10));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar foto.");
    }
    setUploadingPhoto(false);
  }

  async function submit() {
    if (!session) {
      toast.error("Entre na sua conta para solicitar um serviço.");
      nav({ to: "/login" });
      return;
    }
    if (!categoryId || !urgency) return;

    if (!isInsideActiveServiceArea(launchRegions, city, state)) {
      const label = [city, state].filter(Boolean).join("/") || "essa região";
      const message = `A BICOJÁ ainda não está atendendo ${label}. Estamos expandindo em breve.`;
      setSubmitError(message);
      toast.error(message);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    await ensureProfile(session);

    let addressId = !usingOtherAddress ? (defaults?.address?.id ?? null) : null;
    if (!addressId) {
      const { data: address, error: addressError } = await supabase
        .from("addresses")
        .insert({
          profile_id: session.user.id,
          street: street.trim(),
          number: houseNumber.trim(),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: state.trim(),
          cep: cep.replace(/\D/g, ""),
          lat,
          lng,
          is_default: !defaults?.address,
        })
        .select("id")
        .single();
      if (addressError) {
        setSubmitting(false);
        setSubmitError(`Falha ao salvar endereço: ${addressError.message}`);
        toast.error(addressError.message);
        return;
      }
      addressId = address.id;
    }

    const { data: request, error } = await supabase
      .from("service_requests")
      .insert({
        client_id: session.user.id,
        category_id: categoryId,
        description: desc,
        urgency,
        address_id: addressId,
        scheduled_at: null,
        availability_start:
          urgency === "hoje" ? new Date().toISOString().slice(0, 10) : availabilityStart,
        availability_end:
          urgency === "hoje" ? new Date().toISOString().slice(0, 10) : availabilityEnd,
        availability_start_time: availabilityStartTime,
        availability_end_time: availabilityEndTime,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        attendee_name: attendeeName.trim() || null,
        preferred_provider_id: providerId || null,
      })
      .select("id")
      .single();

    if (error) {
      setSubmitting(false);
      setSubmitError(`Falha ao criar solicitação: ${error.message}`);
      toast.error(error.message);
      return;
    }

    if (photos.length > 0) {
      await supabase
        .from("request_photos")
        .insert(photos.map((photo_url) => ({ request_id: request.id, photo_url })));
    }

    setSubmitting(false);
    clearDraft();
    nav({ to: "/proposals", search: { requestId: request.id } });
  }

  const next = () => {
    if (step === STEPS.length - 1) submit();
    else setStep(step + 1);
  };
  const back = () => {
    if (step === 0) {
      nav({ to: "/home" });
    } else if (step === 1 && categoryStepSkipped && providerId) {
      nav({ to: "/providers/$providerId", params: { providerId } });
    } else if (step === 1 && categoryStepSkipped && preselectedSlug) {
      nav({ to: "/search", search: { category: preselectedSlug } });
    } else {
      setStep(step - 1);
    }
  };

  return (
    <PhoneFrame>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 h-14">
          <button onClick={back} className="-ml-2 p-2 rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground">
              Passo {step + 1} de {STEPS.length}
            </p>
            <p className="text-sm font-semibold">{STEPS[step]}</p>
          </div>
          <div className="w-8" />
        </div>
        <div className="h-1 bg-muted mx-4 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-32">
        {providerId && (
          <div className="mb-5 rounded-2xl bg-primary/5 border border-primary/20 p-3 text-xs font-semibold text-primary">
            Solicitando direto com{" "}
            {preferredProvider?.profiles?.full_name ??
              preferredProvider?.headline ??
              "este prestador"}
            . Só ele verá e responderá este pedido.
          </div>
        )}
        {step === 0 && (
          <div className="animate-float-up">
            <h2 className="text-2xl font-extrabold font-[Manrope] leading-tight mb-1">
              Qual serviço você precisa?
            </h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Escolha uma categoria para começar.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((c) => {
                const Icon = categoryIcon(c.icon);
                const active = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={`p-4 rounded-2xl border text-left transition-all ${active ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card"}`}
                  >
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center mb-3 ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-semibold text-sm">{c.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-float-up">
            <h2 className="text-2xl font-extrabold font-[Manrope] leading-tight mb-1">
              Descreva o problema
            </h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Quanto mais detalhes, melhores as propostas. Fotos são opcionais, mas ajudam bastante.
            </p>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Ex.: Vazamento embaixo da pia da cozinha, água pingando desde ontem."
              className="w-full h-40 p-4 rounded-2xl bg-card border border-border text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground mt-2 text-right">
              {desc.length} caracteres
            </p>
            <p className="text-xs font-semibold text-muted-foreground mt-5 mb-2">
              Fotos (opcional)
            </p>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePickPhoto}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickPhoto}
            />
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploadingPhoto || photos.length >= 10}
                className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                <Camera className="h-6 w-6" />
                <span className="text-[11px] font-medium">Câmera</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto || photos.length >= 10}
                className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-[11px] font-medium">Galeria</span>
              </button>
              {uploadingPhoto && (
                <div className="aspect-square rounded-2xl border border-border bg-secondary/40 flex flex-col items-center justify-center gap-1">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-[11px] font-medium text-muted-foreground">Enviando...</span>
                </div>
              )}
              {photos.map((url, i) => (
                <div key={url} className="relative aspect-square rounded-2xl overflow-hidden">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 flex items-center justify-center"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">{photos.length}/10 fotos</p>
          </div>
        )}

        {step === 2 && (
          <div className="animate-float-up">
            <h2 className="text-2xl font-extrabold font-[Manrope] leading-tight mb-1">
              Onde é o serviço?
            </h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Só o profissional escolhido verá o endereço completo.
            </p>
            {defaults?.address && !usingOtherAddress && (
              <div className="mb-3 rounded-2xl bg-trust-soft/50 border border-trust/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs">
                    <span className="font-semibold">
                      {defaults.address.label
                        ? (ADDRESS_LABEL_TEXT[defaults.address.label] ??
                          "Usando seu endereço salvo")
                        : "Usando seu endereço salvo"}
                      .
                    </span>
                    <br />
                    {street}, {houseNumber} · {city}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setUsingOtherAddress(true);
                      setEditingAddress(true);
                      setStreet("");
                      setHouseNumber("");
                      setNeighborhood("");
                      setCity("");
                      setState("");
                      setCep("");
                    }}
                    className="shrink-0 text-xs font-semibold text-primary"
                  >
                    Digitar novo
                  </button>
                </div>
                {defaults.addressList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowAddressPicker((v) => !v)}
                    className="text-xs font-semibold text-primary"
                  >
                    {showAddressPicker ? "Fechar" : "Escolher outro endereço salvo"}
                  </button>
                )}
                {showAddressPicker && (
                  <div className="space-y-1.5 pt-1">
                    {defaults.addressList.map((address) => (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => selectSavedAddress(address)}
                        className={`w-full text-left p-2.5 rounded-xl text-xs border ${street === address.street && city === address.city ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                      >
                        <span className="font-semibold">
                          {address.label
                            ? (ADDRESS_LABEL_TEXT[address.label] ?? "Endereço")
                            : "Endereço"}
                        </span>
                        {" — "}
                        {address.street}, {address.number} · {address.city}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <MapView
              lat={lat}
              lng={lng}
              draggable
              onChange={(la, ln) => {
                setLat(la);
                setLng(ln);
              }}
              height={208}
            />
            {launchRegions?.launch_regions_enabled && city && state && !areaAvailable && (
              <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                A BICOJÁ ainda não atende{" "}
                <strong>
                  {city}/{state}
                </strong>{" "}
                nesta fase de lançamento. Cadastre-se para acompanhar a expansão ou use um endereço
                em uma cidade atendida.
              </div>
            )}
            {locating && (
              <div className="mt-3 p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <LocateFixed className="h-5 w-5 text-primary animate-pulse" />
                  <p className="text-sm text-muted-foreground">Localizando você...</p>
                </div>
                <button
                  type="button"
                  onClick={enterAddressManually}
                  className="shrink-0 text-primary text-xs font-semibold"
                >
                  Digitar endereço
                </button>
              </div>
            )}

            {!locating && locateError && !editingAddress && (
              <div className="mt-3 p-4 rounded-2xl bg-card border border-border space-y-2">
                <p className="text-sm text-muted-foreground">{locateError}</p>
                <div className="flex gap-3">
                  <button onClick={locateMe} className="text-primary text-xs font-semibold">
                    Tentar novamente
                  </button>
                  <button
                    onClick={enterAddressManually}
                    className="text-primary text-xs font-semibold"
                  >
                    Digitar endereço
                  </button>
                </div>
              </div>
            )}

            {!locating && editingAddress ? (
              <div className="mt-3 space-y-3">
                <div className="p-3 rounded-2xl bg-card border border-border space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Buscar pelo CEP (preenche o endereço automaticamente)
                  </p>
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
                <div className="flex gap-2">
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
                  className="w-full h-11 px-3 rounded-xl bg-card border border-border text-sm outline-none"
                />
                <div className="flex gap-2">
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Cidade"
                    className="flex-1 h-11 px-3 rounded-xl bg-card border border-border text-sm outline-none"
                  />
                  <input
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="UF"
                    className="w-20 h-11 px-3 rounded-xl bg-card border border-border text-sm outline-none"
                  />
                </div>
                {street.trim() && city.trim() && lat == null && lng == null && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
                    <p className="text-xs text-destructive">
                      Não conseguimos confirmar a localização exata deste endereço. Sem isso, o
                      pedido não aparece para os prestadores.
                    </p>
                    <button
                      type="button"
                      onClick={locateMe}
                      className="mt-2 text-xs font-semibold text-primary"
                    >
                      Usar minha localização (GPS)
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setEditingAddress(false)}
                  className="text-primary text-xs font-semibold"
                >
                  Salvar
                </button>
              </div>
            ) : (
              !locating &&
              !locateError && (
                <div className="mt-3 p-4 rounded-2xl bg-card border border-border">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {street
                          ? `${street}${houseNumber ? `, ${houseNumber}` : ""}`
                          : "Endereço não definido"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {neighborhood ? `${neighborhood} • ` : ""}
                        {city}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditingAddress(true)}
                      className="text-primary text-xs font-semibold"
                    >
                      Alterar
                    </button>
                  </div>
                </div>
              )
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              Endereço obtido pela sua localização ou pelo CEP — arraste o pino no mapa para ajustar
              o ponto exato.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="animate-float-up">
            <h2 className="text-2xl font-extrabold font-[Manrope] leading-tight mb-1">
              Qual a urgência?
            </h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Isso ajuda a filtrar quem pode atender.
            </p>
            <div className="space-y-3">
              {URGENCY_OPTIONS.map((u) => {
                const active = urgency === u.value;
                return (
                  <button
                    key={u.value}
                    onClick={() => setUrgency(u.value)}
                    className={`w-full p-4 rounded-2xl border flex items-center gap-4 text-left transition-all ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                  >
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}
                    >
                      <u.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{u.label}</p>
                      <p className="text-xs text-muted-foreground">{u.desc}</p>
                    </div>
                    {active && (
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-card border border-border space-y-3">
              <div>
                <p className="font-semibold text-sm">
                  {urgency === "hoje"
                    ? "Em qual horário você estará em casa?"
                    : "Quando você estará em casa?"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {urgency === "hoje"
                    ? "Escolha a faixa de horário disponível hoje."
                    : "Escolha as datas e a faixa de horário em que o prestador pode atender."}
                </p>
              </div>
              {urgency !== "hoje" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-muted-foreground">
                    De
                    <input
                      type="date"
                      value={availabilityStart}
                      onChange={(e) => setAvailabilityStart(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      className="w-full mt-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Até
                    <input
                      type="date"
                      value={availabilityEnd}
                      onChange={(e) => setAvailabilityEnd(e.target.value)}
                      min={availabilityStart || new Date().toISOString().slice(0, 10)}
                      className="w-full mt-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                    />
                  </label>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Das
                  <input
                    type="time"
                    value={availabilityStartTime}
                    onChange={(e) => setAvailabilityStartTime(e.target.value)}
                    className="w-full mt-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Até
                  <input
                    type="time"
                    value={availabilityEndTime}
                    onChange={(e) => setAvailabilityEndTime(e.target.value)}
                    min={availabilityStartTime || undefined}
                    className="w-full mt-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-float-up">
            <h2 className="text-2xl font-extrabold font-[Manrope] leading-tight mb-1">
              Confirmar solicitação
            </h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Revise e envie para receber orçamentos.
            </p>
            <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
              <Row label="Serviço" value={selectedCategory?.label ?? "-"} />
              <Row label="Descrição" value={desc || "-"} multi />
              <Row label="Fotos" value={`${photos.length} anexadas`} />
              <Row
                label="Endereço"
                value={`${street}${houseNumber ? ", " + houseNumber : ""} — ${neighborhood ? neighborhood + ", " : ""}${city}`}
              />
              {preferredProvider && (
                <Row
                  label="Prestador"
                  value={`Direto com ${preferredProvider.profiles?.full_name ?? preferredProvider.headline ?? "prestador"}`}
                />
              )}
              <Row
                label="Urgência"
                value={URGENCY_OPTIONS.find((u) => u.value === urgency)?.label ?? "-"}
              />
              <Row
                label="Disponibilidade"
                value={
                  urgency === "hoje"
                    ? `Hoje, das ${availabilityStartTime} até ${availabilityEndTime}`
                    : `${availabilityStart.split("-").reverse().join("/")} até ${availabilityEnd.split("-").reverse().join("/")} · ${availabilityStartTime}–${availabilityEndTime}`
                }
              />
            </div>

            <p className="text-xs font-semibold text-muted-foreground mt-5 mb-2">
              Contato no local
            </p>
            <div className="space-y-3 rounded-2xl bg-card border border-border p-4">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nome do contato"
                className="w-full h-12 px-3 rounded-xl bg-background border border-border text-sm outline-none"
              />
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Telefone / WhatsApp"
                inputMode="tel"
                className="w-full h-12 px-3 rounded-xl bg-background border border-border text-sm outline-none"
              />
              <input
                value={attendeeName}
                onChange={(e) => setAttendeeName(e.target.value)}
                placeholder="Quem receberá o prestador? (opcional)"
                className="w-full h-12 px-3 rounded-xl bg-background border border-border text-sm outline-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Se outra pessoa estiver no local, informe o nome dela acima.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <TrustBadge kind="payment" />
              <TrustBadge kind="verified" />
              <TrustBadge kind="mediation" />
            </div>
            {submitError && (
              <div className="mt-4 p-4 rounded-2xl bg-destructive/10 border border-destructive/30">
                <p className="text-sm text-destructive font-medium">{submitError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-background/0 pt-8">
        <button
          onClick={next}
          disabled={!canNext || submitting}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 shadow-card active:scale-[0.99] transition-transform disabled:opacity-40 disabled:pointer-events-none"
        >
          {step === STEPS.length - 1
            ? submitting
              ? "Enviando..."
              : "Solicitar orçamento"
            : "Continuar"}
          {step === STEPS.length - 1 ? (
            <Check className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>
      </div>
    </PhoneFrame>
  );
}

function Row({ label, value, multi }: { label: string; value: string; multi?: boolean }) {
  return (
    <div className="p-4 flex items-start gap-4">
      <span className="text-xs font-medium text-muted-foreground w-20 pt-0.5">{label}</span>
      <span className={`flex-1 text-sm font-medium ${multi ? "" : "truncate"}`}>{value}</span>
    </div>
  );
}
