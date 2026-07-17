import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, MapPin, Bell, HelpCircle, Shield, LogOut, ChevronRight } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { TrustBadge } from "@/components/bicoja/TrustBadge";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { ProfileAvatar } from "@/components/bicoja/ProfileAvatar";

export const Route = createFileRoute("/profile")({
  component: Profile,
  head: () => ({ meta: [{ title: "Perfil — BICOJÁ" }] }),
});

function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

function useAddressCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["address-count", userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("addresses")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", userId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
  });
}

function Profile() {
  const { session } = useSession();
  const nav = useNavigate();
  const { data: profile } = useProfile(session?.user.id);
  const { data: addressCount = 0 } = useAddressCount(session?.user.id);

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/login" });
  }

  const name = profile?.full_name || session?.user.email?.split("@")[0] || "Visitante";

  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="bg-hero text-primary-foreground px-5 pt-10 pb-8 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-4">
            <ProfileAvatar name={name} src={profile?.avatar_url} className="h-16 w-16 rounded-2xl text-2xl border border-white/20" />
            <div className="flex-1">
              <p className="text-xl font-extrabold font-[Manrope] capitalize">{name}</p>
              <p className="text-sm opacity-80">{profile?.email ?? session?.user.email ?? "—"}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <TrustBadge kind="verified" />
            <TrustBadge kind="reviews" />
          </div>
        </div>

        <div className="px-5 mt-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-2">
            Conta
          </p>
          <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
            <Item icon={CreditCard} label="Pagamentos" to="/payments" />
            <Item icon={MapPin} label="Endereços" desc={`${addressCount} salvos`} to="/addresses" />
            <Item icon={Bell} label="Notificações" to="/notifications" />
          </div>

          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-2 mt-6">
            Suporte
          </p>
          <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
            <Item icon={HelpCircle} label="Central de ajuda" to="/help" />
            <Item icon={Shield} label="Segurança e privacidade" to="/security" />
          </div>

          <button
            onClick={signOut}
            className="mt-6 w-full h-13 flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-destructive font-semibold"
          >
            <LogOut className="h-4 w-4" /> Sair da conta
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-4">
            BICOJÁ v1.0 · Feito com segurança
          </p>
        </div>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}

function Item({
  icon: Icon,
  label,
  desc,
  to,
}: {
  icon: typeof CreditCard;
  label: string;
  desc?: string;
  to: "/payments" | "/addresses" | "/notifications" | "/help" | "/security";
}) {
  return (
    <Link to={to} className="w-full flex items-center gap-3 p-4">
      <div className="h-10 w-10 rounded-xl bg-secondary text-primary flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-semibold">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
