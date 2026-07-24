import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  ShieldCheck,
  MailCheck,
  User,
  Sparkles,
  ChevronLeft,
  Phone,
  Eye,
  EyeOff,
  Camera,
  LocateFixed,
  MapPin,
} from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BrandLogo } from "@/components/bicoja/BrandLogo";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { ensureProfile } from "@/lib/profile";
import { formatPhone, passwordStrength } from "@/lib/format";
import { uploadPhoto } from "@/lib/storage";
import { formatCep, geocodeAddressText, lookupCep } from "@/lib/cep";
import { getCurrentPosition, reverseGeocode } from "@/lib/geocode";
import { categoryIcon, useCategories } from "@/lib/categories";
import { CLIENT_TERMS_VERSION, PROVIDER_TERMS_VERSION } from "@/lib/terms-versions";
import { isInsideActiveServiceArea, useLaunchRegionSettings } from "@/lib/launch-regions";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({ meta: [{ title: "Entrar — BICOJÁ" }] }),
});

type Role = "cliente" | "prestador";

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground px-1 mb-1 block">{label}</label>
      <div className="flex items-center gap-3 h-14 rounded-2xl bg-card border border-border px-4 shadow-card">
        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
        {children}
      </div>
    </div>
  );
}

function Login() {
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
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
  const [sending, setSending] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [providerTermsAccepted, setProviderTermsAccepted] = useState(false);
  const nav = useNavigate();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { data: categories = [] } = useCategories();
  const { data: launchRegionSettings } = useLaunchRegionSettings();

  const strength = passwordStrength(password);

  function resetToEntrar() {
    setMode("entrar");
    setRole(null);
    setAwaitingConfirmation(false);
    setForgotPasswordSent(false);
  }

  async function locateProvider() {
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

  async function forgotPassword() {
    if (!email.includes("@")) {
      toast.error("Digite seu email no campo acima primeiro.");
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForgotPasswordSent(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Digite um email válido.");
      return;
    }
    if (mode === "criar") {
      if (!fullName.trim()) {
        toast.error("Digite seu nome.");
        return;
      }
      if (!termsAccepted) {
        toast.error("Você precisa aceitar os Termos de Uso para criar a conta.");
        return;
      }
      if (role === "prestador" && !providerTermsAccepted) {
        toast.error("Você precisa aceitar o Contrato de Prestação de Serviço Autônomo.");
        return;
      }
      if (!strength.isStrong) {
        toast.error(
          "Sua senha precisa ser forte: pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo.",
        );
        return;
      }
      if (password !== confirmPassword) {
        toast.error("As senhas não coincidem.");
        return;
      }
      if (role === "prestador") {
        if (selectedCategoryIds.length === 0) {
          toast.error("Selecione ao menos uma categoria de serviço.");
          return;
        }
        if (!profilePhoto) {
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
        if (!isInsideActiveServiceArea(launchRegionSettings, city, state)) {
          toast.error(`A BICOJÁ ainda não atende ${city}/${state} nesta fase de lançamento.`);
          return;
        }
      }
    } else if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("Backend ainda não configurado (Supabase). Fale com o Jean.");
      return;
    }

    setSending(true);
    if (mode === "criar") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setSending(false);
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        // "Confirm email" ainda ativo no projeto Supabase — não deveria acontecer
        // depois de desabilitado, mas mantido como fallback honesto.
        setSending(false);
        setAwaitingConfirmation(true);
        return;
      }

      await ensureProfile(data.session);
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq("id", data.session.user.id);
      if (profileError) {
        setSending(false);
        toast.error(profileError.message);
        return;
      }
      await supabase
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          provider_terms_accepted_at: role === "prestador" ? new Date().toISOString() : null,
        })
        .eq("id", data.session.user.id);
      // Registro auditável de qual versão do texto foi aceita (não só a data) --
      // fonte de verdade para prova de consentimento em caso de disputa.
      await supabase.from("terms_acceptances").insert(
        role === "prestador"
          ? [
              {
                profile_id: data.session.user.id,
                document: "cliente",
                version: CLIENT_TERMS_VERSION,
              },
              {
                profile_id: data.session.user.id,
                document: "prestador",
                version: PROVIDER_TERMS_VERSION,
              },
            ]
          : [
              {
                profile_id: data.session.user.id,
                document: "cliente",
                version: CLIENT_TERMS_VERSION,
              },
            ],
      );

      if (role === "prestador") {
        let avatarUrl: string;
        try {
          avatarUrl = await uploadPhoto(data.session.user.id, "avatars", profilePhoto!);
        } catch (error) {
          setSending(false);
          toast.error(
            error instanceof Error ? error.message : "Não foi possível enviar sua foto de perfil.",
          );
          return;
        }
        const { error: providerError } = await supabase.from("provider_profiles").insert({
          profile_id: data.session.user.id,
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
        const { error: servicesError } = await supabase.from("provider_services").insert(
          selectedCategoryIds.map((category_id) => ({
            provider_id: data.session.user.id,
            category_id,
          })),
        );
        if (servicesError) {
          setSending(false);
          toast.error(`Não foi possível salvar as categorias: ${servicesError.message}`);
          return;
        }
        const { error: providerProfileError } = await supabase
          .from("profiles")
          .update({ is_provider: true, avatar_url: avatarUrl })
          .eq("id", data.session.user.id);
        if (providerProfileError) {
          setSending(false);
          toast.error(providerProfileError.message);
          return;
        }
        setSending(false);
        nav({ to: "/pro" });
      } else {
        setSending(false);
        nav({ to: "/home" });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setSending(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      const { data: provider } = await supabase
        .from("provider_profiles")
        .select("profile_id")
        .eq("profile_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .maybeSingle();
      nav({ to: provider ? "/pro" : "/home" });
    }
  }

  if (forgotPasswordSent) {
    return (
      <PhoneFrame>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
          <MailCheck className="h-10 w-10 text-trust" />
          <p className="text-sm">
            Mandamos um link de recuperação para <span className="font-semibold">{email}</span>.
          </p>
          <p className="text-xs text-muted-foreground">
            Abra o email e clique no link, neste mesmo navegador, para definir uma nova senha.
          </p>
          <button
            onClick={resetToEntrar}
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center shadow-card mt-4"
          >
            Voltar para o login
          </button>
        </div>
      </PhoneFrame>
    );
  }

  if (awaitingConfirmation) {
    return (
      <PhoneFrame>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
          <MailCheck className="h-10 w-10 text-trust" />
          <p className="text-sm">
            Conta criada! Mandamos um email de confirmação para{" "}
            <span className="font-semibold">{email}</span>.
          </p>
          <p className="text-xs text-muted-foreground">
            Você ainda <span className="font-semibold">não está logado</span> — confirme o email e
            depois volte aqui para entrar com sua senha.
          </p>
          <button
            onClick={resetToEntrar}
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center shadow-card mt-4"
          >
            Já confirmei, entrar
          </button>
        </div>
      </PhoneFrame>
    );
  }

  // Passo 1 do cadastro: escolher papel (só existe fluxo de criação de conta a partir daqui).
  if (mode === "criar" && !role) {
    return (
      <PhoneFrame>
        <div className="flex-1 flex flex-col px-6 pt-14 pb-8">
          <button
            onClick={() => setMode("entrar")}
            className="flex items-center gap-1 text-sm text-muted-foreground -ml-2 mb-6"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight font-[Manrope] mb-1">
            Como você quer usar a BICOJÁ?
          </h1>
          <p className="text-muted-foreground text-sm mb-8">Você pode mudar isso depois.</p>

          <button
            onClick={() => setRole("cliente")}
            className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card mb-3 text-left"
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Quero contratar serviços</p>
              <p className="text-xs text-muted-foreground">Sou cliente</p>
            </div>
          </button>

          <button
            onClick={() => setRole("prestador")}
            className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card text-left"
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Quero oferecer serviços</p>
              <p className="text-xs text-muted-foreground">Sou prestador</p>
            </div>
          </button>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col px-6 pt-14 pb-8 overflow-y-auto">
        <div className="text-center mb-8">
          <BrandLogo variant="lockup" className="h-44 w-56 mb-4" />
          {mode !== "entrar" && (
            <h1 className="text-3xl font-extrabold tracking-tight font-[Manrope]">
              {role === "prestador" ? "Cadastro de prestador" : "Criar conta"}
            </h1>
          )}
          <p className="text-muted-foreground mt-2 text-sm">
            {mode === "entrar"
              ? "Acesse sua conta para continuar."
              : "Rápido, seguro e sem burocracia."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3" autoComplete="off">
          {mode === "criar" && (
            <>
              <Field label="Nome completo" icon={User}>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </Field>
              <Field label="Telefone" icon={Phone}>
                <input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  inputMode="numeric"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </Field>
            </>
          )}

          <Field label="Email" icon={Mail}>
            <input
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </Field>

          <Field label="Senha" icon={Lock}>
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete={mode === "criar" ? "new-password" : "off"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "criar" ? "Mínimo 8 caracteres" : "Senha"}
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-muted-foreground shrink-0"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </Field>

          {mode === "criar" && password.length > 0 && (
            <div className="px-1 -mt-2">
              <div className="flex gap-1 mb-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${i < strength.score ? strength.color : "bg-secondary"}`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Força da senha: <span className="font-semibold">{strength.label}</span> — use 8+
                caracteres com maiúscula, minúscula, número e símbolo.
              </p>
            </div>
          )}

          {mode === "criar" && (
            <Field label="Confirmar senha" icon={Lock}>
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite a senha novamente"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </Field>
          )}

          {mode === "criar" && role === "prestador" && (
            <>
              <Field label="Título" icon={Sparkles}>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Ex.: Eletricista residencial"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </Field>
              <section className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">Categorias de serviço</p>
                <p className="text-[11px] text-muted-foreground mt-1 mb-3">
                  Selecione uma ou mais categorias que você atende. Elas determinam quais
                  solicitações aparecerão para você.
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
                {categories.length === 0 && (
                  <p className="text-xs text-muted-foreground">Carregando categorias...</p>
                )}
              </section>
              <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Onde você atende?</p>
                    <p className="text-[11px] text-muted-foreground">
                      Endereço completo obrigatório para ordenar pedidos por proximidade.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={locateProvider}
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
                    required
                    placeholder="Rua / avenida"
                    className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                  />
                  <input
                    value={houseNumber}
                    onChange={(event) => setHouseNumber(event.target.value)}
                    required
                    placeholder="Número"
                    className="w-24 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                  />
                </div>
                <input
                  value={neighborhood}
                  onChange={(event) => setNeighborhood(event.target.value)}
                  required
                  placeholder="Bairro"
                  className="w-full h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                />
                <div className="flex gap-2">
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    required
                    placeholder="Cidade"
                    className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-sm outline-none"
                  />
                  <input
                    value={state}
                    onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))}
                    required
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
                  ) : (
                    <span className="h-14 w-14 rounded-2xl bg-secondary text-primary flex items-center justify-center">
                      <Camera className="h-6 w-6" />
                    </span>
                  )}
                  <span>
                    <span className="block text-sm font-semibold">
                      {profilePhoto ? "Foto selecionada" : "Adicionar foto de perfil"}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Obrigatória para clientes reconhecerem você.
                    </span>
                  </span>
                </button>
              </section>
              <p className="text-[11px] text-muted-foreground px-1">
                Verificação de documentos ainda não está implementada — seu perfil começa como
                "pendente" até ser verificado manualmente.
              </p>
            </>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 shadow-card active:scale-[0.99] transition-transform disabled:opacity-50"
          >
            {sending ? "Enviando..." : mode === "entrar" ? "Entrar" : "Criar conta"}
          </button>

          {mode === "entrar" && (
            <button
              type="button"
              onClick={forgotPassword}
              disabled={sending}
              className="w-full text-sm text-muted-foreground text-center"
            >
              Esqueci minha senha
            </button>
          )}
        </form>

        <button
          onClick={() => (mode === "entrar" ? setMode("criar") : resetToEntrar())}
          className="text-sm text-primary font-semibold mt-4 text-center"
        >
          {mode === "entrar" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>

        {mode === "criar" && (
          <label className="flex items-start gap-2 text-[11px] text-muted-foreground mt-5 leading-relaxed text-left">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5"
            />{" "}
            <span>
              Li e aceito os{" "}
              <Link to="/terms" className="text-primary font-semibold">
                Termos de Uso e regras de pagamento protegido
              </Link>
              .
            </span>
          </label>
        )}
        {mode === "criar" && role === "prestador" && (
          <label className="flex items-start gap-2 text-[11px] text-muted-foreground mt-3 leading-relaxed text-left">
            <input
              type="checkbox"
              checked={providerTermsAccepted}
              onChange={(e) => setProviderTermsAccepted(e.target.checked)}
              className="mt-0.5"
            />{" "}
            <span>
              Li e aceito o{" "}
              <Link to="/provider-terms" className="text-primary font-semibold">
                Contrato de Prestação de Serviço Autônomo
              </Link>
              .
            </span>
          </label>
        )}
        <p className="text-[11px] text-muted-foreground text-center mt-3 leading-relaxed">
          Ao continuar você concorda com nossos{" "}
          <span className="text-primary font-medium">Termos</span> e{" "}
          <span className="text-primary font-medium">Política de Privacidade</span>.
        </p>
      </div>
    </PhoneFrame>
  );
}
