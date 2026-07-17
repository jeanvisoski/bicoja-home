import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas — copie .env.example para .env.local e preencha com o projeto Supabase da BICOJÁ. Usando placeholder para não quebrar o SSR.",
  );
}

// createClient valida a URL de forma síncrona e derruba o SSR inteiro se ela vier vazia,
// por isso o placeholder — nunca se conecta de verdade enquanto isSupabaseConfigured for false.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
