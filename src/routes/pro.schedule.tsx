import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Inbox, MapPin, PlayCircle } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { AppHeader } from "@/components/bicoja/AppHeader";
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
  "em_disputa",
];
const FINISHED_STATUSES = ["concluido", "cancelado"];
const STATUS_LABEL: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  aceito: "Confirmado",
  a_caminho: "A caminho",
  executando: "Em execução",
  fotos_enviadas: "Aguardando cliente",
  aguardando_confirmacao: "Aguardando confirmação",
  em_disputa: "Em disputa",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

type ScheduleOrder = {
  id: string;
  status: string;
  created_at: string;
  price: number;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  service_requests: {
    scheduled_at: string | null;
    availability_start: string | null;
    availability_end: string | null;
    availability_start_time: string | null;
    availability_end_time: string | null;
    service_categories: { label: string; icon: string } | null;
    addresses: {
      street: string | null;
      number: string | null;
      neighborhood: string | null;
      city: string | null;
      state: string | null;
    } | null;
  } | null;
  profiles: { full_name: string | null } | null;
};

function useProviderOrders(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-schedule", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, created_at, price, scheduled_date, scheduled_start_time, scheduled_end_time, service_requests(scheduled_at, availability_start, availability_end, availability_start_time, availability_end_time, service_categories(label, icon), addresses(street, number, neighborhood, city, state)), profiles(full_name)",
        )
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false })
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

function serviceDate(order: ScheduleOrder) {
  // O agendamento confirmado pelo prestador ao enviar o orçamento é a fonte
  // de verdade. Só cai para a janela solta do pedido em ordens antigas, de
  // antes desse agendamento existir.
  if (order.scheduled_date) return new Date(`${order.scheduled_date}T12:00:00`);
  const request = order.service_requests;
  if (!request) return null;
  if (request.scheduled_at) return new Date(request.scheduled_at);
  return request.availability_start ? new Date(`${request.availability_start}T12:00:00`) : null;
}

