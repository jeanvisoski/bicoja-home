import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { useSession } from "@/lib/session-context";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/help")({
  component: HelpPage,
  head: () => ({ meta: [{ title: "Central de ajuda — BICOJÁ" }] }),
});

const FAQ = [
  {
    q: "Como funciona o pagamento protegido?",
    a: "O valor do serviço fica retido pela BICOJÁ até você confirmar que o serviço foi concluído. Só depois disso o prestador recebe.",
  },
  {
    q: "O que acontece se eu tiver um problema?",
    a: "Na tela de conclusão do pedido, use Reportar problema. Nossa equipe media a situação antes de liberar o pagamento.",
  },
  {
    q: "Como funciona a avaliação?",
    a: "Depois de confirmar a conclusão, você avalia o prestador. Isso ajuda outros clientes e libera o pagamento.",
  },
];

function HelpPage() {
  const { session } = useSession();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  async function sendTicket() {
    if (!session || subject.trim().length < 3 || message.trim().length < 5)
      return toast.error("Informe assunto e mensagem.");
    setSending(true);
    const { error } = await supabase
      .from("support_tickets")
      .insert({ profile_id: session.user.id, subject: subject.trim(), message: message.trim() });
    setSending(false);
    if (error) return toast.error(error.message);
    setSubject("");
    setMessage("");
    toast.success("Mensagem enviada. Nossa equipe retornará pelo app.");
  }
  return (
    <PhoneFrame>
      <AppHeader title="Central de ajuda" back="/profile" />
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {FAQ.map((item) => (
          <div key={item.q} className="rounded-2xl bg-card border border-border p-4">
            <div className="flex items-start gap-2 mb-1">
              <HelpCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm font-semibold">{item.q}</p>
            </div>
            <p className="text-sm text-muted-foreground pl-6">{item.a}</p>
          </div>
        ))}
        <section className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">Falar com o suporte</p>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            placeholder="Assunto"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
            placeholder="Conte o que aconteceu"
            className="h-24 w-full rounded-xl border border-border bg-background p-3 text-sm resize-none"
          />
          <button
            onClick={sendTicket}
            disabled={sending}
            className="h-11 w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? "Enviando..." : "Enviar mensagem"}
          </button>
        </section>
      </div>
      <BottomNav variant="client" />
    </PhoneFrame>
  );
}
