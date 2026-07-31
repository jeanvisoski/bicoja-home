import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@bicoja.com.br";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// Push nativo (Android/iOS empacotado) precisa de Firebase Cloud Messaging
// -- Web Push (acima) não entrega de forma confiável em segundo plano fora
// do navegador. FIREBASE_SERVICE_ACCOUNT é o JSON da conta de serviço
// baixado em Configurações do projeto > Contas de serviço no console do
// Firebase (contém uma chave privada -- fica só como Supabase secret, nunca
// no código). FIREBASE_PROJECT_ID tem um fallback porque o id do projeto
// não é segredo (já aparece em google-services.json, embutido no app).
//
// Assina o JWT do OAuth2 de conta de serviço na mão com Web Crypto (nativo
// do Deno) em vez de depender de google-auth-library via npm: -- essa
// biblioteca tem várias dependências pensadas pra Node que não têm garantia
// de rodar igual em Deno, e não dá pra testar isso antes do deploy real.
const firebaseServiceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID") || "bicoja-3e9e3";

function base64UrlEncode(data: ArrayBuffer | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importServiceAccountKey(pem: string): Promise<CryptoKey> {
  const pkcs8 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(pkcs8);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

let cachedFcmToken: { token: string; expiresAt: number } | null = null;

async function getFcmAccessToken(): Promise<string | null> {
  if (!firebaseServiceAccountJson) return null;
  if (cachedFcmToken && cachedFcmToken.expiresAt > Date.now() + 30_000) {
    return cachedFcmToken.token;
  }
  try {
    const serviceAccount = JSON.parse(firebaseServiceAccountJson) as {
      client_email: string;
      private_key: string;
    };
    const key = await importServiceAccountKey(serviceAccount.private_key);
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64UrlEncode(
      JSON.stringify({
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    );
    const unsigned = `${header}.${claims}`;
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    );
    const assertion = `${unsigned}.${base64UrlEncode(signature)}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    cachedFcmToken = {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
    return json.access_token;
  } catch {
    return null;
  }
}

type NotificationRecord = {
  profile_id: string;
  title: string;
  body: string | null;
  link: string | null;
};

async function sendViaFcm(
  admin: ReturnType<typeof createClient>,
  profileId: string,
  record: NotificationRecord,
) {
  if (!firebaseServiceAccountJson) return;
  const { data: tokens } = await admin
    .from("native_push_tokens")
    .select("id, token")
    .eq("profile_id", profileId);
  if (!tokens?.length) return;

  const accessToken = await getFcmAccessToken();
  if (!accessToken) return;
  await Promise.all(
    tokens.map(async (row) => {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: row.token,
              notification: {
                title: record.title,
                body: record.body || "Você recebeu uma atualização.",
              },
              data: { link: record.link || "/notifications" },
            },
          }),
        },
      );
      // UNREGISTERED/NOT_FOUND = o app desinstalou ou o token expirou --
      // limpa do banco em vez de tentar de novo pra sempre.
      if (response.status === 404 || response.status === 400) {
        const body = await response.text().catch(() => "");
        if (body.includes("UNREGISTERED") || body.includes("NOT_FOUND")) {
          await admin.from("native_push_tokens").delete().eq("id", row.id);
        }
      }
    }),
  );
}

// Chamada pelo Database Webhook da tabela notifications (insert). O webhook
// é configurado no dashboard do Supabase pra enviar o service role key no
// header Authorization -- nunca fica hardcoded aqui no código.
Deno.serve(async (request) => {
  const payload = await request.json().catch(() => null);
  const record = payload?.record as NotificationRecord | undefined;
  if (!record?.profile_id) return new Response("ignored", { status: 200 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const fcmPromise = sendViaFcm(admin, record.profile_id, record);

  if (!vapidPublicKey || !vapidPrivateKey) {
    await fcmPromise;
    return new Response("web push not configured, fcm attempted", { status: 200 });
  }

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("profile_id", record.profile_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const notificationPayload = JSON.stringify({
    title: record.title,
    body: record.body,
    link: record.link,
  });

  await Promise.all([
    fcmPromise,
    ...(subscriptions ?? []).map(async (subscription) => {
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
  ]);

  return new Response("ok", { status: 200 });
});
