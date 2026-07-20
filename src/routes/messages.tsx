import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Search, Send, Paperclip, ChevronLeft, AlertTriangle } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session-context";
import { ProfileAvatar } from "@/components/bicoja/ProfileAvatar";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { BrandLogo } from "@/components/bicoja/BrandLogo";

export const Route = createFileRoute("/messages")({
  component: Messages,
  head: () => ({ meta: [{ title: "Mensagens — BICOJÁ" }] }),
});

type ChatSummary = {
  conversationId: string;
  orderId: string;
  otherName: string;
  otherAvatarUrl: string | null;
  otherProfileId: string;
  otherLastSeenAt: string | null;
  unreadCount: number;
  lastMessage: string | null;
};

async function fetchChatsAsClient(userId: string): Promise<ChatSummary[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, conversations(id), provider_profiles(profile_id, profiles(full_name, avatar_url))")
    .eq("client_id", userId)
    .returns<
      {
        id: string;
        conversations: { id: string } | null;
        provider_profiles: { profile_id: string; profiles: { full_name: string | null; avatar_url: string | null } | null } | null;
      }[]
    >();
  if (error) throw error;
  return data
    .filter((o) => o.conversations)
    .map((o) => ({
      conversationId: o.conversations!.id,
      orderId: o.id,
      otherName: o.provider_profiles?.profiles?.full_name ?? "Prestador",
      otherAvatarUrl: o.provider_profiles?.profiles?.avatar_url ?? null,
      otherProfileId: o.provider_profiles?.profile_id ?? "",
      otherLastSeenAt: null,
      unreadCount: 0,
      lastMessage: null,
    }));
}

async function fetchChatsAsProvider(userId: string): Promise<ChatSummary[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, client_id, conversations(id), profiles(full_name, avatar_url)")
    .eq("provider_id", userId)
    .returns<
      {
        id: string;
        client_id: string;
        conversations: { id: string } | null;
        profiles: { full_name: string | null; avatar_url: string | null } | null;
      }[]
    >();
  if (error) throw error;
  return data
    .filter((o) => o.conversations)
    .map((o) => ({
      conversationId: o.conversations!.id,
      orderId: o.id,
      otherName: o.profiles?.full_name ?? "Cliente",
      otherAvatarUrl: o.profiles?.avatar_url ?? null,
      otherProfileId: o.client_id,
      otherLastSeenAt: null,
      unreadCount: 0,
      lastMessage: null,
    }));
}

function useMyChats(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-chats", userId],
    queryFn: async () => {
      if (!userId) return [];
      const [asClient, asProvider] = await Promise.all([
        fetchChatsAsClient(userId),
        fetchChatsAsProvider(userId),
      ]);
      const chats = [...asClient, ...asProvider];
      if (chats.length === 0) return chats;
      // Presença é opcional para manter conversas disponíveis antes da migration.
      const { data: presence } = await supabase
        .from("profiles")
        .select("id, last_seen_at")
        .in("id", chats.map((chat) => chat.otherProfileId).filter(Boolean));
      const lastSeenByProfile = new Map(
        (presence ?? []).map((profile) => [profile.id, profile.last_seen_at as string | null]),
      );
      const { data: chatMessages, error } = await supabase
        .from("messages")
        .select("conversation_id, sender_id, body, created_at, read_at")
        .in("conversation_id", chats.map((chat) => chat.conversationId))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return chats
        .map((chat) => {
          const inChat = (chatMessages ?? []).filter((message) => message.conversation_id === chat.conversationId);
          return {
            ...chat,
            otherLastSeenAt: lastSeenByProfile.get(chat.otherProfileId) ?? null,
            unreadCount: inChat.filter((message) => message.sender_id !== userId && !message.read_at).length,
            lastMessage: inChat[0]?.body ?? null,
          };
        })
        .sort((a, b) => Number(b.unreadCount > 0) - Number(a.unreadCount > 0));
    },
    enabled: !!userId,
    refetchInterval: 4_000,
  });
}

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, body, created_at, read_at")
        .eq("conversation_id", conversationId)
        .order("created_at");
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
    refetchInterval: 4000,
  });
}

