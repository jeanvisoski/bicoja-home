import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { ProviderVerificationGate } from "@/components/bicoja/ProviderVerificationGate";

export const Route = createFileRoute("/pro")({
  component: ProLayout,
});

type ProviderGateInfo = { verification_status: string; is_suspended: boolean };

function useProviderGateInfo(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-gate", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_profiles")
        .select("verification_status, is_suspended")
        .eq("profile_id", providerId)
        .maybeSingle<ProviderGateInfo>();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

function ProLayout() {
  const { session } = useSession();
  const { data: provider, isLoading } = useProviderGateInfo(session?.user.id);

  // Sem sessão: deixa cada tela filha tratar o próprio caso de "faça login"
  // (comportamento já existente antes desse gate).
  if (!session) return <Outlet />;

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Conta sem provider_profiles (cliente puro): deixa a própria tela tratar
  // o caso de "esta conta não é de prestador".
  if (!provider) return <Outlet />;

  if (provider.is_suspended || provider.verification_status !== "verificado") {
    return (
      <ProviderVerificationGate
        userId={session.user.id}
        status={provider.verification_status}
        suspended={provider.is_suspended}
      />
    );
  }

  return <Outlet />;
}
