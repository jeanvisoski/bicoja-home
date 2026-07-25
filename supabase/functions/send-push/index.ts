import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@bicoja.com.br";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

type NotificationRecord = {
  profile_id: string;
  title: string;
  body: string | null;
  link: string | null;
};

// Chamada pelo Database Webhook da tabela notifications (insert). O webhook
// é configurado no dashboard do Supabase pra enviar o service role key no
// header Authorization -- nunca fica hardcoded aqui no código.
Deno.serve(async (request) => {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return Response.json({ error: "VAPID não configurado." }, { status: 500 });
  }

  const payload = await request.json().catch(() => null);
  const record = payload?.record as NotificationRecord | undefined;
  if (!record?.profile_id) return new Response("ignored", { status: 200 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("profile_id", record.profile_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!subscriptions?.length) return new Response("no subscriptions", { status: 200 });

  const notificationPayload = JSON.stringify({
    title: record.title,
    body: record.body,
    link: record.link,
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          notificationPayload,
        );
      } catch (pushError) {
        // 404/410 = o navegador cancelou essa assinatura -- limpa do banco
        // em vez de tentar de novo pra sempre.
        const statusCode = (pushError as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    }),
  );

  return new Response("ok", { status: 200 });
});
