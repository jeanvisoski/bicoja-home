import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const liveProviderIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:9999px;background:#059669;border:4px solid white;box-shadow:0 0 0 7px rgba(5,150,105,.22),0 2px 8px rgba(0,0,0,.35)"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const FALLBACK: [number, number] = [-23.5505, -46.6333];

type Props = {
  lat: number | null;
  lng: number | null;
  secondaryLat?: number | null;
  secondaryLng?: number | null;
  onChange?: (lat: number, lng: number) => void;
  draggable?: boolean;
  height?: number;
};

export function MapView({ lat, lng, secondaryLat = null, secondaryLng = null, onChange, draggable = false, height = 208 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const secondaryMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = lat != null && lng != null ? [lat, lng] : FALLBACK;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center, lat != null && lng != null ? 16 : 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(center, { icon: pinIcon, draggable }).addTo(map);
    if (secondaryLat != null && secondaryLng != null) {
      secondaryMarkerRef.current = L.marker([secondaryLat, secondaryLng], { icon: liveProviderIcon }).addTo(map);
      map.fitBounds(L.latLngBounds([center, [secondaryLat, secondaryLng]]), { padding: [28, 28], maxZoom: 15 });
    }
    if (draggable && onChange) {
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChange(pos.lat, pos.lng);
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        onChange(e.latlng.lat, e.latlng.lng);
      });
    }

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      secondaryMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (lat == null || lng == null) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 15));
  }, [lat, lng]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (secondaryLat == null || secondaryLng == null) {
      secondaryMarkerRef.current?.remove();
      secondaryMarkerRef.current = null;
      return;
    }
    if (!secondaryMarkerRef.current) {
      secondaryMarkerRef.current = L.marker([secondaryLat, secondaryLng], { icon: liveProviderIcon }).addTo(mapRef.current);
    } else {
      secondaryMarkerRef.current.setLatLng([secondaryLat, secondaryLng]);
    }
    if (lat != null && lng != null) {
      mapRef.current.fitBounds(L.latLngBounds([[lat, lng], [secondaryLat, secondaryLng]]), { padding: [28, 28], maxZoom: 15 });
    } else {
      mapRef.current.setView([secondaryLat, secondaryLng], Math.max(mapRef.current.getZoom(), 15));
    }
  }, [lat, lng, secondaryLat, secondaryLng]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full rounded-2xl overflow-hidden border border-border z-0"
    />
  );
}
