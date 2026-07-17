import { createFileRoute } from "@tanstack/react-router";
import { Bell, Inbox } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { useSession } from "@/lib/session-context";
import { useNotifications, useMarkNotificationRead, type Notification } from "@/lib/notifications";

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

  async function open(n: Notification) {
    if (!n.read) await markRead(n.id, session?.user.id);
    if (n.link) window.location.assign(n.link);
  }

  return (
    <PhoneFrame>
      <AppHeader title="Notificações" back="/home" />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
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
            className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl border ${n.read ? "bg-card border-border" : "bg-primary/5 border-primary/20"}`}
          >
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${n.read ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground"}`}
            >
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {timeAgo(n.created_at)}
            </span>
          </button>
        ))}
      </div>
    </PhoneFrame>
  );
}
