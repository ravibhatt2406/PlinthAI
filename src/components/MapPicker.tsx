'use client';

import dynamic from 'next/dynamic';

const DynamicMapPicker = dynamic(
  () => import('./MapPickerComponent'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[250px] bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-8 h-8 border-4 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-500 font-medium">Loading interactive map...</span>
        </div>
      </div>
    )
  }
);

interface MapPickerProps {
  lat: number;
  lng: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function MapPicker({ lat, lng, onLocationSelect }: MapPickerProps) {
  return <DynamicMapPicker lat={lat} lng={lng} onLocationSelect={onLocationSelect} />;
}
