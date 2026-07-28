import { useEffect } from "react";
import { App } from "@capacitor/app";
import { useNavigate } from "@tanstack/react-router";
import { isNativeApp } from "@/lib/native";

/** Recebe links bicoja:// e entrega a rota para o app web. */
export function NativeAppBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;

    const listener = App.addListener("appUrlOpen", ({ url }) => {
      try {
        const incoming = new URL(url);
        if (incoming.protocol !== "bicoja:") return;
        const path = `/${incoming.hostname}${incoming.pathname}`.replace(/\/{2,}/g, "/");
        // Navegação client-side: um reload de página cheio aqui quebrava a
        // navegação SPA e podia mostrar a tela anterior a partir do cache
        // do navegador ao voltar.
        navigate({ href: `${path}${incoming.search}${incoming.hash}` });
      } catch {
        // Link malformado não pode interromper a sessão do usuário.
      }
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [navigate]);

  return null;
}
