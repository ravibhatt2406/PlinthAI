'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icon asset paths using unpkg CDN
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface MapEventsProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

// Subcomponent to handle click events on the map
function MapEvents({ onLocationSelect }: MapEventsProps) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Subcomponent to update map view when external lat/lng changes
interface ChangeViewProps {
  center: [number, number];
}

function ChangeView({ center }: ChangeViewProps) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 14);
  }, [center, map]);
  return null;
}

interface MapPickerComponentProps {
  lat: number;
  lng: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function MapPickerComponent({
  lat,
  lng,
  onLocationSelect,
}: MapPickerComponentProps) {
  const position: [number, number] = [lat, lng];

  return (
    <div className="w-full h-[250px] border border-slate-200 rounded-lg overflow-hidden relative">
      <MapContainer
        center={position}
        zoom={14}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <ChangeView center={position} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} icon={markerIcon} />
        <MapEvents onLocationSelect={onLocationSelect} />
      </MapContainer>
      <div className="absolute bottom-2 right-2 z-[400] bg-white px-2 py-1 text-xs border border-slate-200 rounded shadow-sm pointer-events-none text-slate-500">
        Click map to reposition pin
      </div>
    </div>
  );
}
