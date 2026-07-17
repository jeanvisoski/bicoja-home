import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { BadgeCheck, Star, LogOut, LocateFixed, X, Plus, Camera, MapPin, Pencil, FileText } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { TrustBadge } from "@/components/bicoja/TrustBadge";
import { MapView } from "@/components/bicoja/MapView";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { useCategories, categoryIcon } from "@/lib/categories";
import { getCurrentPosition } from "@/lib/geocode";
import { uploadPhoto } from "@/lib/storage";
import { formatCep, geocodeAddressText, lookupCep } from "@/lib/cep";

export const Route = createFileRoute("/pro/profile")({
  component: ProProfile,
  head: () => ({ meta: [{ title: "Perfil — BICOJÁ Pro" }] }),
});

type ProviderProfile = {
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  headline: string | null;
  city: string | null;
  specialties: string[];
  rating_avg: number;
  rating_count: number;
  jobs_count: number;
  verification_status: string;
  member_since: string;
  lat: number | null;
  lng: number | null;
  service_radius_km: number;
  cep: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  state: string | null;
};

function useProviderProfile(profileId: string | undefined) {
  return useQuery({
    queryKey: ["pro-profile", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_profiles")
        .select(
          "headline, city, specialties, rating_avg, rating_count, jobs_count, verification_status, member_since, lat, lng, service_radius_km, cep, street, number, neighborhood, state, profiles(full_name, avatar_url)",
        )
        .eq("profile_id", profileId)
        .maybeSingle<ProviderProfile>();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });
}

type ProviderService = {
  id: string;
  category_id: string;
  price_from: number | null;
  service_categories: { label: string; icon: string } | null;
};

function useProviderServices(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-services", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_services")
        .select("id, category_id, price_from, service_categories(label, icon)")
        .eq("provider_id", providerId)
        .returns<ProviderService[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

type Review = {
  id: string;
  stars: number;
  comment: string | null;
  profiles: { full_name: string | null } | null;
};

function useReviews(providerId: string | undefined) {
  return useQuery({
    queryKey: ["pro-reviews", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ratings")
        .select("id, stars, comment, profiles(full_name)")
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false })
        .limit(5)
        .returns<Review[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

type VerificationDocument = { id: string; document_type: string; status: string; created_at: string };

function useVerificationDocuments(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-verification-documents", providerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_verification_documents").select("id, document_type, status, created_at").eq("provider_id", providerId).order("created_at", { ascending: false }).returns<VerificationDocument[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

function ProProfile() {
  const { session } = useSession();
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const { data: provider } = useProviderProfile(userId);
  const { data: reviews = [] } = useReviews(userId);
  const { data: services = [] } = useProviderServices(userId);
  const { data: verificationDocuments = [] } = useVerificationDocuments(userId);
  const { data: categories = [] } = useCategories();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const [radiusKm, setRadiusKm] = useState(30);
  const [locating, setLocating] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [addCategoryId, setAddCategoryId] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [savingService, setSavingService] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [sendingDocument, setSendingDocument] = useState(false);

  useEffect(() => {
    if (provider) {
      setRadiusKm(provider.service_radius_km ?? 30);
      setCep(provider.cep ?? "");
      setStreet(provider.street ?? "");
      setHouseNumber(provider.number ?? "");
      setNeighborhood(provider.neighborhood ?? "");
      setCity(provider.city ?? "");
      setState(provider.state ?? "");
    }
  }, [provider]);

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/login" });
  }

  async function useMyLocation() {
    if (!userId) return;
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      const { error } = await supabase
        .from("provider_profiles")
        .update({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        .eq("profile_id", userId);
      if (error) throw error;
      toast.success("Localização atualizada.");
      await queryClient.invalidateQueries({ queryKey: ["pro-profile", userId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível obter sua localização.");
    }
    setLocating(false);
  }

  async function saveRadius() {
    if (!userId) return;
    setSavingLocation(true);
    const { data: savedProvider, error } = await supabase
      .from("provider_profiles")
      .update({ service_radius_km: radiusKm })
      .eq("profile_id", userId)
      .select("service_radius_km")
      .single();
    setSavingLocation(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRadiusKm(Number(savedProvider.service_radius_km));
    toast.success(`Raio de atendimento salvo: ${savedProvider.service_radius_km} km.`);
    await queryClient.invalidateQueries({ queryKey: ["pro-profile", userId] });
    await queryClient.invalidateQueries({ queryKey: ["provider-profile", userId] });
  }

  async function changeProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userId) return;
    setSavingPhoto(true);
    try {
      const avatarUrl = await uploadPhoto(userId, "avatars", file);
      const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
      if (error) throw error;
      toast.success("Foto de perfil atualizada.");
      await queryClient.invalidateQueries({ queryKey: ["pro-profile", userId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a foto.");
    }
    setSavingPhoto(false);
  }

  async function uploadVerificationDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userId) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("O documento deve ter no maximo 8 MB.");
    setSendingDocument(true);
    try {
      const extension = file.name.split(".").pop() || "bin";
      const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("provider-documents").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("provider_verification_documents").insert({ provider_id: userId, document_type: "identidade", storage_path: path });
      if (error) throw error;
      toast.success("Documento enviado para analise.");
      await queryClient.invalidateQueries({ queryKey: ["provider-verification-documents", userId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar o documento.");
    }
    setSendingDocument(false);
  }

  async function findCep() {
    setCepLoading(true);
    try {
      const found = await lookupCep(cep);
      setStreet(found.street);
      setNeighborhood(found.neighborhood);
      setCity(found.city);
      setState(found.state);
      const geo = await geocodeAddressText(`${found.street}, ${found.city}, ${found.state}, Brasil`);
      if (geo && userId) {
        await supabase.from("provider_profiles").update({ lat: geo.lat, lng: geo.lng }).eq("profile_id", userId);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
    }
    setCepLoading(false);
  }

  async function saveAddress() {
    if (!userId || !cep || !street.trim() || !houseNumber.trim() || !neighborhood.trim() || !city.trim() || !state.trim()) {
      toast.error("Preencha o endereço completo.");
      return;
    }
    setSavingAddress(true);
    const { error } = await supabase
      .from("provider_profiles")
      .update({ cep: cep.replace(/\D/g, ""), street: street.trim(), number: houseNumber.trim(), neighborhood: neighborhood.trim(), city: city.trim(), state: state.trim() })
      .eq("profile_id", userId);
    setSavingAddress(false);
    if (error) {
      toast.error(error.message);
      return;
    }
      toast.success("Endereço atualizado.");
      setEditingAddress(false);
      await queryClient.invalidateQueries({ queryKey: ["pro-profile", userId] });
      await queryClient.invalidateQueries({ queryKey: ["provider-profile", userId] });
  }

  async function addService() {
    if (!userId || !addCategoryId) return;
    setSavingService(true);
    const { error } = await supabase.from("provider_services").insert({
      provider_id: userId,
      category_id: addCategoryId,
      price_from: addPrice ? Number(addPrice) : null,
    });
    setSavingService(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAddCategoryId("");
    setAddPrice("");
    await queryClient.invalidateQueries({ queryKey: ["provider-services", userId] });
  }

  async function removeService(id: string) {
    const { error } = await supabase.from("provider_services").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["provider-services", userId] });
  }

  const availableCategories = categories.filter(
    (c) => !services.some((s) => s.category_id === c.id),
  );

  const memberYears = provider
    ? Math.max(1, new Date().getFullYear() - new Date(provider.member_since).getFullYear())
    : 0;

  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="bg-hero text-primary-foreground px-5 pt-10 pb-16 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          {provider?.verification_status === "verificado" && (
            <div className="absolute right-4 top-4">
              <TrustBadge kind="verified" />
            </div>
          )}
          <div className="relative flex flex-col items-center text-center">
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={changeProfilePhoto} />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={savingPhoto}
              className="relative h-24 w-24 rounded-3xl border-4 border-white/20 bg-gradient-to-br from-sky-400 to-blue-600 overflow-hidden shadow-float disabled:opacity-60"
              aria-label="Alterar foto de perfil"
            >
              {provider?.profiles?.avatar_url ? (
                <img src={provider.profiles.avatar_url} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <span className="h-full w-full flex items-center justify-center text-3xl font-extrabold">
                  {(provider?.profiles?.full_name || provider?.headline || "?")[0]?.toUpperCase()}
                </span>
              )}
              <span className="absolute right-1 bottom-1 h-7 w-7 rounded-full bg-background text-primary flex items-center justify-center shadow-card">
                <Camera className="h-4 w-4" />
              </span>
            </button>
            <div className="flex items-center gap-1 mt-3">
              <p className="text-xl font-extrabold font-[Manrope]">
                {provider?.profiles?.full_name || provider?.headline || "Prestador"}
              </p>
              {provider?.verification_status === "verificado" && <BadgeCheck className="h-5 w-5" />}
            </div>
            <p className="text-sm opacity-90">{provider?.city ?? "—"}</p>
            <div className="flex items-center gap-4 mt-4 text-sm">
              <Stat value={String(provider?.rating_avg ?? 0)} label="Nota" />
              <div className="h-8 w-px bg-white/20" />
              <Stat value={String(provider?.jobs_count ?? 0)} label="Serviços" />
              <div className="h-8 w-px bg-white/20" />
              <Stat
                value={`${memberYears} ano${memberYears === 1 ? "" : "s"}`}
                label="Plataforma"
              />
            </div>
          </div>
        </div>

        <div className="px-5 -mt-8">
          <div className="rounded-2xl bg-card border border-border shadow-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Especialidades
            </p>
            <div className="flex flex-wrap gap-2">
              {(provider?.specialties?.length ? provider.specialties : ["Nenhuma cadastrada"]).map(
                (s) => (
                  <span
                    key={s}
                    className="h-8 px-3 rounded-full bg-secondary text-xs font-semibold flex items-center"
                  >
                    {s}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>

        <section className="px-5 mt-6">
          <h2 className="text-base font-bold mb-3">Área de atendimento</h2>
          <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
            <MapView lat={provider?.lat ?? null} lng={provider?.lng ?? null} height={160} />
            <button
              onClick={useMyLocation}
              disabled={locating}
              className="w-full h-11 rounded-xl bg-secondary text-primary text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LocateFixed className="h-4 w-4" />
              {locating ? "Localizando..." : "Usar minha localização atual"}
            </button>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-muted-foreground">Raio de atendimento</p>
                <p className="text-xs font-bold text-primary">{radiusKm} km</p>
              </div>
              <input
                type="range"
                min={5}
                max={300}
                step={5}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full"
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={300}
                  step={5}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Math.max(5, Math.min(300, Number(e.target.value) || 5)))}
                  className="h-10 w-24 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none"
                  aria-label="Raio em quilômetros"
                />
                <span className="text-xs text-muted-foreground">km — digite o valor e salve.</span>
              </div>
              <button
                onClick={saveRadius}
                disabled={savingLocation}
                className="mt-2 w-full h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
              >
                {savingLocation ? "Salvando..." : "Salvar raio"}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Com a localização e o raio definidos, você recebe primeiro os pedidos mais próximos de
              você.
            </p>
          </div>
        </section>

        <section className="px-5 mt-6">
          <div className="rounded-2xl bg-card border border-border p-4">
            <input ref={documentInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={uploadVerificationDocument} />
            <div className="flex items-start gap-3"><FileText className="h-5 w-5 text-primary mt-0.5" /><div className="flex-1"><p className="text-sm font-semibold">Verificacao de identidade</p><p className="text-xs text-muted-foreground mt-1">Envie documento com foto ou comprovante profissional. Apenas a equipe BICOJA tera acesso.</p></div></div>
            <button onClick={() => documentInputRef.current?.click()} disabled={sendingDocument} className="mt-3 w-full h-10 rounded-xl border border-primary text-primary text-xs font-semibold disabled:opacity-50">{sendingDocument ? "Enviando..." : "Enviar documento"}</button>
            {verificationDocuments.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{verificationDocuments.length} documento(s) enviado(s) · ultimo status: {verificationDocuments[0].status.replace("_", " ")}</p>}
          </div>
        </section>

        <section className="px-5 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Endereço de atendimento</h2>
            <button onClick={() => setEditingAddress((value) => !value)} className="text-xs font-semibold text-primary flex items-center gap-1">
              <Pencil className="h-3.5 w-3.5" /> {editingAddress ? "Cancelar" : "Editar"}
            </button>
          </div>
          <div className="rounded-2xl bg-card border border-border p-4">
            {editingAddress ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input value={cep} onChange={(event) => setCep(formatCep(event.target.value))} placeholder="CEP" inputMode="numeric" className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none" />
                  <button onClick={findCep} disabled={cepLoading || cep.replace(/\D/g, "").length !== 8} className="h-11 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40">{cepLoading ? "..." : "Buscar"}</button>
                </div>
                <div className="flex gap-2"><input value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Rua" className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none" /><input value={houseNumber} onChange={(event) => setHouseNumber(event.target.value)} placeholder="Número" className="w-24 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none" /></div>
                <input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} placeholder="Bairro" className="w-full h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none" />
                <div className="flex gap-2"><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade" className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none" /><input value={state} onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))} placeholder="UF" className="w-20 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none" /></div>
                <button onClick={saveAddress} disabled={savingAddress} className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">{savingAddress ? "Salvando..." : "Salvar endereço"}</button>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm"><p className="font-semibold">{provider?.street ? `${provider.street}, ${provider.number ?? "s/n"}` : "Endereço ainda não cadastrado"}</p><p className="text-muted-foreground">{[provider?.neighborhood, provider?.city, provider?.state].filter(Boolean).join(" — ") || "Complete seu endereço para receber pedidos próximos."}</p>{provider?.cep && <p className="text-xs text-muted-foreground mt-1">CEP {formatCep(provider.cep)}</p>}</div>
              </div>
            )}
          </div>
        </section>

        <section className="px-5 mt-6">
          <h2 className="text-base font-bold mb-3">Serviços que você oferece</h2>
          <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
            {services.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum serviço cadastrado ainda. Clientes veem essa lista no seu perfil público.
              </p>
            )}
            {services.map((s) => {
              const Icon = categoryIcon(s.service_categories?.icon ?? "Wrench");
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {s.service_categories?.label ?? "Serviço"}
                    </p>
                    {s.price_from != null && (
                      <p className="text-xs text-muted-foreground">
                        A partir de R$ {Number(s.price_from).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeService(s.id)}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            {availableCategories.length > 0 && (
              <div className="pt-2 border-t border-border space-y-2">
                <select
                  value={addCategoryId}
                  onChange={(e) => setAddCategoryId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                >
                  <option value="">Escolha uma categoria...</option>
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Preço a partir de (opcional)"
                    inputMode="decimal"
                    className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                  />
                  <button
                    onClick={addService}
                    disabled={!addCategoryId || savingService}
                    className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="px-5 mt-6">
          <h2 className="text-base font-bold mb-3">Últimas avaliações</h2>
          <div className="space-y-2">
            {reviews.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Ainda sem avaliações.
              </p>
            )}
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold">{r.profiles?.full_name ?? "Cliente"}</p>
                  <div className="flex">
                    {Array.from({ length: r.stars }).map((_, k) => (
                      <Star key={k} className="h-3 w-3 fill-warn text-warn" />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        </section>

        <div className="px-5 mt-6">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-destructive font-semibold"
          >
            <LogOut className="h-4 w-4" /> Sair da conta
          </button>
        </div>
      </div>
      <BottomNav variant="pro" />
    </PhoneFrame>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-base font-extrabold font-[Manrope]">{value}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}
