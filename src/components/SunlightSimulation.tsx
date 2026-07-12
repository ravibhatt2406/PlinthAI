'use client';

import React, { useState, useEffect } from 'react';
import { PlotInput, FloorPlan } from '../lib/types';
import { Sun, CloudSun, Thermometer, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';

interface SunMetricsData {
  sunTimes?: {
    sunrise: string;
    sunset: string;
  } | null;
  weather?: {
    sunrise?: string[];
    sunset?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    uv_index_max?: number[];
  } | null;
}

interface SunlightSimulationProps {
  plotInput: PlotInput;
  floorPlan: FloorPlan;
}

export default function SunlightSimulation({ plotInput, floorPlan }: SunlightSimulationProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SunMetricsData | null>(null);
  const [evaluation, setEvaluation] = useState<string>('');
  const [evalLoading, setEvalLoading] = useState(false);

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      try {
        const res = await fetch(`/api/sun-weather?lat=${plotInput.lat}&lng=${plotInput.lng}`);
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
          
          // Trigger Gemini evaluation once we have metrics
          fetchEvaluation(data);
        }
      } catch (err) {
        console.error('Failed to load sun metrics:', err);
      } finally {
        setLoading(false);
      }
    }

    async function fetchEvaluation(sunData: SunMetricsData) {
      setEvalLoading(true);
      try {
        const sunMetricsObj = {
          sunrise: sunData?.sunTimes?.sunrise || sunData?.weather?.sunrise?.[0] || '6:15 AM',
          sunset: sunData?.sunTimes?.sunset || sunData?.weather?.sunset?.[0] || '6:45 PM',
          uvIndex: sunData?.weather?.uv_index_max?.[0] || 8.5,
          maxTemp: sunData?.weather?.temperature_2m_max?.[0] || 33.2,
          minTemp: sunData?.weather?.temperature_2m_min?.[0] || 24.1,
        };

        const res = await fetch('/api/evaluate-sunlight', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            plotInput,
            rooms: floorPlan.rooms,
            sunMetrics: sunMetricsObj,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setEvaluation(data.evaluation);
        }
      } catch (err) {
        console.error('Failed to load sunlight evaluation:', err);
      } finally {
        setEvalLoading(false);
      }
    }

    fetchMetrics();
  }, [plotInput, floorPlan]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-terracotta" />
          <span className="text-sm font-semibold text-slate-500">Querying OpenStreetMap and Meteorological Nodes...</span>
        </div>
      </div>
    );
  }

  // Format sunrise/sunset cleanly
  const getDisplayTime = (isoString: string | null | undefined, fallback: string) => {
    if (!isoString) return fallback;
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString; // It might be pre-formatted
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return fallback;
    }
  };

  const sunrise = getDisplayTime(metrics?.sunTimes?.sunrise || metrics?.weather?.sunrise?.[0], '05:48 AM');
  const sunset = getDisplayTime(metrics?.sunTimes?.sunset || metrics?.weather?.sunset?.[0], '06:54 PM');
  const maxTemp = metrics?.weather?.temperature_2m_max?.[0] || 34.5;
  const minTemp = metrics?.weather?.temperature_2m_min?.[0] || 22.8;
  const uvIndex = metrics?.weather?.uv_index_max?.[0] || 9.2;

  // Render UV Index Warning level
  const getUVBadge = (uv: number) => {
    if (uv >= 8) return { label: 'Very High', color: 'bg-red-50 text-red-700 border-red-100' };
    if (uv >= 6) return { label: 'High', color: 'bg-orange-50 text-orange-700 border-orange-100' };
    if (uv >= 3) return { label: 'Moderate', color: 'bg-amber-50 text-amber-700 border-amber-100' };
    return { label: 'Low', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  };
  const uvBadge = getUVBadge(uvIndex);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Metrics Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 md:col-span-1">
        <h3 className="text-lg font-bold font-architectural text-blueprint border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <CloudSun className="w-5 h-5 text-terracotta" />
          Climatic Parameters
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Sun className="w-4 h-4 text-amber-500" /> Sunrise
            </span>
            <span className="text-sm font-bold text-slate-800">{sunrise}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-50 pb-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Sun className="w-4 h-4 text-slate-400" /> Sunset
            </span>
            <span className="text-sm font-bold text-slate-800">{sunset}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-50 pb-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Thermometer className="w-4 h-4 text-rose-500" /> Temperatures
            </span>
            <span className="text-sm font-bold text-slate-800">{minTemp}°C - {maxTemp}°C</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Max UV Index
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 border rounded ${uvBadge.color}`}>
              {uvIndex} ({uvBadge.label})
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg text-[10px] text-slate-400 leading-normal">
          Astronomic data fetched for lat/lng: <strong className="text-slate-600">{plotInput.lat.toFixed(4)}, {plotInput.lng.toFixed(4)}</strong> via Sunrise-Sunset API and Open-Meteo models.
        </div>
      </div>

      {/* Gemini Analysis Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 md:col-span-2">
        <h3 className="text-lg font-bold font-architectural text-blueprint border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <Sparkles className="w-5 h-5 text-terracotta" />
          Solar Adjacency Evaluation
        </h3>

        {evalLoading ? (
          <div className="h-44 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-terracotta" />
            <span className="text-xs text-slate-400">Gemini analyzing compass paths and shading matrices...</span>
          </div>
        ) : (
          <div className="prose prose-slate max-w-none text-sm text-slate-600 leading-relaxed whitespace-pre-line">
            {evaluation || 'No sunlight analysis loaded.'}
          </div>
        )}
      </div>
    </div>
  );
}
