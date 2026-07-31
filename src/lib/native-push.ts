import { isNativeApp } from "./native";
import { supabase } from "./supabase";

// O primeiro .aab publicado (versionCode 1) foi buildado sem
// google-services.json -- o Firebase nunca foi inicializado nesse binário.
// Chamar PushNotifications.register() nele derruba o app (exceção nativa
// não capturável por try/catch em JS, não é só uma promise rejeitada).
// Como o JS deste arquivo chega em todo build instalado assim que o
// Cloudflare publica (o app carrega a URL ao vivo, não um bundle local),
// sem esse gate qualquer usuário ainda no build 1 crasha ao aceitar a
// permissão. A partir do build que já leva o Firebase (versionCode 2, ver
// android/app/build.gradle), a checagem libera sozinha -- não precisa de
// outro deploy de JS quando o Jean subir o próximo .aab.
const MIN_NATIVE_PUSH_BUILD = 2;

async function nativeBuildSupportsPush(): Promise<boolean> {
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return Number(info.build) >= MIN_NATIVE_PUSH_BUILD;
  } catch {
    return false;
  }
}

// Push nativo (FCM) -- só faz sentido dentro do app empacotado (Capacitor).
// No navegador/PWA continua tudo por Web Push (ver lib/push.ts). Os dois
// convivem: um usuário pode ter uma linha em push_subscriptions (navegador)
// e outra em native_push_tokens (celular) ao mesmo tempo.
export async function registerNativePush(userId: string): Promise<boolean> {
  if (!isNativeApp()) return false;
  if (!(await nativeBuildSupportsPush())) return false;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { Capacitor } = await import("@capacitor/core");

    const current = await PushNotifications.checkPermissions();
    let status = current.receive;
    if (status === "prompt" || status === "prompt-with-rationale") {
      const requested = await PushNotifications.requestPermissions();
      status = requested.receive;
    }
    if (status !== "granted") return false;

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      void PushNotifications.addListener("registration", async (token) => {
        const { error } = await supabase.from("native_push_tokens").upsert(
          {
            profile_id: userId,
            platform: Capacitor.getPlatform() === "ios" ? "ios" : "android",
            token: token.value,
          },
          { onConflict: "token" },
        );
        finish(!error);
      });
      void PushNotifications.addListener("registrationError", () => finish(false));

      void PushNotifications.register();
      // Se o dispositivo/FCM demorar demais pra responder, não trava o app
      // esperando -- a próxima vez que o usuário entrar, tenta de novo.
      window.setTimeout(() => finish(false), 10_000);
    });
  } catch {
    return false;
  }
}

// Chamado uma vez por sessão (ver session-context.tsx): pede localização
// cedo, em vez de só quando o prestador já está no meio de um pedido "a
// caminho" -- é o pedido original do Jean ("deve pedir logo na entrada").
// Se o usuário já negou permanentemente, o navegador/Android não mostra o
// diálogo de novo (comportamento da plataforma, não dá pra forçar) -- as
// telas que dependem de localização (ex.: pro.orders.tsx) continuam
// tentando de novo a cada vez que precisam, e mostram um aviso se falhar.
export async function primeLocationPermission(): Promise<void> {
  if (!("geolocation" in navigator)) return;
  await new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(),
      () => resolve(),
      { timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
