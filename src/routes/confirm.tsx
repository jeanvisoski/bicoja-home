import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, AlertTriangle, Sparkles } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { supabase } from "@/lib/supabase";

type OrderPhoto = { id: string; kind: "antes" | "depois"; photo_url: string };

type OrderForConfirmation = { id: string; status: string; pricing_type: "fixed" | "range"; quoted_price_min: number; quoted_price_max: number; final_price: number; final_amount_approved_at: string | null; guarantee_until: string | null; guarantee_status: string };

function useOrderForConfirmation(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order-confirmation", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, pricing_type, quoted_price_min, quoted_price_max, final_price, final_amount_approved_at, guarantee_until, guarantee_status")
        .eq("id", orderId)
        .returns<OrderForConfirmation[]>()
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

function useOrderPhotos(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order-photos", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_photos")
        .select("id, kind, photo_url")
        .eq("order_id", orderId)
        .returns<OrderPhoto[]>();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

export const Route = createFileRoute("/confirm")({
  component: Confirm,
  validateSearch: (search: Record<string, unknown>): { orderId?: string } => ({
    orderId: typeof search.orderId === "string" ? search.orderId : undefined,
  }),
  head: () => ({ meta: [{ title: "Confirmar conclusão — BICOJÁ" }] }),
});

function Confirm() {
  const { orderId } = Route.useSearch();
  const nav = useNavigate();
  const { data: photos = [] } = useOrderPhotos(orderId);
  const { data: order } = useOrderForConfirmation(orderId);
  const antes = photos.filter((p) => p.kind === "antes");
  const depois = photos.filter((p) => p.kind === "depois");
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [sendingDispute, setSendingDispute] = useState(false);
  const readyForConfirmation = order?.status === "fotos_enviadas" || order?.status === "aguardando_confirmacao";
  const guaranteeActive = order?.status === "concluido" && order.guarantee_status === "em_garantia" && !!order.guarantee_until && new Date(order.guarantee_until) > new Date();

  async function confirmCompletion() {
    if (!orderId || !readyForConfirmation || depois.length === 0) {
      toast.error("A confirmação fica disponível após o prestador enviar as fotos da conclusão.");
      return;
    }
    setConfirming(true);
    const { error } = await supabase.rpc("transition_order", {
      p_order_id: orderId,
      p_next_status: "concluido",
      p_final_price: null,
      p_note: "Cliente confirmou a conclusao",
    });
    setConfirming(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    nav({ to: "/rate", search: { orderId } });
  }

  async function reportProblem() {
    if (!orderId || !disputeReason.trim()) return;
    setSendingDispute(true);
    const { error } = await supabase.rpc("transition_order", {
      p_order_id: orderId,
      p_next_status: "em_disputa",
      p_final_price: null,
      p_note: disputeReason.trim(),
    });
    setSendingDispute(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Problema reportado. Nossa equipe vai mediar e entrar em contato.");
    nav({ to: "/orders" });
  }

  return (
    <PhoneFrame>
      <AppHeader title="Conclusão" subtitle="Confirme para liberar o pagamento" back right={<Link to="/orders" className="text-xs font-semibold text-primary px-1">Pedidos</Link>} />

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32">
        <div className={`rounded-2xl p-4 flex items-start gap-3 border ${readyForConfirmation ? "bg-trust-soft/50 border-trust/20" : "bg-secondary border-border"}`}>
          <Sparkles className="h-5 w-5 text-trust mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{readyForConfirmation ? "Serviço finalizado!" : "Aguardando conclusão do prestador"}</p>
            <p className="text-xs text-muted-foreground">
              {readyForConfirmation ? "Confira as fotos e confirme a conclusão para liberar o pagamento." : "Assim que o prestador enviar as fotos finais, você poderá revisar e confirmar."}
            </p>
          </div>
        </div>

        {order && <div className="mt-4 rounded-2xl bg-card border border-border p-4"><p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Valor para aprovação</p><p className="text-lg font-extrabold">R$ {Number(order.final_price).toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">{order.pricing_type === "range" ? `Faixa aceita: R$ ${Number(order.quoted_price_min).toFixed(2)} a R$ ${Number(order.quoted_price_max).toFixed(2)}. ` : "Valor fechado aceito. "}Ao confirmar a conclusão, você aprova este valor e libera o repasse.</p></div>}

        {antes.length > 0 && (
          <>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-6 mb-3">
              Antes
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {antes.map((p) => (
                <img
                  key={p.id}
                  src={p.photo_url}
                  alt=""
                  className="aspect-[4/3] rounded-2xl object-cover shadow-card"
                />
              ))}
            </div>
          </>
        )}

        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-6 mb-3">
          Depois
        </h3>
        {depois.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {depois.map((p) => (
              <img
                key={p.id}
                src={p.photo_url}
                alt=""
                className="aspect-[4/3] rounded-2xl object-cover shadow-card"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">O prestador ainda não enviou fotos.</p>
        )}
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-background/0 pt-8 space-y-2">
        {reporting && (
          <div className="mb-2 space-y-2">
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Descreva o problema para nossa equipe mediar"
              className="w-full h-24 p-3 rounded-2xl bg-card border border-border text-sm resize-none outline-none"
            />
            <button
              onClick={reportProblem}
              disabled={!disputeReason.trim() || sendingDispute}
              className="w-full h-12 rounded-2xl bg-destructive text-destructive-foreground font-semibold disabled:opacity-50"
            >
              {sendingDispute ? "Enviando..." : "Enviar relato"}
            </button>
          </div>
        )}
        <button
          onClick={confirmCompletion}
          disabled={!orderId || confirming || !readyForConfirmation || depois.length === 0}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 shadow-card active:scale-[0.99] transition-transform disabled:opacity-50"
        >
          <Check className="h-5 w-5" /> {confirming ? "Confirmando..." : "Confirmar conclusão"}
        </button>
        <button
          onClick={() => setReporting((v) => !v)}
          disabled={!readyForConfirmation && !guaranteeActive}
          className="w-full h-12 rounded-2xl text-destructive font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <AlertTriangle className="h-4 w-4" /> Reportar problema
        </button>
      </div>
    </PhoneFrame>
  );
}
