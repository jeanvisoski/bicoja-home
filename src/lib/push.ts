import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const isPushSupported =
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

// A chave pública VAPID vem em base64url (formato do padrão Web Push) e
// precisa virar Uint8Array pra ser aceita por pushManager.subscribe().
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isPushSupported || !VAPID_PUBLIC_KEY) return false;
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );
  return !error;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