function scheduleLabel(order: ScheduleOrder) {
  if (order.scheduled_date) {
    const date = new Date(`${order.scheduled_date}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
    const hours =
      order.scheduled_start_time && order.scheduled_end_time
        ? ` · ${order.scheduled_start_time.slice(0, 5)}–${order.scheduled_end_time.slice(0, 5)}`
        : "";
    return `${date}${hours}`;
  }
  const request = order.service_requests;
  if (!request) return "Data a combinar";
  if (request.scheduled_at) {
    return new Date(request.scheduled_at).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (request.availability_start) {
    const start = new Date(`${request.availability_start}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
    const end =
      request.availability_end && request.availability_end !== request.availability_start
        ? ` até ${new Date(`${request.availability_end}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
        : "";
    const hours =
      request.availability_start_time && request.availability_end_time
        ? ` · ${request.availability_start_time.slice(0, 5)}–${request.availability_end_time.slice(0, 5)}`
        : "";
    return `Disponível ${start}${end}${hours}`;
  }
  return "Data a combinar";
}

function addressLabel(order: ScheduleOrder) {
  const address = order.service_requests?.addresses;
  if (!address) return "Endereço informado no pedido";
  const first = [address.street, address.number].filter(Boolean).join(", ");
  const second = [address.neighborhood, address.city, address.state].filter(Boolean).join(" · ");
  return [first, second].filter(Boolean).join(" — ") || "Endereço informado no pedido";
}

function statusClass(status: string) {
  if (status === "concluido") return "bg-emerald-100 text-emerald-700";
  if (status === "cancelado" || status === "em_disputa") return "bg-rose-100 text-rose-700";
  if (status === "executando" || status === "a_caminho") return "bg-sky-100 text-sky-700";
  return "bg-amber-100 text-amber-700";
}

function OrderCard({ order, compact = false }: { order: ScheduleOrder; compact?: boolean }) {
  const Icon = categoryIcon(order.service_requests?.service_categories?.icon ?? "Wrench");
  return (
    <Link
      to="/pro/orders"
      search={{ orderId: order.id }}
      className="block rounded-2xl bg-card border border-border p-4 shadow-card active:scale-[0.99] transition-transform"
    >
      <div className="flex gap-3">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2 justify-between">
            <p className="text-sm font-bold truncate">
              {order.service_requests?.service_categories?.label ?? "Serviço"}
            </p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(order.status)}`}
            >
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {order.profiles?.full_name ?? "Cliente"}
          </p>
          {!compact && (
            <p className="mt-2 flex items-start gap-1 text-[11px] text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{addressLabel(order)}</span>
            </p>
          )}
          <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary">
            <Clock className="h-3 w-3" />
            {scheduleLabel(order)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function Schedule() {
  const { session } = useSession();
  const { data: items = [], isLoading } = useProviderOrders(session?.user.id);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filter, setFilter] = useState<"todos" | "ativos" | "finalizados">("todos");

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(selectedDate);
    date.setDate(selectedDate.getDate() - selectedDate.getDay() + i);
    return date;
  });
  const datedItems = useMemo(() => items.filter((item) => serviceDate(item)), [items]);
  const selectedItems = datedItems.filter((item) => sameDay(serviceDate(item)!, selectedDate));
  const unscheduledActive = items.filter(
    (item) => ACTIVE_STATUSES.includes(item.status) && !serviceDate(item),
  );
  const visibleItems = items.filter((item) => {
    if (filter === "ativos")
      return ACTIVE_STATUSES.includes(item.status) || item.status === "aguardando_pagamento";
    if (filter === "finalizados") return FINISHED_STATUSES.includes(item.status);
    return true;
  });
  const todayCount = datedItems.filter(
    (item) => sameDay(serviceDate(item)!, new Date()) && ACTIVE_STATUSES.includes(item.status),
  ).length;
  const activeCount = items.filter((item) => ACTIVE_STATUSES.includes(item.status)).length;
  const completedCount = items.filter((item) => item.status === "concluido").length;

  return (
    <PhoneFrame>
      <AppHeader title="Minha agenda" back={false} />
      <div className="flex-1 overflow-y-auto pb-6">
        <section className="px-5 pt-5">
          <div className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-float">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
                  Visão de trabalho
                </p>
                <h2 className="mt-1 text-xl font-extrabold">Todos os seus serviços</h2>
              </div>
              <CalendarDays className="h-7 w-7 opacity-85" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[10px] uppercase opacity-80">Hoje</p>
                <p className="mt-1 text-xl font-extrabold">{todayCount}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[10px] uppercase opacity-80">Ativos</p>
                <p className="mt-1 text-xl font-extrabold">{activeCount}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[10px] uppercase opacity-80">Concluídos</p>
                <p className="mt-1 text-xl font-extrabold">{completedCount}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 mt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground capitalize">
            {selectedDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {week.map((date) => {
              const active = sameDay(date, selectedDate);
              const hasItem = datedItems.some((item) => sameDay(serviceDate(item)!, date));
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`relative flex flex-col items-center rounded-2xl py-2 ${active ? "bg-primary text-primary-foreground shadow-card" : "border border-border bg-card"}`}
                >
                  <span
                    className={`text-[10px] font-semibold ${active ? "opacity-80" : "text-muted-foreground"}`}
                  >
                    {WEEKDAY_LETTERS[date.getDay()]}
                  </span>
                  <span className="text-base font-extrabold">{date.getDate()}</span>
                  {hasItem && !active && (
                    <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="px-5 mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">
              {sameDay(selectedDate, new Date()) ? "Serviços de hoje" : "Serviços do dia"}
            </h3>
            <span className="text-xs text-muted-foreground">{selectedItems.length} serviço(s)</span>
          </div>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando agenda...</p>
          ) : selectedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum serviço com data para este dia.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedItems.map((item) => (
                <OrderCard key={item.id} order={item} />
              ))}
            </div>
          )}
        </section>

        {unscheduledActive.length > 0 && (
          <section className="px-5 mt-6">
            <h3 className="mb-3 text-sm font-bold">A combinar com o cliente</h3>
            <div className="space-y-3">
              {unscheduledActive.map((item) => (
                <OrderCard key={item.id} order={item} compact />
              ))}
            </div>
          </section>
        )}

        <section className="px-5 mt-7">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold">Histórico de serviços</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Acompanhe cada trabalho já aceito.
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {(["todos", "ativos", "finalizados"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${filter === item ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                {item === "todos" ? "Todos" : item === "ativos" ? "Em andamento" : "Finalizados"}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                <Inbox className="mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">Nenhum serviço nesta visão.</p>
              </div>
            ) : (
              visibleItems.map((item) => <OrderCard key={item.id} order={item} />)
            )}
          </div>
        </section>
      </div>
      <BottomNav variant="pro" />
    </PhoneFrame>
  );
}
