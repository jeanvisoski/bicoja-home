import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Camera, LocateFixed, MapPin, MapPinOff } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { uploadPhoto } from "@/lib/storage";
import { formatCep, geocodeAddressText, lookupCep } from "@/lib/cep";
import { getCurrentPosition, reverseGeocode } from "@/lib/geocode";
import { categoryIcon, useCategories } from "@/lib/categories";
import { isInsideActiveServiceArea, useLaunchRegionSettings } from "@/lib/launch-regions";
import { PROVIDER_TERMS_VERSION } from "@/lib/terms-versions";
import { setViewMode } from "@/lib/view-mode";

export const Route = createFileRoute("/become-provider")({
  component: BecomeProvider,
  head: () => ({ meta: [{ title: "Tornar-se prestador — BICOJÁ" }] }),
});

function useCurrentAvatar(userId: string | undefined) {
  return useQuery({
    queryKey: ["current-avatar", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data.avatar_url as string | null;
    },
    enabled: !!userId,
  });
}

type RegionStatus = "unchecked" | "available" | "unavailable";

function BecomeProvider() {
  const { session } = useSession();
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const { data: categories = [] } = useCategories();
  const { data: launchRegionSettings, isLoading: loadingRegionSettings } =
    useLaunchRegionSettings();
  const { data: existingAvatar } = useCurrentAvatar(userId);

  // A disponibilidade de região é verificada ANTES de mostrar qualquer outro
  // campo do cadastro -- sem isso, dava pra preencher tudo e só descobrir no
  // fim (ou nem descobrir, se a checagem carregasse depois do clique).
  const [regionStatus, setRegionStatus] = useState<RegionStatus>("unchecked");
  const [regionCep, setRegionCep] = useState("");
  const [checkingRegion, setCheckingRegion] = useState(false);
  const [regionCityLabel, setRegionCityLabel] = useState("");

  const [headline, setHeadline] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [state, setState] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [locating, setLocating] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [sending, setSending] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function checkRegion() {
    setCheckingRegion(true);
    setAddressError(null);
    try {
      const found = await lookupCep(regionCep);
      const available = isInsideActiveServiceArea(launchRegionSettings, found.city, found.state);
      setRegionCityLabel(`${found.city}/${found.state}`);
      if (!available) {
        setRegionStatus("unavailable");
        return;
      }
      // Já aproveita a busca do CEP pra pré-preencher o endereço do prestador.
      setCep(regionCep);
      setStreet(found.street);
      setNeighborhood(found.neighborhood);
      setCity(found.city);
      setState(found.state);
      const geocoded = await geocodeAddressText(
        `${found.street}, ${found.city}, ${found.state}, Brasil`,
      );
      if (geocoded) {
        setLat(geocoded.lat);
        setLng(geocoded.lng);
      }
      setRegionStatus("available");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
    }
    setCheckingRegion(false);
  }

  async function locate() {
    setLocating(true);
    setAddressError(null);
    try {
      const position = await getCurrentPosition();
      const found = await reverseGeocode(position.coords.latitude, position.coords.longitude);
      const match = found.street.match(/^(.*?),\s*(\d+[\w/-]*)$/);
      setStreet(match?.[1] ?? found.street);
      if (match?.[2]) setHouseNumber(match[2]);
      setNeighborhood(found.neighborhood);
      setCity(found.city);
      setState(found.state);
      setLat(found.lat);
      setLng(found.lng);
    } catch (error) {
      setAddressError(
        error instanceof Error ? error.message : "Não foi possível obter sua localização.",
      );
    }
    setLocating(false);
  }

  async function findCep() {
    setCepLoading(true);
    setAddressError(null);
    try {
      const found = await lookupCep(cep);
      setStreet(found.street);
      setNeighborhood(found.neighborhood);
      setCity(found.city);
      setState(found.state);
      const geocoded = await geocodeAddressText(
        `${found.street}, ${found.city}, ${found.state}, Brasil`,
      );
      if (geocoded) {
        setLat(geocoded.lat);
        setLng(geocoded.lng);
      }
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
    }
    setCepLoading(false);
  }

  async function submit() {
    if (!userId) return;
    if (selectedCategoryIds.length === 0) {
      toast.error("Selecione ao menos uma categoria de serviço.");
      return;
    }
    if (!profilePhoto && !existingAvatar) {
      toast.error("A foto de perfil é obrigatória para prestadores.");
      return;
    }
    if (
      !cep ||
      !street.trim() ||
      !houseNumber.trim() ||
      !neighborhood.trim() ||
      !city.trim() ||
      !state.trim() ||
      lat == null ||
      lng == null
    ) {
      toast.error("Preencha o endereço completo e confirme a localização pelo GPS ou CEP.");
      return;
    }
    // Já foi checado na etapa de região, mas confere de novo por segurança
    // (ex.: se o admin desativou a cidade entre a checagem e o envio).
    if (!isInsideActiveServiceArea(launchRegionSettings, city, state)) {
      setRegionStatus("unavailable");
      setRegionCityLabel(`${city}/${state}`);
      return;
    }
    if (!termsAccepted) {
      toast.error("Você precisa aceitar o Contrato de Prestação de Serviço Autônomo.");
      return;
    }

    setSending(true);
    let avatarUrl = existingAvatar ?? undefined;
    if (profilePhoto) {
      try {
        avatarUrl = await uploadPhoto(userId, "avatars", profilePhoto);
      } catch (error) {
        setSending(false);
        toast.error(
          error instanceof Error ? error.message : "Não foi possível enviar sua foto de perfil.",
        );
        return;
      }
    }

    const { error: providerError } = await supabase.from("provider_profiles").insert({
      profile_id: userId,
      headline: headline || null,
      city: city.trim(),
      specialties: categories
        .filter((category) => selectedCategoryIds.includes(category.id))
        .map((category) => category.label),
      cep: cep.replace(/\D/g, ""),
      street: street.trim(),
      number: houseNumber.trim(),
      neighborhood: neighborhood.trim(),
      state: state.trim(),
      lat,
      lng,
    });
    if (providerError) {
      setSending(false);
      toast.error(providerError.message);
      return;
    }
    const { error: servicesError } = await supabase
      .from("provider_services")
      .insert(selectedCategoryIds.map((category_id) => ({ provider_id: userId, category_id })));
    if (servicesError) {
      setSending(false);
      toast.error(`Não foi possível salvar as categorias: ${servicesError.message}`);
      return;
    }
    const profileUpdate: { is_provider: boolean; avatar_url?: string } = { is_provider: true };
    if (avatarUrl) profileUpdate.avatar_url = avatarUrl;
    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);
    if (profileError) {
      setSending(false);
      toast.error(profileError.message);
      return;
    }
    await supabase.from("terms_acceptances").insert({
      profile_id: userId,
      document: "prestador",
      version: PROVIDER_TERMS_VERSION,
    });

    setSending(false);
    setViewMode("prestador");
    await queryClient.invalidateQueries({ queryKey: ["is-provider", userId] });
    nav({ to: "/pro" });
  }

  if (regionStatus === "unavailable") {
    return (
      <PhoneFrame>
        <AppHeader title="Tornar-se prestador" back="/profile" />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <MapPinOff className="h-12 w-12 text-muted-foreground" />
          <p className="font-semibold">Ainda não atendemos {regionCityLabel}</p>
          <p className="text-sm text-muted-foreground">
            Por enquanto a BICOJÁ está disponível só nas cidades do piloto de lançamento. Assim que
            expandirmos pra sua região, você vai poder se cadastrar como prestador.
          </p>
          <button
            onClick={() => setRegionStatus("unchecked")}
            className="h-12 px-6 rounded-2xl border border-border font-semibold flex items-center justify-center"
          >
            Verificar outro CEP
          </button>
        </div>
      </PhoneFrame>
    );
  }

  if (regionStatus === "unchecked") {
    return (
      <PhoneFrame>
        <AppHeader title="Tornar-se prestador" back="/profile" />
        <div className="flex-1 px-5 py-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Antes de continuar, confirme o CEP de onde você atende — assim já sabemos se a BICOJÁ
            está disponível na sua região.
          </p>
          <div className="flex gap-2">
            <input
              value={regionCep}
              onChange={(event) => setRegionCep(formatCep(event.target.value))}
              placeholder="CEP 00000-000"
              inputMode="numeric"
              className="flex-1 h-12 px-3 rounded-xl bg-card border border-border text-sm outline-none"
            />
            <button
              onClick={checkRegion}
              disabled={
                checkingRegion || loadingRegionSettings || regionCep.replace(/\D/g, "").length !== 8
              }
              className="h-12 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
            >
              {checkingRegion ? "Verificando..." : "Verificar"}
            </button>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <AppHeader title="Tornar-se prestador" back="/profile" />
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-32 space-y-4">
        <p className="text-sm text-muted-foreground">
          Sua conta de cliente continua igual — você só ganha acesso também ao painel de prestador.
          Depois de enviar, seus documentos passam por aprovação manual antes de você poder receber
          pedidos.
        </p>

        <div>
          <label className="text-xs font-medium text-muted-foreground px-1 mb-1 block">
            Título
          </label>
          <div className="flex items-center gap-3 h-14 rounded-2xl bg-card border border-border px-4 shadow-card">
            <Sparkles className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Ex.: Eletricista residencial"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Categorias de serviço</p>
          <p className="text-[11px] text-muted-foreground mt-1 mb-3">
            Selecione uma ou mais categorias que você atende.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((category) => {
              const Icon = categoryIcon(category.icon);
              const selected = selectedCategoryIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setSelectedCategoryIds((current) =>
                      selected
                        ? current.filter((id) => id !== category.id)
                        : [...current, category.id],
                    )
                  }
                  className={`min-h-11 rounded-xl border px-3 text-left text-xs font-semibold flex items-center gap-2 ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground"}`}
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Onde você atende?</p>
              <p className="text-[11px] text-muted-foreground">
                Confirme ou ajuste o endereço encontrado pelo CEP.
              </p>
            </div>
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="shrink-0 h-10 px-3 rounded-xl bg-secondary text-primary text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
            >
              <LocateFixed className="h-4 w-4" /> {locating ? "Buscando..." : "Usar GPS"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={cep}
              onChange={(event) => setCep(formatCep(event.target.value))}
              placeholder="CEP 00000-000"
              inputMode="numeric"
              className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
            />
            <button
              type="button"
              onClick={findCep}
              disabled={cepLoading || cep.replace(/\D/g, "").length !== 8}
              className="h-11 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40"
            >
              {cepLoading ? "..." : "Buscar CEP"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              placeholder="Rua / avenida"
              className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
            />
            <input
              value={houseNumber}
              onChange={(event) => setHouseNumber(event.target.value)}
              placeholder="Número"
              className="w-24 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
            />
          </div>
          <input
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            placeholder="Bairro"
            className="w-full h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
          />
          <div className="flex gap-2">
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Cidade"
              className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
            />
            <input
              value={state}
              onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))}
              placeholder="UF"
              className="w-20 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
            />
          </div>
          {addressError && (
            <p className="text-xs text-destructive">
              {addressError} Preencha manualmente pelo CEP.
            </p>
          )}
          {lat != null && lng != null && (
            <p className="flex items-center gap-1 text-[11px] text-trust">
              <MapPin className="h-3.5 w-3.5" /> Localização confirmada.
            </p>
          )}
        </section>

        <section>
          <p className="text-xs font-medium text-muted-foreground px-1 mb-1 block">
            Foto de perfil
          </p>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => setProfilePhoto(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-full min-h-20 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 flex items-center gap-3 text-left"
          >
            {profilePhoto ? (
              <img
                src={URL.createObjectURL(profilePhoto)}
                alt="Prévia"
                className="h-14 w-14 rounded-2xl object-cover"
              />
            ) : existingAvatar ? (
              <img
                src={existingAvatar}
                alt="Sua foto"
                className="h-14 w-14 rounded-2xl object-cover"
              />
            ) : (
              <span className="h-14 w-14 rounded-2xl bg-secondary text-primary flex items-center justify-center">
                <Camera className="h-6 w-6" />
              </span>
            )}
            <span>
              <span className="block text-sm font-semibold">
                {profilePhoto
                  ? "Foto selecionada"
                  : existingAvatar
                    ? "Manter foto atual (toque para trocar)"
                    : "Adicionar foto de perfil"}
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Obrigatória para clientes reconhecerem você.
              </span>
            </span>
          </button>
        </section>

        <label className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed text-left">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5"
          />{" "}
          <span>
            Li e aceito o{" "}
            <Link
              to="/provider-terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold"
            >
              Contrato de Prestação de Serviço Autônomo
            </Link>
            .
          </span>
        </label>
      </div>
      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-background/0 pt-8">
        <button
          onClick={submit}
          disabled={sending}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 shadow-card active:scale-[0.99] transition-transform disabled:opacity-50"
        >
          {sending ? "Enviando..." : "Tornar-se prestador"}
        </button>
      </div>
    </PhoneFrame>
  );
}
