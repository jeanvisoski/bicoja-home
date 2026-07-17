import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Star, ChevronRight } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { TrustBadge } from "@/components/bicoja/TrustBadge";
import { supabase } from "@/lib/supabase";
import { categoryIcon } from "@/lib/categories";

export const Route = createFileRoute("/providers/$providerId")({
  component: PublicProviderProfile,
  head: () => ({ meta: [{ title: "Prestador — BICOJÁ" }] }),
});

type ProviderProfile = {
  profile_id: string;
  headline: string | null;
  bio: string | null;
  city: string | null;
  specialties: string[];
  rating_avg: number;
  rating_count: number;
  jobs_count: number;
  verification_status: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};

function useProviderProfile(providerId: string | undefined) {
  return useQuery({
    queryKey: ["public-provider-profile", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_profiles")
        .select(
          "profile_id, headline, bio, city, specialties, rating_avg, rating_count, jobs_count, verification_status, profiles(full_name, avatar_url)",
        )
        .eq("profile_id", providerId)
        .maybeSingle<ProviderProfile>();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

type ProviderService = {
  id: string;
  price_from: number | null;
  note: string | null;
  service_categories: { label: string; icon: string; slug: string } | null;
};

function useProviderServices(providerId: string | undefined) {
  return useQuery({
    queryKey: ["public-provider-services", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_services")
        .select("id, price_from, note, service_categories(label, icon, slug)")
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
    queryKey: ["public-provider-reviews", providerId],
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

function PublicProviderProfile() {
  const { providerId } = useParams({ from: "/providers/$providerId" });
  const { data: provider } = useProviderProfile(providerId);
  const { data: services = [] } = useProviderServices(providerId);
  const { data: reviews = [] } = useReviews(providerId);

  const name = provider?.profiles?.full_name || provider?.headline || "Prestador";

  return (
    <PhoneFrame>
      <AppHeader title={name} back />
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="bg-hero text-primary-foreground px-5 pt-6 pb-10 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative flex flex-col items-center text-center">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 border-4 border-white/20 overflow-hidden flex items-center justify-center text-2xl font-extrabold shadow-float">
              {provider?.profiles?.avatar_url ? <img src={provider.profiles.avatar_url} alt={`Foto de ${name}`} className="h-full w-full object-cover" /> : name[0]?.toUpperCase()}
            </div>
            <div className="flex items-center gap-1 mt-3">
              <p className="text-lg font-extrabold font-[Manrope]">{name}</p>
              {provider?.verification_status === "verificado" && <BadgeCheck className="h-4 w-4" />}
            </div>
            <p className="text-sm opacity-90">{provider?.city ?? "—"}</p>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <Star className="h-4 w-4 fill-warn text-warn" />
              <span className="font-semibold">{provider?.rating_avg ?? 0}</span>
              <span className="opacity-80">({provider?.rating_count ?? 0}) </span>
              <span className="opacity-80">• {provider?.jobs_count ?? 0} serviços</span>
            </div>
          </div>
        </div>

        {provider?.bio && (
          <div className="px-5 -mt-4">
            <div className="rounded-2xl bg-card border border-border shadow-card p-4">
              <p className="text-sm text-muted-foreground">{provider.bio}</p>
            </div>
          </div>
        )}

        <section className="px-5 mt-6">
          <h2 className="text-base font-bold mb-3">Serviços oferecidos</h2>
          <div className="space-y-2">
            {services.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Este prestador ainda não cadastrou serviços específicos — você pode solicitar um
                orçamento geral mesmo assim.
              </p>
            )}
            {services.map((s) => {
              const Icon = categoryIcon(s.service_categories?.icon ?? "Wrench");
              return (
                <Link
                  key={s.id}
                  to="/request"
                  search={{ providerId, category: s.service_categories?.slug }}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border shadow-card"
                >
                  <div className="h-10 w-10 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {s.service_categories?.label ?? "Serviço"}
                    </p>
                    {s.price_from != null && (
                      <p className="text-xs text-muted-foreground">
                        A partir de R$ {Number(s.price_from).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
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

        <div className="px-5 mt-4 flex flex-wrap gap-2">
          <TrustBadge kind="payment" />
          <TrustBadge kind="verified" />
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-background/0 pt-8">
        <Link
          to="/request"
          search={{ providerId }}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 shadow-card active:scale-[0.99] transition-transform"
        >
          Solicitar com {name.split(" ")[0]}
        </Link>
      </div>
    </PhoneFrame>
  );
}
