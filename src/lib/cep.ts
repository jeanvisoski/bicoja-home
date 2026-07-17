export type CepAddress = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export function isValidCep(cep: string): boolean {
  return /^\d{8}$/.test(cep.replace(/\D/g, ""));
}

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export async function lookupCep(cep: string): Promise<CepAddress> {
  const digits = cep.replace(/\D/g, "");
  if (!isValidCep(digits)) throw new Error("CEP inválido. Digite os 8 números.");
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) throw new Error("Não foi possível consultar o CEP agora.");
  const data = await res.json();
  if (data.erro) throw new Error("CEP não encontrado.");
  return {
    street: data.logradouro || "",
    neighborhood: data.bairro || "",
    city: data.localidade || "",
    state: data.uf || "",
  };
}

export async function geocodeAddressText(
  text: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
