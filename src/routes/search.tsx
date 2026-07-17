import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  MapPin,
  Search as SearchIcon,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { useCategories, categoryIcon } from "@/lib/categories";
import { supabase } from "@/lib/supabase";
import { ProfileAvatar } from "@/components/bicoja/ProfileAvatar";

export const Route = createFileRoute("/search")({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>): { category?: string } => ({
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  head: () => ({ meta: [{ title: "Buscar — BICOJÁ" }] }),
});

type ProviderResult = {
  provider_id: string;
  price_from: number | null;
  provider_profiles: {
    headline: string | null;
    city: string | null;
    rating_avg: number;
    verification_status: string;
    profiles: { full_name: string | null; avatar_url: string | null } | null;
  } | null;
};

function useProvidersForCategory(category: string | undefined) {
  return useQuery({
    queryKey: ["providers-for-category", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_services")
        .select(
          "provider_id, price_from, provider_profiles!inner(headline, city, rating_avg, verification_status, profiles(full_name, avatar_url)), service_categories!inner(slug)",
        )
        .eq("service_categories.slug", category ?? "")
        .returns<ProviderResult[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!category,
  });
}

function SearchPage() {
  const { data: categories = [] } = useCategories();
  const { category } = Route.useSearch();
  const [term, setTerm] = useState("");
  const { data: providerRows = [], isLoading, error } = useProvidersForCategory(category);
  const selectedCategory = categories.find((item) => item.slug === category);
  const providers = useMemo(() => {
    const seen = new Set<string>();
    const normalized = term.trim().toLocaleLowerCase("pt-BR");
    return providerRows.filter((row) => {
      if (seen.has(row.provider_id)) return false;
      seen.add(row.provider_id);
      const name = row.provider_profiles?.profiles?.full_name ?? row.provider_profiles?.headline ?? "";
      return !normalized || name.toLocaleLowerCase("pt-BR").includes(normalized);
    });
  }, [providerRows, term]);

  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-5 pt-8">
          <h1 className="text-2xl font-extrabold font-[Manrope] tracking-tight mb-4">Buscar</h1>
          <div className="flex items-center gap-3 h-14 rounded-2xl bg-card border border-border px-4 shadow-card">
            <SearchIcon className="h-5 w-5 text-muted-foreground" />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Nome do prestador..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
        </div>

        <section className="mt-6 px-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Populares agora
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Vazamento", "Faxina", "Chuveiro elétrico", "Pintura de quarto", "Poda de árvore", "Chaveiro 24h"].map(
              (item) => (
                <span key={item} className="h-9 px-4 rounded-full bg-secondary text-sm font-medium flex items-center">
                  {item}
                </span>
              ),
            )}
          </div>
        </section>

        {selectedCategory && (
          <section className="mt-7 px-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Prestadores de {selectedCategory.label}
              </h2>
            </div>
            <div className="space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">Buscando prestadores...</p>}
              {error && <p className="text-sm text-destructive py-4 text-center">Não foi possível carregar os prestadores agora.</p>}
              {!isLoading && !error && providers.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Ainda não há prestadores cadastrados nesta categoria.</p>
              )}
              {providers.map((row) => {
                const provider = row.provider_profiles;
                const name = provider?.profiles?.full_name ?? provider?.headline ?? "Prestador";
                return (
                  <Link
                    key={row.provider_id}
                    to="/providers/$providerId"
                    params={{ providerId: row.provider_id }}
                    className="flex items-center gap-3 rounded-2xl bg-card border border-border shadow-card p-4"
                  >
                    <ProfileAvatar name={name} src={provider?.profiles?.avatar_url} className="h-11 w-11 rounded-2xl text-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="font-semibold text-sm truncate">{name}</p>
                        {provider?.verification_status === "verificado" && <BadgeCheck className="h-4 w-4 text-trust shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-0.5"><Star className="h-3.5 w-3.5 fill-warn text-warn" /> {provider?.rating_avg ?? 0}</span>
                        {provider?.city && <span className="flex items-center gap-0.5 truncate"><MapPin className="h-3.5 w-3.5" /> {provider.city}</span>}
                      </div>
                    </div>
                    {row.price_from != null && <span className="text-[11px] font-semibold text-primary">A partir de R$ {Number(row.price_from).toFixed(2)}</span>}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-7 px-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Todas as categorias</h2>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((item) => {
              const Icon = categoryIcon(item.icon);
              return (
                <Link
                  to="/search"
                  search={{ category: item.slug }}
                  key={item.id}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border"
                >
                  <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}
