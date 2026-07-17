import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, body, link, read, created_at")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!userId,
    refetchInterval: 15000,
  });
}

export function useUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications-unread", userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", userId)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
    refetchInterval: 15000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return async (id: string, userId: string | undefined) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] });
  };
}
