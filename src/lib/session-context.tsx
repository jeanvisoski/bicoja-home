import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { isPushSupported, subscribeToPush } from "./push";
import { isNativeApp } from "./native";
import { primeLocationPermission, registerNativePush } from "./native-push";

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
};

const SessionContext = createContext<SessionContextValue>({ session: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Reconfirma a inscrição de push sempre que uma sessão aparece (login novo
  // ou sessão restaurada do storage) -- antes só rodava quando o usuário
  // abria a tela de Notificações, então uma sessão restaurada sem essa
  // visita ficava sem receber push mesmo com a permissão já concedida antes.
  useEffect(() => {
    if (!session?.user.id || !isPushSupported) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    void subscribeToPush(session.user.id);
  }, [session?.user.id]);

  // Prime as permissões nativas logo que uma sessão aparece, em vez de só
  // pedir localização lá no meio do fluxo do prestador -- pedido explícito
  // do Jean depois de publicar o primeiro .aab na Play Store: notificação
  // nunca funcionou dentro do app empacotado (Web Push não é confiável em
  // segundo plano fora do navegador) e localização só era pedida tarde
  // demais. Roda só dentro do app nativo (Capacitor); no navegador/PWA os
  // efeitos acima continuam sendo o caminho certo.
  useEffect(() => {
    if (!session?.user.id || !isNativeApp()) return;
    void registerNativePush(session.user.id);
    void primeLocationPermission();
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;
    const updatePresence = () => {
      void supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", session.user.id);
    };
    updatePresence();
    const interval = window.setInterval(updatePresence, 60_000);
    return () => window.clearInterval(interval);
  }, [session?.user.id]);

  return <SessionContext.Provider value={{ session, loading }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
