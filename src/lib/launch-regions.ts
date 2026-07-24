import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type ServiceArea = { city: string; state: string };
export type LaunchRegionSettings = {
  launch_regions_enabled: boolean;
  active_service_regions: ServiceArea[];
};

export function normalizeAreaPart(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function isInsideActiveServiceArea(
  settings: LaunchRegionSettings | undefined,
  city: string,
  state: string,
) {
  if (!settings?.launch_regions_enabled) return true;
  return settings.active_service_regions.some(
    (region) =>
      normalizeAreaPart(region.city) === normalizeAreaPart(city) &&
      normalizeAreaPart(region.state) === normalizeAreaPart(state),
  );
}

const NO_RESTRICTION: LaunchRegionSettings = {
  launch_regions_enabled: false,
  active_service_regions: [],
};

export function useLaunchRegionSettings() {
  return useQuery({
    queryKey: ["launch-region-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("launch_regions_enabled, active_service_regions")
        .eq("id", true)
        .maybeSingle<LaunchRegionSettings>();
      // A ausência da migration não deve impedir o app antes da atualização.
      // React Query não aceita queryFn retornando undefined, então o
      // "sem restrição" vira um valor de verdade, não a ausência dele.
      if (error?.code === "42703") return NO_RESTRICTION;
      if (error) throw error;
      return data ?? NO_RESTRICTION;
    },
  });
}
