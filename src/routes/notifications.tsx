import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellRing, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { useSession } from "@/lib/session-context";
import { useNotifications, useMarkNotificationRead, type Notification } from "@/lib/notifications";
import { isPushSupported, subscribeToPush } from "@/lib/push";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notificações — BICOJÁ" }] }),
});

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function NotificationsPage() {
  const { session } = useSession();
  const { data: notifications = [] } = useNotifications(session?.user.id);
  const markRead = useMarkNotificationRead();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );

  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
  }, []);

  // Se a permissão já foi concedida antes (outra sessão neste navegador, ou
  // versão anterior que só pedia permissão sem completar a inscrição), tenta
  // registrar a assinatura de push -- subscribeToPush reaproveita a
  // assinatura existente do navegador, então é seguro repetir.
  useEffect(() => {
    if (!session?.user.id || !isPushSupported) return;
    if (Notification.permission !== "granted") return;
    void subscribeToPush(session.user.id);
  }, [session?.user.id]);

  async function enableBrowserNotifications() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted" || !session?.user.id) return;
    if (!isPushSupported) return;
    const subscribed = await subscribeToPush(session.user.id);
    if (subscribed) toast.success("Notificações ativadas neste dispositivo.");
    else toast.error("Não foi possível ativar as notificações neste dispositivo.");
  }

  async function open(n: Notification) {
    if (!n.read) await markRead(n.id, session?.user.id);
    if (n.link) window.location.assign(n.link);
  }

  return (
    <PhoneFrame>
      <AppHeader title="Notificações" back="/home" />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {permission === "default" && (
          <button
            onClick={enableBrowserNotifications}
            className="w-full flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left"
          >
            <BellRing className="h-5 w-5 text-primary" />
            <span>
              <span className="block text-sm font-semibold">
                Ativar notificacoes no dispositivo
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Receba alertas no navegador e no app instalado.
              </span>
            </span>
          </button>
        )}
        {permission === "denied" && (
          <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            As notificacoes estao bloqueadas neste dispositivo. Ative-as nas permissoes do navegador
            para receber alertas.
          </div>
        )}
        {notifications.length === 0 && (
          <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
            <Inbox className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">Nenhuma notificação por enquanto.</p>
          </div>
        )}
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => open(n)}
            className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl border transition-colors ${n.read ? "bg-card border-border opacity-70" : "bg-primary/10 border-primary/40 shadow-card"}`}
          >
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${n.read ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground"}`}
            >
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                <p
                  className={`text-sm truncate ${n.read ? "font-normal text-muted-foreground" : "font-bold text-foreground"}`}
                >
                  {n.title}
                </p>
              </div>
              {n.body && (
                <p
                  className={`text-xs mt-0.5 ${n.read ? "text-muted-foreground/70" : "text-foreground/80"}`}
                >
                  {n.body}
                </p>
              )}
            </div>
            <span
              className={`text-[11px] shrink-0 ${n.read ? "text-muted-foreground/70" : "text-primary font-semibold"}`}
            >
              {timeAgo(n.created_at)}
            </span>
          </button>
        ))}
      </div>
    </PhoneFrame>
  );
}
