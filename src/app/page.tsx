'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { PlotInput, Plot, FloorPlan } from '../lib/types';
import { generateProceduralLayout } from '../lib/layoutEngine';
import { refineFloorPlan } from '../lib/geminiRefiner';
import { calculateConstructionCost, generateBudgetOptimizations, CostSummary } from '../lib/costEstimator';
import { db } from '../lib/db';

import PlotInputForm from '../components/PlotInputForm';
import BlueprintSVG from '../components/BlueprintSVG';
import SunlightSimulation from '../components/SunlightSimulation';
import ConstructionAdvisor from '../components/ConstructionAdvisor';

import {
  FileText,
  DollarSign,
  TrendingDown,
  Bot,
  Hammer,
  RotateCcw,
  Sparkles
} from 'lucide-react';

// Dynamic imports to prevent SSR execution errors
const HouseViewer3D = dynamic(() => import('../components/HouseViewer3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center">
      <div className="flex flex-col items-center space-y-2">
        <div className="w-8 h-8 border-4 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-slate-400 font-medium">Initializing WebGL rendering context...</span>
      </div>
    </div>
  )
});

type TabType = 'reasoning' | 'sunlight' | 'cost' | 'budget' | 'chat';
type View3DType = '2d' | '3d';

export default function Home() {
  const [plot, setPlot] = useState<Plot | null>(null);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [materialsPreset, setMaterialsPreset] = useState<'premium' | 'standard'>('premium');
  
  // Interaction states
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('reasoning');
  const [viewMode, setViewMode] = useState<View3DType>('2d');
  const [timeOfDay, setTimeOfDay] = useState<number>(10); // default 10:00 AM
  const [activeFloorIndex, setActiveFloorIndex] = useState<number>(0);

  // Core generation logic triggered by the plot form
  const handleGenerateDesign = async (input: PlotInput) => {
    setLoading(true);
    try {
      // 1. Generate local rule-based setbacks and spatial partition
      const basePlans = generateProceduralLayout(input);

      // 2. Call Gemini refinement to add door/window placements, validate rules
      const refinedPlans = await refineFloorPlan(input, basePlans);

      // 3. Save plot to Database (falls back to local storage)
      const savedPlot = await db.savePlot(input);
      setPlot(savedPlot);

      // 4. Save floor plans to Database
      const savedPlans = await db.saveFloorPlans(
        refinedPlans.map(fp => ({ ...fp, plot_id: savedPlot.id }))
      );
      setFloorPlans(savedPlans);

      // 5. Calculate construction cost based on geometric volume and CPWD rates
      const summary = calculateConstructionCost(input, savedPlans, materialsPreset);
      await db.saveCostEstimates(savedPlot.id, summary.items);
      setCostSummary(summary);

    } catch (err) {
      console.error('Failed to generate building plan:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-runs calculations and updates DB when budget optimization recommendations are clicked
  const handleApplyRecommendation = async (suggestedChanges: Partial<PlotInput> & { materialsPreset?: 'premium' | 'standard' }) => {
    if (!plot) return;
    setLoading(true);
    try {
      const nextMaterialsPreset = suggestedChanges.materialsPreset !== undefined 
        ? suggestedChanges.materialsPreset 
        : materialsPreset;
      
      if (suggestedChanges.materialsPreset !== undefined) {
        setMaterialsPreset(suggestedChanges.materialsPreset);
      }

      // Merge new parameters
      const updatedInput: PlotInput = {
        address: suggestedChanges.address ?? plot.address,
        lat: suggestedChanges.lat ?? plot.lat,
        lng: suggestedChanges.lng ?? plot.lng,
        length_ft: suggestedChanges.length_ft ?? plot.length_ft,
        width_ft: suggestedChanges.width_ft ?? plot.width_ft,
        north_direction: suggestedChanges.north_direction ?? plot.north_direction,
        floors: suggestedChanges.floors ?? plot.floors,
        budget_inr: suggestedChanges.budget_inr ?? plot.budget_inr,
        bedrooms: suggestedChanges.bedrooms ?? plot.bedrooms,
        bathrooms: suggestedChanges.bathrooms ?? plot.bathrooms,
        kitchen_type: suggestedChanges.kitchen_type ?? plot.kitchen_type,
        parking: suggestedChanges.parking ?? plot.parking,
        garden: suggestedChanges.garden ?? plot.garden,
        balcony: suggestedChanges.balcony ?? plot.balcony,
        style: suggestedChanges.style ?? plot.style,
        vastu_preference: suggestedChanges.vastu_preference ?? plot.vastu_preference,
      };

      const basePlans = generateProceduralLayout(updatedInput);
      const refinedPlans = await refineFloorPlan(updatedInput, basePlans);
      
      const savedPlot = await db.savePlot(updatedInput);
      setPlot(savedPlot);

      const savedPlans = await db.saveFloorPlans(
        refinedPlans.map(fp => ({ ...fp, plot_id: savedPlot.id }))
      );
      setFloorPlans(savedPlans);

      const summary = calculateConstructionCost(updatedInput, savedPlans, nextMaterialsPreset);
      await db.saveCostEstimates(savedPlot.id, summary.items);
      setCostSummary(summary);
      
      setActiveTab('cost'); // redirect to cost tab to inspect changes
    } catch (err) {
      console.error('Failed to apply optimization changes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPlot(null);
    setFloorPlans([]);
    setCostSummary(null);
    setMaterialsPreset('premium');
  };

  return (
    <div className="flex-1 w-full min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col space-y-8">
      {/* Editorial Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-blueprint font-architectural flex items-center gap-3">
            <Hammer className="w-9 h-9 text-terracotta" />
            PLINTH
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium tracking-wide">
            From Empty Plot to Buildable Plan — <span className="text-slate-800 font-semibold italic">Reasoned, Not Guessed.</span>
          </p>
        </div>

        {plot && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:border-slate-400 bg-white rounded-lg text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-terracotta" /> Reset Parameters
          </button>
        )}
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col">
        {!plot ? (
          /* Step 1: Input Parameters Stage */
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-3 py-6">
              <span className="px-3 py-1 bg-terracotta/10 text-terracotta text-xs font-bold rounded-full border border-terracotta/20 tracking-widest uppercase">AI Architect Workshop</span>
              <h2 className="text-3xl font-bold font-architectural text-blueprint">Configure Your Custom Residence</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Provide the dimensions, solar facing coordinates, and BHK program for your parcel of land. 
                Our layout engine computes physical setbacks and places load-bearing structures.
              </p>
            </div>
            <PlotInputForm onSubmit={handleGenerateDesign} isLoading={loading} />
          </div>
        ) : (
          /* Step 2: Generated Results Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Visual CAD / 3D Canvas Column (Left Side, 2 Columns wide in desktop) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Plot Header Info strip */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded">
                    Plot: {plot.width_ft}x{plot.length_ft} ft ({plot.width_ft * plot.length_ft} sqft)
                  </span>
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded">
                    Facing: {plot.north_direction} (North)
                  </span>
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded">
                    BHK: {plot.bedrooms} Bed, {plot.bathrooms} Bath
                  </span>
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded capitalize">
                    Style: {plot.style}
                  </span>
                  <span className={`px-2.5 py-1 rounded ${plot.vastu_preference ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100'}`}>
                    Vastu: {plot.vastu_preference ? 'Enforced' : 'Off'}
                  </span>
                </div>
                
                {/* SVG vs 3D controls */}
                <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex gap-0.5">
                  <button
                    onClick={() => setViewMode('2d')}
                    className={`px-3 py-1 text-xs font-bold rounded-md cursor-pointer transition ${
                      viewMode === '2d' ? 'bg-white shadow-sm text-blueprint' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    2D Blueprint
                  </button>
                  <button
                    onClick={() => setViewMode('3d')}
                    className={`px-3 py-1 text-xs font-bold rounded-md cursor-pointer transition ${
                      viewMode === '3d' ? 'bg-white shadow-sm text-blueprint' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Interactive 3D
                  </button>
                </div>
              </div>

              {/* Main Visual Frame (SVG / 3D Canvas) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md min-h-[500px] flex flex-col justify-between">
                
                {/* Floor select header (for 2D view multi-floors) */}
                {viewMode === '2d' && floorPlans.length > 1 && (
                  <div className="flex gap-2 border-b border-slate-100 pb-4 mb-4">
                    {floorPlans.map((fp, idx) => (
                      <button
                        key={fp.id}
                        onClick={() => { setActiveFloorIndex(idx); }}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition ${
                          activeFloorIndex === idx
                            ? 'bg-blueprint border-blueprint text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {idx === 0 ? 'Ground Floor (G)' : `First Floor (G+${idx})`}
                      </button>
                    ))}
                  </div>
                )}

                {/* Render Selected View Mode */}
                <div className="flex-1 flex items-center justify-center">
                  {viewMode === '2d' ? (
                    <BlueprintSVG
                      floorPlan={floorPlans[activeFloorIndex] || floorPlans[0]}
                      plotWidth={plot.width_ft}
                      plotLength={plot.length_ft}
                      northDirection={plot.north_direction}
                    />
                  ) : (
                    <HouseViewer3D
                      floorPlans={floorPlans}
                      plotWidth={plot.width_ft}
                      plotLength={plot.length_ft}
                      northDirection={plot.north_direction}
                      stylePreference={plot.style}
                      latitude={plot.lat}
                      longitude={plot.lng}
                      timeOfDay={timeOfDay}
                      onTimeChange={setTimeOfDay}
                    />
                  )}
                </div>
              </div>

              {/* Sunlight climatics dashboard summary panel under the canvas */}
              {floorPlans[0] && (
                <SunlightSimulation plotInput={plot} floorPlan={floorPlans[activeFloorIndex] || floorPlans[0]} />
              )}
            </div>

            {/* Interrogative Data Tabs Column (Right Side, 1 Column wide) */}
            <div className="space-y-6">
              
              {/* Tab selector bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-1 shadow-sm flex gap-1 justify-between overflow-x-auto">
                <button
                  onClick={() => setActiveTab('reasoning')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg border border-transparent transition cursor-pointer flex flex-col items-center gap-1 ${
                    activeTab === 'reasoning' ? 'bg-blueprint/5 text-blueprint border-blueprint/10' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-4 h-4 text-terracotta" /> Blueprint Notes
                </button>
                
                <button
                  onClick={() => setActiveTab('cost')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg border border-transparent transition cursor-pointer flex flex-col items-center gap-1 ${
                    activeTab === 'cost' ? 'bg-blueprint/5 text-blueprint border-blueprint/10' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className="w-4 h-4 text-terracotta" /> Cost Estimate
                </button>

                <button
                  onClick={() => setActiveTab('budget')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg border border-transparent transition cursor-pointer flex flex-col items-center gap-1 ${
                    activeTab === 'budget' ? 'bg-blueprint/5 text-blueprint border-blueprint/10' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <TrendingDown className="w-4 h-4 text-terracotta" /> Optimizations
                </button>

                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg border border-transparent transition cursor-pointer flex flex-col items-center gap-1 ${
                    activeTab === 'chat' ? 'bg-blueprint/5 text-blueprint border-blueprint/10' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Bot className="w-4 h-4 text-terracotta animate-pulse-soft" /> AI Advisor
                </button>
              </div>

              {/* Tab Contents Frame */}
              <div className="min-h-[460px]">
                
                {/* TAB A: Reasoning & Room checklist */}
                {activeTab === 'reasoning' && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <h3 className="text-lg font-bold font-architectural text-blueprint border-b border-slate-100 pb-2 flex items-center gap-1.5">
                      <Sparkles className="w-4.5 h-4.5 text-terracotta" />
                      Design Logic & Vastu Flow
                    </h3>
                    
                    <div className="space-y-4">
                      {floorPlans.map((fp) => (
                        <div key={fp.id} className="space-y-2">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            Floor {fp.floor_number === 1 ? 'G (Ground)' : `G+${fp.floor_number - 1}`} Reasoning
                          </h4>
                          <p className="text-sm text-slate-600 leading-relaxed italic bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                            &ldquo;{fp.reasoning_notes || 'Layout configured dynamically.'}&rdquo;
                          </p>
                        </div>
                      ))}

                      {/* Technical specifications */}
                      <div className="border-t border-slate-100 pt-4 space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          Setbacks Envelope
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                          <div className="bg-slate-50 p-2 border border-slate-100 rounded">
                            <span>Front Setback:</span> <strong className="text-slate-800 font-semibold float-right">5.0 ft</strong>
                          </div>
                          <div className="bg-slate-50 p-2 border border-slate-100 rounded">
                            <span>Sides Margin:</span> <strong className="text-slate-800 font-semibold float-right">3.0 ft</strong>
                          </div>
                          <div className="bg-slate-50 p-2 border border-slate-100 rounded col-span-2">
                            <span>Rear Setback:</span> <strong className="text-slate-800 font-semibold float-right">3.0 ft</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB B: Cost Estimate Table */}
                {activeTab === 'cost' && costSummary && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <h3 className="text-lg font-bold font-architectural text-blueprint border-b border-slate-100 pb-2 flex items-center gap-1.5">
                      <DollarSign className="w-4.5 h-4.5 text-terracotta" />
                      CPWD Rate Assessment
                    </h3>

                    {/* Budget Gauge */}
                    <div className="p-4 rounded-xl border border-slate-100 space-y-2 bg-slate-50">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                        <span>Total Construction Cost</span>
                        <span className={`text-sm font-bold ${costSummary.grandTotal > plot.budget_inr ? 'text-red-600' : 'text-emerald-700'}`}>
                          ₹{costSummary.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            costSummary.grandTotal > plot.budget_inr ? 'bg-red-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${Math.min(100, (costSummary.grandTotal / plot.budget_inr) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Budget Cap: ₹{plot.budget_inr.toLocaleString('en-IN')}</span>
                        <span className="font-semibold text-slate-500">₹{Math.round(costSummary.costPerSqft)}/sqft</span>
                      </div>
                      {costSummary.grandTotal > plot.budget_inr && (
                        <div className="text-[10px] font-semibold text-red-600 mt-2 flex items-center gap-1 bg-red-50 p-2 rounded border border-red-100">
                          ⚠️ Budget exceeded by ₹{(costSummary.grandTotal - plot.budget_inr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}. Check the Optimization tab!
                        </div>
                      )}
                    </div>

                    {/* Detailed item list */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Quantity Takeoffs</h4>
                      <div className="max-h-[220px] overflow-y-auto border border-slate-100 rounded-lg">
                        <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold sticky top-0">
                            <tr>
                              <th className="px-3 py-2">Line Item</th>
                              <th className="px-3 py-2 text-right">Quantity</th>
                              <th className="px-3 py-2 text-right">Cost (INR)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                            {costSummary.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-medium" title={item.source}>
                                  {item.line_item}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-500">
                                  {item.quantity} {item.unit}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-800">
                                  ₹{item.total_cost_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="text-[9px] text-slate-400 italic">
                        * All rates computed against CPWD Delhi Schedule of Rates (DSR) 2025-2026. Hover titles to view citations.
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB C: Budget Optimizer recommendations */}
                {activeTab === 'budget' && costSummary && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <h3 className="text-lg font-bold font-architectural text-blueprint border-b border-slate-100 pb-2 flex items-center gap-1.5">
                      <TrendingDown className="w-4.5 h-4.5 text-terracotta" />
                      Budget Trade-Offs
                    </h3>

                    {costSummary.grandTotal <= plot.budget_inr ? (
                      <div className="h-44 flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                        <Sparkles className="w-8 h-8 text-emerald-500 animate-bounce" />
                        <h4 className="font-bold text-slate-700">Project Within Budget</h4>
                        <p className="text-xs">Your plan total is under the budget cap. No optimizations needed!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <span className="block text-xs font-black text-slate-400 uppercase tracking-widest">Recalculated Savings Options</span>
                        
                        <div className="space-y-3">
                          {generateBudgetOptimizations(plot, costSummary, floorPlans).map((opt) => (
                            <div key={opt.id} className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50 hover:border-terracotta/30 hover:bg-white transition">
                              <div>
                                <h4 className="text-sm font-bold text-slate-800">{opt.title}</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{opt.description}</p>
                              </div>
                              
                              <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-xs">
                                <div>
                                  <span className="text-slate-400">Potential Savings: </span>
                                  <strong className="text-emerald-700 font-bold">
                                    ₹{opt.savingsInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                  </strong>
                                </div>
                                <button
                                  onClick={() => handleApplyRecommendation(opt.suggestedInput)}
                                  className="px-3 py-1 bg-terracotta hover:bg-terracotta-hover text-white text-[10px] font-bold rounded-lg transition cursor-pointer select-none"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB D: Grounded Advisor Chat */}
                {activeTab === 'chat' && costSummary && (
                  <ConstructionAdvisor plot={plot} floorPlans={floorPlans} costSummary={costSummary} />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
