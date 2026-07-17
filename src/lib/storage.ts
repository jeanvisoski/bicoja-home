import { supabase } from "./supabase";

export async function uploadPhoto(userId: string, folder: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("bicoja-photos").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("bicoja-photos").getPublicUrl(path);
  return data.publicUrl;
}
