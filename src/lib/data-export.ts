import { supabase } from "@/lib/supabase";

// Portabilidade de dados (LGPD art. 18, V): monta um JSON com tudo que o
// próprio usuário já pode ler via RLS -- não precisa de service_role nem de
// edge function, é a mesma visibilidade que ele já tem no app.
export async function exportMyData(userId: string) {
  const [
    profile,
    addresses,
    providerProfile,
    verificationDocs,
    requests,
    proposals,
    orders,
    ratingsGiven,
    ratingsReceived,
    messages,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("addresses").select("*").eq("profile_id", userId),
    supabase.from("provider_profiles").select("*").eq("profile_id", userId).maybeSingle(),
    supabase
      .from("provider_verification_documents")
      .select("document_type, status, created_at, reviewed_at")
      .eq("provider_id", userId),
    supabase.from("service_requests").select("*").eq("client_id", userId),
    supabase.from("proposals").select("*").eq("provider_id", userId),
    supabase.from("orders").select("*").or(`client_id.eq.${userId},provider_id.eq.${userId}`),
    supabase.from("ratings").select("*").eq("client_id", userId),
    supabase.from("ratings").select("*").eq("provider_id", userId),
    supabase.from("messages").select("*").eq("sender_id", userId),
  ]);

  const firstError = [
    profile,
    addresses,
    providerProfile,
    verificationDocs,
    requests,
    proposals,
    orders,
    ratingsGiven,
    ratingsReceived,
    messages,
  ].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  return {
    gerado_em: new Date().toISOString(),
    observacao:
      "Documentos de verificação de prestador não incluem o arquivo em si, só o tipo e status -- ficam restritos à equipe BICOJÁ.",
    perfil: profile.data,
    enderecos: addresses.data,
    perfil_prestador: providerProfile.data,
    documentos_verificacao: verificationDocs.data,
    solicitacoes_de_servico: requests.data,
    propostas_enviadas: proposals.data,
    pedidos: orders.data,
    avaliacoes_dadas: ratingsGiven.data,
    avaliacoes_recebidas: ratingsReceived.data,
    mensagens_enviadas: messages.data,
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