function Messages() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: chats = [], error: chatsError } = useMyChats(session?.user.id);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const { data: messages = [] } = useMessages(openId);

  const openChat = chats.find((c) => c.conversationId === openId);

  useEffect(() => {
    if (!openId || !session?.user.id) return;
    void supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", openId)
      .neq("sender_id", session.user.id)
      .is("read_at", null)
      .then(() => queryClient.invalidateQueries({ queryKey: ["my-chats", session.user.id] }));
  }, [openId, messages.length, queryClient, session?.user.id]);

  async function send() {
    if (!openId || !session || !draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: openId, sender_id: session.user.id, body });
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["messages", openId] });
    queryClient.invalidateQueries({ queryKey: ["my-chats", session.user.id] });
  }

  async function reportExternalPayment() {
    if (!openChat || !session) return;
    const reason = window.prompt("Descreva a tentativa de pagamento fora da BICOJÁ:");
    if (!reason?.trim()) return;
    const { error } = await supabase.from("trust_reports").insert({
      order_id: openChat.orderId,
      reporter_id: session.user.id,
      reported_user_id: openChat.otherProfileId,
      category: "pagamento_externo",
      description: reason.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Denúncia enviada. Nossa equipe irá analisar o caso.");
  }

  if (openId && openChat) {
    return (
      <PhoneFrame>
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-3 h-14 flex items-center gap-3">
          <button onClick={() => setOpenId(null)} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <BrandLogo className="h-7 w-7 shrink-0" />
          <ProfileAvatar name={openChat.otherName} src={openChat.otherAvatarUrl} className="h-9 w-9 rounded-full text-sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-sm font-semibold truncate">{openChat.otherName}</p>
              <BadgeCheck className="h-4 w-4 text-trust" />
            </div>
            <p className={`text-[11px] ${isOnline(openChat.otherLastSeenAt) ? "text-trust" : "text-muted-foreground"}`}>
              {presenceLabel(openChat.otherLastSeenAt)}
            </p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-secondary/40">
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">
              Nenhuma mensagem ainda. Diga olá!
            </p>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} from={m.sender_id === session?.user.id ? "me" : "them"}>
              {m.body}
            </Bubble>
          ))}
          <div className="text-center">
            <span className="text-[10px] font-semibold text-muted-foreground bg-background rounded-full px-3 py-1 border border-border">
              Pagamento protegido pela BICOJÁ
            </span>
          </div>
        </div>
        <div className="p-3 border-t border-border flex items-center gap-2 bg-background">
          <button className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Mensagem"
            className="flex-1 h-11 rounded-full bg-secondary px-4 text-sm outline-none"
          />
          <button
            onClick={send}
            className="h-11 w-11 rounded-full bg-primary flex items-center justify-center"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
        <button onClick={reportExternalPayment} className="absolute right-4 bottom-16 text-[11px] text-destructive font-semibold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Denunciar pagamento externo</button>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <AppHeader title="Mensagens" back={false} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-8">
          <h1 className="text-2xl font-extrabold font-[Manrope] tracking-tight mb-4">Mensagens</h1>
          <div className="flex items-center gap-3 h-12 rounded-2xl bg-secondary px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Buscar conversas"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
        </div>
        <div className="mt-3 divide-y divide-border">
          {chatsError && (
            <p className="text-center text-sm text-destructive py-6 px-5">
              Não foi possível carregar as conversas agora. Tente novamente em instantes.
            </p>
          )}
          {!chatsError && chats.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-16">
              Nenhuma conversa ainda. Elas aparecem aqui quando você contrata ou é contratado.
            </p>
          )}
          {chats.map((c) => (
            <button
              key={c.conversationId}
              onClick={() => setOpenId(c.conversationId)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-secondary/50 text-left"
            >
              <ProfileAvatar name={c.otherName} src={c.otherAvatarUrl} className="h-12 w-12 rounded-full text-sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-semibold truncate">{c.otherName}</p>
                  <BadgeCheck className="h-4 w-4 text-trust shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage ?? presenceLabel(c.otherLastSeenAt)}</p>
              </div>
              {c.unreadCount > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-trust text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {c.unreadCount > 99 ? "99+" : c.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <BottomNav />
    </PhoneFrame>
  );
}

function Bubble({ from, children }: { from: "me" | "them"; children: React.ReactNode }) {
  const me = from === "me";
  return (
    <div className={`flex ${me ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] px-3.5 py-2.5 text-sm rounded-2xl shadow-card ${me ? "bg-primary text-primary-foreground rounded-br-md" : "bg-background rounded-bl-md"}`}
      >
        {children}
      </div>
    </div>
  );
}

function isOnline(lastSeenAt: string | null) {
  return !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
}

function presenceLabel(lastSeenAt: string | null) {
  if (isOnline(lastSeenAt)) return "Online";
  if (!lastSeenAt) return "Visto por último indisponível";
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60_000));
  if (minutes < 60) return `Visto por último há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Visto por último há ${hours} h`;
  return `Visto por último em ${new Date(lastSeenAt).toLocaleDateString("pt-BR")}`;
}
