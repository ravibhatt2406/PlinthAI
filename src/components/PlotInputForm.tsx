'use client';

import React, { useState } from 'react';
import { CompassDirection, StyleType, PlotInput } from '../lib/types';
import MapPicker from './MapPicker';
import { Compass, MapPin, Loader2, Home, Hammer, ShieldAlert, Sparkles } from 'lucide-react';

interface PlotInputFormProps {
  onSubmit: (data: PlotInput) => void;
  isLoading: boolean;
}

const DIRECTIONS: { label: CompassDirection; angle: number; desc: string }[] = [
  { label: 'N', angle: 0, desc: 'North (Uttar)' },
  { label: 'NE', angle: 45, desc: 'North-East (Eshanya)' },
  { label: 'E', angle: 90, desc: 'East (Purva)' },
  { label: 'SE', angle: 135, desc: 'South-East (Agneya)' },
  { label: 'S', angle: 180, desc: 'South (Dakshin)' },
  { label: 'SW', angle: 225, desc: 'South-West (Nairutya)' },
  { label: 'W', angle: 270, desc: 'West (Paschim)' },
  { label: 'NW', angle: 315, desc: 'North-West (Vayavya)' },
];

const STYLES: { value: StyleType; label: string; desc: string }[] = [
  { value: 'modern', label: 'Modern Glass', desc: 'Flat roofs, floor-to-ceiling windows, open plan' },
  { value: 'minimal', label: 'Minimal Stucco', desc: 'Clean white surfaces, monolithic shapes, simple lines' },
  { value: 'traditional', label: 'Traditional Brick', desc: 'Sloped roofs, terracotta tones, wooden highlights' },
  { value: 'luxury', label: 'Luxury Estate', desc: 'Stone cladding, multiple balconies, grand entries' },
];

