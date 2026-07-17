import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Trash2, Inbox } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
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
  created_at: string;
};

function useMyAddresses(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-addresses", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("id, street, neighborhood, city, created_at")
        .eq("profile_id", userId)
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
    queryClient.invalidateQueries({ queryKey: ["my-addresses", session?.user.id] });
    toast.success("Endereço removido.");
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
            className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border"
          >
            <MapPin className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">{a.street}</p>
              <p className="text-xs text-muted-foreground">
                {a.neighborhood ? `${a.neighborhood} • ` : ""}
                {a.city}
              </p>
            </div>
            <button
              onClick={() => remove(a.id)}
              className="text-destructive p-1"
              aria-label="Remover endereço"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}
