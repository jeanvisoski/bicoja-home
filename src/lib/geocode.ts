export type GeocodedAddress = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não é suportada neste navegador."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedAddress> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=pt-BR`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Não foi possível identificar o endereço.");
  const data = await res.json();
  const addr = data.address ?? {};
  const street = [addr.road, addr.house_number].filter(Boolean).join(", ") || data.name || "";
  const neighborhood = addr.suburb || addr.neighbourhood || addr.city_district || "";
  const city = addr.city || addr.town || addr.village || addr.municipality || "";
  return { street, neighborhood, city, state: addr.state_code || "", lat, lng };
}

export async function locateCurrentAddress(): Promise<GeocodedAddress> {
  const position = await getCurrentPosition();
  return reverseGeocode(position.coords.latitude, position.coords.longitude);
}
