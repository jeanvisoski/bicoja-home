import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Trash2, Inbox, Star, Home, Briefcase, MapPinned } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";

export const Route = createFileRoute("/addresses")({
  component: AddressesPage,
  head: () => ({ meta: [{ title: "Endereços — BICOJÁ" }] }),
});

type Address = {
  id: string;
  street: string;
  neighborhood: string | null;
  city: string;
  label: string | null;
  is_default: boolean;
  created_at: string;
};

const LABELS = [
  { value: "casa", text: "Casa", icon: Home },
  { value: "trabalho", text: "Trabalho", icon: Briefcase },
  { value: "outro", text: "Outro", icon: MapPinned },
] as const;

function useMyAddresses(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-addresses", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("id, street, neighborhood, city, label, is_default, created_at")
        .eq("profile_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Address[];
    },
    enabled: !!userId,
  });
}

function AddressesPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: addresses = [] } = useMyAddresses(session?.user.id);
  const [saving, setSaving] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["my-addresses", session?.user.id] });
    queryClient.invalidateQueries({ queryKey: ["request-defaults", session?.user.id] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) {
      toast.error(
        error.code === "23503"
          ? "Este endereço está em um pedido. Atualize a migration de endereços para removê-lo com segurança."
          : error.message,
      );
      return;
    }
    invalidate();
    toast.success("Endereço removido.");
  }

  async function setLabel(id: string, label: string) {
    setSaving(id);
    const { error } = await supabase.from("addresses").update({ label }).eq("id", id);
    setSaving(null);
    if (error) return toast.error(error.message);
    invalidate();
  }

  async function makeDefault(id: string) {
    if (!session?.user.id) return;
    setSaving(id);
    // Só um favorito por vez -- desmarca os outros antes de marcar este.
    const { error: clearError } = await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("profile_id", session.user.id);
    if (clearError) {
      setSaving(null);
      return toast.error(clearError.message);
    }
    const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    setSaving(null);
    if (error) return toast.error(error.message);
    invalidate();
    toast.success("Endereço favorito atualizado.");
  }

  return (
    <PhoneFrame>
      <AppHeader title="Endereços" back="/profile" />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {addresses.length === 0 && (
          <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
            <Inbox className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">
              Nenhum endereço salvo ainda. Endereços são criados automaticamente quando você
              solicita um serviço.
            </p>
          </div>
        )}
        {addresses.map((a) => (
          <div
            key={a.id}
            className={`p-4 rounded-2xl bg-card border space-y-3 ${a.is_default ? "border-primary" : "border-border"}`}
          >
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-sm truncate">{a.street}</p>
                  {a.is_default && (
                    <Star className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.neighborhood ? `${a.neighborhood} • ` : ""}
                  {a.city}
                </p>
              </div>
              <button
                onClick={() => remove(a.id)}
                className="text-destructive p-1 shrink-0"
                aria-label="Remover endereço"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {LABELS.map((l) => {
                const Icon = l.icon;
                const active = a.label === l.value;
                return (
                  <button
                    key={l.value}
                    onClick={() => setLabel(a.id, l.value)}
                    disabled={saving === a.id}
                    className={`h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {l.text}
                  </button>
                );
              })}
              {!a.is_default && (
                <button
                  onClick={() => makeDefault(a.id)}
                  disabled={saving === a.id}
                  className="h-8 px-3 rounded-full text-xs font-semibold text-primary border border-primary/30"
                >
                  Marcar como favorito
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <BottomNav variant="client" />
    </PhoneFrame>
  );
}
