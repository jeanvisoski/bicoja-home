import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { Inbox, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { categoryIcon } from "@/lib/categories";

export const Route = createFileRoute("/pro/schedule")({
  component: Schedule,
  head: () => ({ meta: [{ title: "Agenda — BICOJÁ Pro" }] }),
});

const ACTIVE_STATUSES = [
  "aceito",
  "a_caminho",
  "executando",
  "fotos_enviadas",
  "aguardando_confirmacao",
];
const STATUS_LABEL: Record<string, string> = {
  aceito: "Aceito",
  a_caminho: "A caminho",
  executando: "Em execução",
  fotos_enviadas: "Fotos enviadas",
  aguardando_confirmacao: "Aguardando confirmação",
};

type ScheduleOrder = {
  id: string;
  status: string;
  created_at: string;
  service_requests: {
    scheduled_at: string | null;
    service_categories: { label: string; icon: string } | null;
  } | null;
  profiles: { full_name: string | null } | null;
};

function useProviderProfileId(userId: string | undefined) {
  return useQuery({
    queryKey: ["schedule-provider-id", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_profiles")
        .select("profile_id")
        .eq("profile_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.profile_id ?? null;
    },
    enabled: !!userId,
  });
}

function useUpcoming(providerId: string | null | undefined) {
  return useQuery({
    queryKey: ["schedule-upcoming", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, created_at, service_requests(scheduled_at, service_categories(label, icon)), profiles(full_name)",
        )
        .eq("provider_id", providerId)
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: true })
        .returns<ScheduleOrder[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function Schedule() {
  const { session } = useSession();
  const { data: providerId } = useProviderProfileId(session?.user.id);
  const { data: items = [] } = useUpcoming(providerId);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(selectedDate);
    d.setDate(selectedDate.getDate() - selectedDate.getDay() + i);
    return d;
  });
  const monthLabel = selectedDate.toLocaleDateString("pt-BR", { month: "long" });

  const scheduled = items.filter((it) => it.service_requests?.scheduled_at);
  const unscheduled = items.filter((it) => !it.service_requests?.scheduled_at);

  const dayHasItem = (d: Date) =>
    scheduled.some((it) => sameDay(new Date(it.service_requests!.scheduled_at!), d));

  const dayItems = scheduled
    .filter((it) => sameDay(new Date(it.service_requests!.scheduled_at!), selectedDate))
    .sort(
      (a, b) =>
        new Date(a.service_requests!.scheduled_at!).getTime() -
        new Date(b.service_requests!.scheduled_at!).getTime(),
    );

  return (
    <PhoneFrame>
      <AppHeader title="Agenda" back={false} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-2">
          <p className="text-xs text-muted-foreground capitalize">{monthLabel}</p>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {week.map((d, i) => {
              const active = sameDay(d, selectedDate);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(d)}
                  className={`relative flex flex-col items-center py-2 rounded-2xl ${active ? "bg-primary text-primary-foreground shadow-card" : "bg-card border border-border"}`}
                >
                  <span
                    className={`text-[10px] font-semibold ${active ? "opacity-80" : "text-muted-foreground"}`}
                  >
                    {WEEKDAY_LETTERS[d.getDay()]}
                  </span>
                  <span className="text-base font-extrabold font-[Manrope]">{d.getDate()}</span>
                  {dayHasItem(d) && !active && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            {sameDay(selectedDate, new Date()) ? "Compromissos de hoje" : "Compromissos do dia"}
          </h3>
          {dayItems.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum horário marcado para este dia.
            </p>
          )}
          <div className="space-y-3">
            {dayItems.map((it) => {
              const Icon = categoryIcon(it.service_requests?.service_categories?.icon ?? "Wrench");
              const time = new Date(it.service_requests!.scheduled_at!).toLocaleTimeString(
                "pt-BR",
                { hour: "2-digit", minute: "2-digit" },
              );
              return (
                <Link
                  key={it.id}
                  to="/pro/orders"
                  search={{ orderId: it.id }}
                  className="flex gap-3 items-stretch"
                >
                  <div className="w-14 text-right">
                    <p className="text-sm font-extrabold font-[Manrope]">{time}</p>
                  </div>
                  <div className="flex-1 rounded-2xl bg-card border border-border p-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-sky-100 text-sky-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {it.service_requests?.service_categories?.label ?? "Serviço"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {it.profiles?.full_name ?? "Cliente"}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-trust-soft text-trust shrink-0">
                      {STATUS_LABEL[it.status] ?? it.status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="px-5 mt-6 pb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Sem horário marcado
          </h3>
          {unscheduled.length === 0 ? (
            <div className="flex flex-col items-center text-center py-8 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Nenhum pedido pendente de horário.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unscheduled.map((it) => {
                const Icon = categoryIcon(
                  it.service_requests?.service_categories?.icon ?? "Wrench",
                );
                return (
                  <Link
                    key={it.id}
                    to="/pro/orders"
                    search={{ orderId: it.id }}
                    className="rounded-2xl bg-card border border-border p-3 flex items-center gap-3"
                  >
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-100 text-amber-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {it.service_requests?.service_categories?.label ?? "Serviço"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {it.profiles?.full_name ?? "Cliente"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {STATUS_LABEL[it.status] ?? it.status}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <BottomNav variant="pro" />
    </PhoneFrame>
  );
}
