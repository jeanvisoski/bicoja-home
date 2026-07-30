import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.bicoja.mobile",
  appName: "BicoJá",
  webDir: "mobile-web",
  server: {
    // O frontend continua hospedado no Cloudflare. O shell nativo carrega a
    // mesma aplicação de produção, mantendo atualizações web sem republicar
    // as lojas para cada ajuste de interface.
    url: "https://bicoja.jean-a-visoski.workers.dev",
    cleartext: false,
    androidScheme: "https",
  },
  plugins: {
    Camera: {
      presentationStyle: "fullscreen",
    },
  },
};

export default config;
