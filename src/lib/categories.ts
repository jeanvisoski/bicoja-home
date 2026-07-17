import { useQuery } from "@tanstack/react-query";
import {
  Zap,
  Wrench,
  PaintRoller,
  Hammer,
  Sprout,
  Sparkles,
  Key,
  Home,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "./supabase";

export type ServiceCategory = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  sort_order: number;
};

const ICONS: Record<string, LucideIcon> = {
  Zap,
  Wrench,
  PaintRoller,
  Hammer,
  Sprout,
  Sparkles,
  Key,
  Home,
};

export function categoryIcon(icon: string): LucideIcon {
  return ICONS[icon] ?? Wrench;
}

export function useCategories() {
  return useQuery({
    queryKey: ["service_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("id, slug, label, icon, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data as ServiceCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