export default function PlotInputForm({ onSubmit, isLoading }: PlotInputFormProps) {
  const [address, setAddress] = useState('New Delhi, India');
  const [lat, setLat] = useState(28.6139);
  const [lng, setLng] = useState(77.2090);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [length, setLength] = useState(50); // ft
  const [width, setWidth] = useState(30);   // ft
  const [northDir, setNorthDir] = useState<CompassDirection>('N');
  const [floors, setFloors] = useState(2);
  const [budget, setBudget] = useState(4500000); // INR 45 Lakhs default
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(3);
  const [kitchenType, setKitchenType] = useState('Closed Vastu');
  const [parking, setParking] = useState(true);
  const [garden, setGarden] = useState(false);
  const [balcony, setBalcony] = useState(true);
  const [style, setStyle] = useState<StyleType>('modern');
  const [vastu, setVastu] = useState(true);

  // Address lookup via OSM Nominatim
  const handleGeocode = async () => {
    if (!address.trim()) return;
    setIsGeocoding(true);
    setErrorMsg('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'PlinthHousePlanner/1.0 (contact@plinth.ai)',
          },
        }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setLat(parseFloat(data[0].lat));
        setLng(parseFloat(data[0].lon));
      } else {
        setErrorMsg('Location not found. Try searching for a city or pincode.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Geocoding service unavailable. Click on the map to set location manually.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleLocationSelect = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      address,
      lat,
      lng,
      length_ft: Number(length),
      width_ft: Number(width),
      north_direction: northDir,
      floors: Number(floors),
      budget_inr: Number(budget),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      kitchen_type: kitchenType,
      parking,
      garden,
      balcony,
      style,
      vastu_preference: vastu,
    });
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-8 max-w-4xl mx-auto pb-12">
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-md p-6 md:p-8 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-2xl font-semibold font-architectural text-blueprint flex items-center gap-2">
            <Home className="w-6 h-6 text-terracotta" />
            1. Site & Plot Parameters
          </h2>
          <p className="text-slate-500 text-sm mt-1">Define the boundaries, location, and orientation of your project.</p>
        </div>

        {/* Address & Geocoding */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-semibold text-slate-700 mb-1">
                Plot Location / City Address
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onBlur={handleGeocode}
                    className="pl-10 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta bg-slate-50/50"
                    placeholder="Enter city, region, or pincode"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={isGeocoding}
                  className="px-4 py-2 border border-slate-300 hover:border-slate-400 bg-white rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                >
                  {isGeocoding ? (
                    <Loader2 className="w-4 h-4 animate-spin text-terracotta" />
                  ) : (
                    'Pinpoint'
                  )}
                </button>
              </div>
              {errorMsg && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />{errorMsg}</p>}
            </div>

            {/* Plot Dimensions */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Plot Width (Frontage)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="15"
                    max="150"
                    value={width}
                    onChange={(e) => setWidth(Math.max(15, Number(e.target.value)))}
                    className="w-full px-3 py-2 pr-8 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta bg-slate-50/50"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400">ft</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Plot Depth (Length)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="15"
                    max="150"
                    value={length}
                    onChange={(e) => setLength(Math.max(15, Number(e.target.value)))}
                    className="w-full px-3 py-2 pr-8 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta bg-slate-50/50"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400">ft</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
              Total Area: <strong className="text-slate-700">{width * length} sq.ft.</strong> (~{Math.round((width * length) / 9)} square yards)
            </div>
          </div>

          {/* Interactive OSM Map preview */}
          <div className="flex flex-col justify-end space-y-1">
            <span className="text-sm font-semibold text-slate-700 mb-1">Geocoded Location (Latitude / Longitude)</span>
            <MapPicker lat={lat} lng={lng} onLocationSelect={handleLocationSelect} />
            <span className="text-[10px] text-slate-400 text-right">Coords: {lat.toFixed(5)}, {lng.toFixed(5)}</span>
          </div>
        </div>

        {/* Orientation: Compass Picker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-slate-500" />
              Plot Facing (North Direction)
            </label>
            <p className="text-xs text-slate-400 mb-4">
              Select which direction is face-forward on your plot. This configures standard solar shadows and Vastu entries.
            </p>

            {/* Circular Compass UI Dial */}
            <div className="flex items-center justify-center py-4 bg-slate-50/50 border border-slate-100 rounded-xl relative">
              <div className="relative w-44 h-44 rounded-full border-2 border-dashed border-slate-300 bg-white flex items-center justify-center shadow-inner">
                {/* Compass markers */}
                {DIRECTIONS.map((dir) => {
                  const rad = (dir.angle - 90) * (Math.PI / 180);
                  const x = 70 * Math.cos(rad);
                  const y = 70 * Math.sin(rad);
                  const isSelected = northDir === dir.label;
                  return (
                    <button
                      key={dir.label}
                      type="button"
                      onClick={() => setNorthDir(dir.label)}
                      style={{
                        transform: `translate(${x}px, ${y}px)`,
                      }}
                      className={`absolute w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition border cursor-pointer hover:scale-110 z-10 ${
                        isSelected
                          ? 'bg-terracotta border-terracotta text-white shadow-md'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {dir.label}
                    </button>
                  );
                })}

                {/* Rotating needle */}
                <div
                  className="absolute w-2 h-20 origin-[50%_75%] transition-transform duration-500 bg-gradient-to-t from-slate-300 to-terracotta rounded-full flex items-center justify-center shadow"
                  style={{
                    transform: `rotate(${
                      DIRECTIONS.find((d) => d.label === northDir)?.angle || 0
                    }deg) translateY(-20px)`,
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white absolute top-1"></div>
                </div>
                
                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 shadow-sm z-20">
                  {northDir}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 flex flex-col justify-center">
            <div className="p-4 bg-terracotta/5 border border-terracotta/10 rounded-xl space-y-2">
              <h4 className="text-sm font-semibold text-blueprint font-architectural flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-terracotta" />
                Active Direction Details
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your plot faces <strong className="text-terracotta">{DIRECTIONS.find(d => d.label === northDir)?.desc}</strong>.
                {northDir === 'E' || northDir === 'N' || northDir === 'NE' ? (
                  <span className="text-emerald-700 block mt-1">✓ Vastu considers {northDir} orientation highly auspicious for residential entrance and ventilation.</span>
                ) : (
                  <span className="text-slate-500 block mt-1">Planning layout will offset kitchen and master rooms to adapt to this exposure and meet Vastu principles.</span>
                )}
              </p>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <input
                id="vastu"
                type="checkbox"
                checked={vastu}
                onChange={(e) => setVastu(e.target.checked)}
                className="w-5 h-5 rounded accent-terracotta border-slate-300 cursor-pointer"
              />
              <div>
                <label htmlFor="vastu" className="text-sm font-semibold text-slate-800 cursor-pointer select-none">
                  Enforce Vastu Shastra Rules
                </label>
                <p className="text-xs text-slate-400 mt-0.5">Kitchen in SE, master bedroom in SW, puja/entry zones optimized.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Program and Style (Step 2) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-md p-6 md:p-8 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-2xl font-semibold font-architectural text-blueprint flex items-center gap-2">
            <Hammer className="w-6 h-6 text-terracotta" />
            2. Program Requirements & Style
          </h2>
          <p className="text-slate-500 text-sm mt-1">Specify room configurations, layout style, and construction budget.</p>
        </div>

        {/* Budget and Floors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Target Budget (INR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-slate-500">₹</span>
              <input
                type="number"
                min="1000000"
                max="90000000"
                step="50000"
                value={budget}
                onChange={(e) => setBudget(Math.max(1000000, Number(e.target.value)))}
                className="pl-7 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta bg-slate-50/50 font-medium"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              e.g. ₹{Math.round(budget / 100000) / 10} Lakhs / {(budget / 10000000).toFixed(2)} Crore
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Number of Floors
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFloors(f)}
                  className={`flex-1 py-2 text-sm font-semibold border rounded-lg cursor-pointer transition ${
                    floors === f
                      ? 'bg-blueprint border-blueprint text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {f === 1 ? 'G' : f === 2 ? 'G+1' : 'G+2'} ({f} Floor{f > 1 ? 's' : ''})
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Kitchen Design
            </label>
            <select
              value={kitchenType}
              onChange={(e) => setKitchenType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta bg-slate-50/50"
            >
              <option value="Closed Traditional">Closed Traditional Walled</option>
              <option value="Open American">Open Concept (American)</option>
              <option value="Closed Vastu">Closed Vastu Compliant</option>
            </select>
          </div>
        </div>

        {/* Bedrooms and Bathrooms Counter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Bedrooms (BHK)
              </label>
              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/50 w-32">
                <button
                  type="button"
                  onClick={() => setBedrooms(Math.max(1, bedrooms - 1))}
                  className="px-3 py-1.5 hover:bg-slate-100 cursor-pointer font-bold select-none text-slate-500 rounded-l-lg border-r border-slate-200"
                >
                  -
                </button>
                <div className="flex-1 text-center font-semibold text-sm">{bedrooms}</div>
                <button
                  type="button"
                  onClick={() => setBedrooms(Math.min(6, bedrooms + 1))}
                  className="px-3 py-1.5 hover:bg-slate-100 cursor-pointer font-bold select-none text-slate-500 rounded-r-lg border-l border-slate-200"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Bathrooms
              </label>
              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/50 w-32">
                <button
                  type="button"
                  onClick={() => setBathrooms(Math.max(1, bathrooms - 1))}
                  className="px-3 py-1.5 hover:bg-slate-100 cursor-pointer font-bold select-none text-slate-500 rounded-l-lg border-r border-slate-200"
                >
                  -
                </button>
                <div className="flex-1 text-center font-semibold text-sm">{bathrooms}</div>
                <button
                  type="button"
                  onClick={() => setBathrooms(Math.min(6, bathrooms + 1))}
                  className="px-3 py-1.5 hover:bg-slate-100 cursor-pointer font-bold select-none text-slate-500 rounded-r-lg border-l border-slate-200"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Amenity Toggles */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="block text-sm font-semibold text-slate-700 w-full mb-1">Outdoor Additions</span>
            <label className="flex items-center gap-2 bg-slate-50 px-4 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/50 select-none">
              <input
                type="checkbox"
                checked={parking}
                onChange={(e) => setParking(e.target.checked)}
                className="w-4 h-4 rounded accent-terracotta border-slate-300"
              />
              <span className="text-sm font-semibold text-slate-700">Parking Space</span>
            </label>

            <label className="flex items-center gap-2 bg-slate-50 px-4 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/50 select-none">
              <input
                type="checkbox"
                checked={garden}
                onChange={(e) => setGarden(e.target.checked)}
                className="w-4 h-4 rounded accent-terracotta border-slate-300"
              />
              <span className="text-sm font-semibold text-slate-700">Mini Garden</span>
            </label>

            <label className="flex items-center gap-2 bg-slate-50 px-4 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/50 select-none">
              <input
                type="checkbox"
                checked={balcony}
                onChange={(e) => setBalcony(e.target.checked)}
                className="w-4 h-4 rounded accent-terracotta border-slate-300"
              />
              <span className="text-sm font-semibold text-slate-700">Balconies</span>
            </label>
          </div>
        </div>

        {/* Style selection */}
        <div className="border-t border-slate-100 pt-6 space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Architectural Style Preference</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {STYLES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStyle(item.value)}
                className={`p-4 border rounded-xl flex flex-col text-left space-y-1 transition cursor-pointer select-none ${
                  style === item.value
                    ? 'border-terracotta bg-terracotta/[0.03] ring-1 ring-terracotta'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
                }`}
              >
                <span className={`text-sm font-bold ${style === item.value ? 'text-terracotta' : 'text-slate-800'}`}>
                  {item.label}
                </span>
                <span className="text-[11px] text-slate-500 leading-normal">{item.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-center md:justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full md:w-auto px-8 py-3 bg-terracotta hover:bg-terracotta-hover text-white text-base font-semibold rounded-lg shadow hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Layout & Estimating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Blueprint & 3D Plan
            </>
          )}
        </button>
      </div>
    </form>
  );
}
