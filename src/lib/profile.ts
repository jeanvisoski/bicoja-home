import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * O trigger `on_auth_user_created` (migration 0002) deveria criar o profile
 * automaticamente no signup. Esse upsert é uma rede de segurança client-side
 * para contas que ficaram sem profile (ex.: criadas antes da trigger existir),
 * evitando erro de FK ao inserir em tabelas que referenciam profiles.id.
 */
export async function ensureProfile(session: Session) {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: session.user.id, email: session.user.email }, { onConflict: "id" });
  if (error) {
    console.error("ensureProfile falhou:", error.message);
  }
}
