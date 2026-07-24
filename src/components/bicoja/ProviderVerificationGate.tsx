import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { FileText, ShieldAlert, ShieldCheck, Clock, LogOut } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "@tanstack/react-router";

type VerificationDocument = {
  id: string;
  document_type: string;
  status: string;
  admin_note: string | null;
};

function useVerificationDocuments(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-verification-documents", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_verification_documents")
        .select("id, document_type, status, admin_note")
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false })
        .returns<VerificationDocument[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

const DOCUMENT_TYPES: {
  type: "identidade" | "comprovante_endereco";
  label: string;
  hint: string;
}[] = [
  {
    type: "identidade",
    label: "Documento de identidade",
    hint: "RG, CNH ou CPF, com foto legível.",
  },
  {
    type: "comprovante_endereco",
    label: "Comprovante de residência",
    hint: "Conta de luz, água ou similar, recente.",
  },
];

const STATUS_LABEL: Record<string, string> = {
  enviado: "Enviado, aguardando análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

function DocumentSlot({
  userId,
  type,
  label,
  hint,
  latest,
  onUploaded,
}: {
  userId: string;
  type: "identidade" | "comprovante_endereco";
  label: string;
  hint: string;
  latest: VerificationDocument | undefined;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("O documento deve ter no máximo 8 MB.");
    setSending(true);
    try {
      const extension = file.name.split(".").pop() || "bin";
      const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("provider-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await supabase
        .from("provider_verification_documents")
        .insert({ provider_id: userId, document_type: type, storage_path: path });
      if (error) throw error;
      toast.success("Documento enviado para análise.");
      onUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o documento.");
    }
    setSending(false);
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={upload}
      />
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        </div>
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={sending}
        className="mt-3 w-full h-10 rounded-xl border border-primary text-primary text-xs font-semibold disabled:opacity-50"
      >
        {sending ? "Enviando..." : latest ? "Enviar novamente" : "Enviar documento"}
      </button>
      {latest && (
        <p
          className={`mt-2 text-xs font-medium ${latest.status === "rejeitado" ? "text-destructive" : latest.status === "aprovado" ? "text-trust" : "text-muted-foreground"}`}
        >
          {STATUS_LABEL[latest.status] ?? latest.status}
          {latest.status === "rejeitado" && latest.admin_note ? ` — ${latest.admin_note}` : ""}
        </p>
      )}
    </div>
  );
}

export function ProviderVerificationGate({
  userId,
  status,
  suspended,
}: {
  userId: string;
  status: string;
  suspended: boolean;
}) {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { data: documents = [] } = useVerificationDocuments(userId);

  function latestOf(type: string) {
    return documents.find((d) => d.document_type === type);
  }

  function refetchDocuments() {
    void queryClient.invalidateQueries({ queryKey: ["provider-verification-documents", userId] });
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/login" });
  }

  const hasAllDocuments = DOCUMENT_TYPES.every((d) => !!latestOf(d.type));
  const hasRejected = documents.some((d) => d.status === "rejeitado");

  let headline = "Envie seus documentos para começar";
  let body =
    "Antes de receber pedidos, precisamos confirmar sua identidade e endereço. Isso é revisado manualmente pela nossa equipe.";
  let Icon = ShieldAlert;

  if (suspended) {
    headline = "Sua conta de prestador está suspensa";
    body = "Entre em contato com o suporte para entender o motivo e os próximos passos.";
    Icon = ShieldAlert;
  } else if (hasRejected) {
    headline = "Reenvie o(s) documento(s) rejeitado(s)";
    body = "Um dos documentos enviados não foi aprovado. Veja o motivo abaixo e envie novamente.";
    Icon = ShieldAlert;
  } else if (hasAllDocuments) {
    headline = "Documentos em análise";
    body =
      "Recebemos seus documentos. Nossa equipe revisa manualmente — isso pode levar alguns dias úteis.";
    Icon = Clock;
  } else if (status === "em_analise") {
    headline = "Documentos em análise";
    body = "Nossa equipe está revisando seus documentos.";
    Icon = Clock;
  }

  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto px-5 py-8 space-y-5">
        <div className="rounded-2xl bg-trust-soft/50 border border-trust/20 p-4 flex gap-3">
          <Icon className="h-5 w-5 text-trust shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{headline}</p>
            <p className="text-xs text-muted-foreground mt-1">{body}</p>
          </div>
        </div>

        {!suspended && (
          <div className="space-y-3">
            {DOCUMENT_TYPES.map((d) => (
              <DocumentSlot
                key={d.type}
                userId={userId}
                type={d.type}
                label={d.label}
                hint={d.hint}
                latest={latestOf(d.type)}
                onUploaded={refetchDocuments}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center pt-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          Somente a equipe BICOJÁ tem acesso aos seus documentos.
        </div>

        <button
          onClick={signOut}
          className="w-full h-12 rounded-2xl border border-border text-sm font-semibold flex items-center justify-center gap-2 text-muted-foreground"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </PhoneFrame>
  );
}
