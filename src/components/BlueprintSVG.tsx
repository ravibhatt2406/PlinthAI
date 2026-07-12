'use client';

import React, { useState } from 'react';
import { Room, FloorPlan, CompassDirection, Door, Window } from '../lib/types';
import { Sparkles, Wind, Maximize2 } from 'lucide-react';

interface BlueprintSVGProps {
  floorPlan: FloorPlan;
  plotWidth: number;
  plotLength: number;
  northDirection: CompassDirection;
  onRoomSelect?: (room: Room | null) => void;
}

export function calculateVentilationScore(room: Room): { score: number; rating: string; desc: string } {
  const openings = [...room.doors.map(d => ({ ...d, type: 'door' })), ...room.windows.map(w => ({ ...w, type: 'window' }))];
  
  if (room.name.toLowerCase().includes('parking') || room.name.toLowerCase().includes('garden')) {
    return { score: 100, rating: 'Excellent', desc: 'Open-air space with unrestricted airflow.' };
  }
  
  if (openings.length === 0) {
    return { score: 10, rating: 'Poor', desc: 'No active ventilation openings.' };
  }

  const wallsWithOpenings = new Set(openings.map(o => o.wall));
  const windowsCount = room.windows.length;

  // Rule-based ventilation score:
  // - 1 window: 50
  // - 2+ windows on same wall: 60
  // - Openings on adjacent walls (e.g. N and E): 80 (Good cross-airflow)
  // - Openings on opposite walls (e.g. N and S, or E and W): 100 (Optimal cross-ventilation)
  
  let score = 30;
  let desc = 'Minimal airflow';

  if (wallsWithOpenings.size === 1) {
    score = windowsCount > 0 ? 55 : 40;
    desc = windowsCount > 0 
      ? 'Single-sided window ventilation.' 
      : 'Internal doorway airflow only.';
  } else if (wallsWithOpenings.size === 2) {
    const walls = Array.from(wallsWithOpenings);
    const isOpposite = 
      (walls.includes('N') && walls.includes('S')) || 
      (walls.includes('E') && walls.includes('W'));
    
    if (isOpposite) {
      score = 95;
      desc = 'Ideal cross-ventilation. Parallel openings create excellent drafts.';
    } else {
      score = 80;
      desc = 'Good corner ventilation. Adjacent openings support circular airflow.';
    }
  } else if (wallsWithOpenings.size >= 3) {
    score = 100;
    desc = 'Multi-directional ventilation. Exceptional natural breeze circulation.';
  }

  // Adjustments based on window count
  if (windowsCount === 0 && score > 40) {
    score -= 15; // penalize slightly if only door openings (internal)
  }

  let rating = 'Fair';
  if (score >= 90) rating = 'Excellent';
  else if (score >= 75) rating = 'Good';
  else if (score < 40) rating = 'Poor';

  return { score, rating, desc };
}

export default function BlueprintSVG({
  floorPlan,
  plotWidth,
  plotLength,
  northDirection,
  onRoomSelect,
}: BlueprintSVGProps) {
  const [hoveredRoom, setHoveredRoom] = useState<Room | null>(null);

  // Layout parameters for SVG sizing
  const scale = 12; // pixels per foot
  const padding = 4; // feet padding around plot
  const svgWidth = (plotWidth + padding * 2) * scale;
  const svgHeight = (plotLength + padding * 2) * scale;

  // Transform coordinates to SVG space
  const tx = (x: number) => (x + padding) * scale;
  const ty = (y: number) => (y + padding) * scale;
  const ts = (d: number) => d * scale;

  // Setback markers (standard offset from plot boundaries)
  const frontSetback = 5;
  const sideSetback = 3;
  const rearSetback = 3;

  // Draw door swings
  const renderDoorSwing = (room: Room, door: Door) => {
    // Determine door hinges and endpoints based on wall
    const doorSize = 3; // standard door width in feet
    
    let x1 = 0, y1 = 0, pathD = '';

    if (door.wall === 'N') {
      // Top wall, swing inwards
      x1 = room.x + door.offset;
      y1 = room.y;
      // swing arc
      pathD = `M ${tx(x1)} ${ty(y1)} A ${ts(doorSize)} ${ts(doorSize)} 0 0 1 ${tx(x1 + doorSize)} ${ty(y1 + doorSize)}`;
      return (
        <g key={door.id} className="stroke-blueprint/70 fill-none" strokeWidth="1">
          <line x1={tx(x1)} y1={ty(y1)} x2={tx(x1)} y2={ty(y1 + doorSize)} strokeWidth="2" />
          <path d={pathD} strokeDasharray="2,2" />
        </g>
      );
    }
    if (door.wall === 'S') {
      // Bottom wall, swing inwards (upwards)
      x1 = room.x + door.offset;
      y1 = room.y + room.height;
      pathD = `M ${tx(x1)} ${ty(y1)} A ${ts(doorSize)} ${ts(doorSize)} 0 0 0 ${tx(x1 + doorSize)} ${ty(y1 - doorSize)}`;
      return (
        <g key={door.id} className="stroke-blueprint/70 fill-none" strokeWidth="1">
          <line x1={tx(x1)} y1={ty(y1)} x2={tx(x1)} y2={ty(y1 - doorSize)} strokeWidth="2" />
          <path d={pathD} strokeDasharray="2,2" />
        </g>
      );
    }
    if (door.wall === 'W') {
      // Left wall, swing inwards
      x1 = room.x;
      y1 = room.y + door.offset;
      pathD = `M ${tx(x1)} ${ty(y1)} A ${ts(doorSize)} ${ts(doorSize)} 0 0 1 ${tx(x1 + doorSize)} ${ty(y1 + doorSize)}`;
      return (
        <g key={door.id} className="stroke-blueprint/70 fill-none" strokeWidth="1">
          <line x1={tx(x1)} y1={ty(y1)} x2={tx(x1 + doorSize)} y2={ty(y1)} strokeWidth="2" />
          <path d={pathD} strokeDasharray="2,2" />
        </g>
      );
    }
    if (door.wall === 'E') {
      // Right wall, swing inwards
      x1 = room.x + room.width;
      y1 = room.y + door.offset;
      pathD = `M ${tx(x1)} ${ty(y1)} A ${ts(doorSize)} ${ts(doorSize)} 0 0 0 ${tx(x1 - doorSize)} ${ty(y1 + doorSize)}`;
      return (
        <g key={door.id} className="stroke-blueprint/70 fill-none" strokeWidth="1">
          <line x1={tx(x1)} y1={ty(y1)} x2={tx(x1 - doorSize)} y2={ty(y1)} strokeWidth="2" />
          <path d={pathD} strokeDasharray="2,2" />
        </g>
      );
    }
    return null;
  };

  // Draw window symbols
  const renderWindowSymbol = (room: Room, win: Window) => {
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    const buffer = 0.2; // wall inset

    if (win.wall === 'N') {
      x1 = room.x + win.offset;
      y1 = room.y;
      x2 = x1 + win.width;
      y2 = y1;
    } else if (win.wall === 'S') {
      x1 = room.x + win.offset;
      y1 = room.y + room.height;
      x2 = x1 + win.width;
      y2 = y1;
    } else if (win.wall === 'W') {
      x1 = room.x;
      y1 = room.y + win.offset;
      x2 = x1;
      y2 = y1 + win.width;
    } else if (win.wall === 'E') {
      x1 = room.x + room.width;
      y1 = room.y + win.offset;
      x2 = x1;
      y2 = y1 + win.width;
    }

    return (
      <g key={win.id} className="stroke-cyan-500 fill-cyan-100" strokeWidth="1.5">
        <rect
          x={tx(x1 - (win.wall === 'W' || win.wall === 'E' ? buffer : 0))}
          y={ty(y1 - (win.wall === 'N' || win.wall === 'S' ? buffer : 0))}
          width={ts(win.wall === 'N' || win.wall === 'S' ? win.width : buffer * 2)}
          height={ts(win.wall === 'W' || win.wall === 'E' ? win.width : buffer * 2)}
          strokeWidth="1"
        />
        {/* Lintel indicator */}
        <line
          x1={tx(x1)}
          y1={ty(y1)}
          x2={tx(x2)}
          y2={ty(y2)}
          stroke="rgba(6, 182, 212, 0.8)"
          strokeWidth="1"
        />
      </g>
    );
  };

  // Compass needle rotation based on North orientation
  const angleMap: Record<CompassDirection, number> = {
    N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315
  };
  const northAngle = angleMap[northDirection] || 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* SVG Canvas */}
      <div className="bg-[#FAF7F0] border-2 border-slate-300 rounded-xl p-4 shadow-md overflow-auto blueprint-grid flex-1 max-w-full">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="mx-auto"
        >
          {/* Grid pattern back drop */}
          <defs>
            <pattern id="smallGrid" width={scale} height={scale} patternUnits="userSpaceOnUse">
              <path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="rgba(30, 41, 59, 0.03)" strokeWidth="0.5" />
            </pattern>
            <pattern id="grid" width={scale * 5} height={scale * 5} patternUnits="userSpaceOnUse">
              <rect width={scale * 5} height={scale * 5} fill="url(#smallGrid)" />
              <path d={`M ${scale * 5} 0 L 0 0 0 ${scale * 5}`} fill="none" stroke="rgba(30, 41, 59, 0.08)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Plot Boundary */}
          <rect
            x={tx(0)}
            y={ty(0)}
            width={ts(plotWidth)}
            height={ts(plotLength)}
            fill="none"
            stroke="#1E293B"
            strokeWidth="2.5"
            strokeDasharray="8,4"
          />
          <text x={tx(plotWidth / 2)} y={ty(-0.6)} textAnchor="middle" className="fill-slate-500 font-semibold text-xs tracking-wider">
            PLOT WIDTH: {plotWidth} FT
          </text>
          <text
            x={tx(-0.8)}
            y={ty(plotLength / 2)}
            textAnchor="middle"
            transform={`rotate(-90, ${tx(-0.8)}, ${ty(plotLength / 2)})`}
            className="fill-slate-500 font-semibold text-xs tracking-wider"
          >
            PLOT DEPTH: {plotLength} FT
          </text>

          {/* Setback Dotted Envelope */}
          <rect
            x={tx(sideSetback)}
            y={ty(rearSetback)}
            width={ts(plotWidth - sideSetback * 2)}
            height={ts(plotLength - frontSetback - rearSetback)}
            fill="rgba(30, 41, 59, 0.01)"
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeDasharray="4,4"
          />
          {/* Setback Labels */}
          <text x={tx(plotWidth / 2)} y={ty(rearSetback + 1.2)} textAnchor="middle" className="fill-slate-400 text-[10px] italic">
            Rear Setback: {rearSetback} ft
          </text>
          <text x={tx(plotWidth / 2)} y={ty(plotLength - frontSetback - 0.6)} textAnchor="middle" className="fill-slate-400 text-[10px] italic">
            Front Setback: {frontSetback} ft
          </text>
          <text
            x={tx(sideSetback + 1.2)}
            y={ty(plotLength / 2)}
            textAnchor="middle"
            transform={`rotate(-90, ${tx(sideSetback + 1.2)}, ${ty(plotLength / 2)})`}
            className="fill-slate-400 text-[10px] italic"
          >
            Side: {sideSetback} ft
          </text>

          {/* Draw Rooms */}
          {floorPlan.rooms.map((room) => {
            const isHovered = hoveredRoom?.id === room.id;
            const isUnbuiltOutdoor = room.name.toLowerCase().includes('garden') || room.name.toLowerCase().includes('parking');
            return (
              <g
                key={room.id}
                onMouseEnter={() => {
                  setHoveredRoom(room);
                  if (onRoomSelect) onRoomSelect(room);
                }}
                onMouseLeave={() => {
                  setHoveredRoom(null);
                  if (onRoomSelect) onRoomSelect(null);
                }}
                onClick={() => {
                  if (onRoomSelect) onRoomSelect(room);
                }}
                className="cursor-pointer group"
              >
                <rect
                  x={tx(room.x)}
                  y={ty(room.y)}
                  width={ts(room.width)}
                  height={ts(room.height)}
                  fill={isHovered ? 'rgba(194, 65, 12, 0.05)' : isUnbuiltOutdoor ? 'rgba(30, 41, 59, 0.02)' : '#FFFFFF'}
                  stroke={isHovered ? '#C2410C' : '#0F1D36'}
                  strokeWidth={isHovered ? '2' : '1.5'}
                  className="transition-colors duration-150"
                />

                {/* Draw Hatch for Open Areas */}
                {isUnbuiltOutdoor && (
                  <rect
                    x={tx(room.x)}
                    y={ty(room.y)}
                    width={ts(room.width)}
                    height={ts(room.height)}
                    fill={room.name.toLowerCase().includes('garden') ? 'rgba(16, 185, 129, 0.05)' : 'rgba(100, 116, 139, 0.05)'}
                    className="pointer-events-none"
                  />
                )}

                {/* Room Name & Dimensions */}
                <text
                  x={tx(room.x + room.width / 2)}
                  y={ty(room.y + room.height / 2 - 0.5)}
                  textAnchor="middle"
                  className={`font-semibold text-xs ${isHovered ? 'fill-terracotta' : 'fill-slate-800'}`}
                >
                  {room.name}
                </text>
                <text
                  x={tx(room.x + room.width / 2)}
                  y={ty(room.y + room.height / 2 + 1.0)}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px]"
                >
                  {Math.round(room.width)}&apos; &times; {Math.round(room.height)}&apos;
                </text>

                {/* Openings (Doors / Windows) */}
                {room.doors.map((door) => renderDoorSwing(room, door))}
                {room.windows.map((win) => renderWindowSymbol(room, win))}
              </g>
            );
          })}

          {/* Compass Rose */}
          <g transform={`translate(${svgWidth - 65}, 65)`}>
            <circle cx="0" cy="0" r="28" fill="white" stroke="#1E293B" strokeWidth="1" />
            <circle cx="0" cy="0" r="25" fill="none" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2,2" />
            {/* Cardinal points */}
            <text x="0" y="-32" textAnchor="middle" className="text-[10px] font-black fill-slate-700">N</text>
            <text x="32" y="3.5" textAnchor="middle" className="text-[10px] font-bold fill-slate-400">E</text>
            <text x="0" y="38" textAnchor="middle" className="text-[10px] font-bold fill-slate-400">S</text>
            <text x="-32" y="3.5" textAnchor="middle" className="text-[10px] font-bold fill-slate-400">W</text>
            
            {/* Rotating Arrow needle */}
            <g transform={`rotate(${northAngle})`}>
              <polygon points="0,-22 5,-2 0,0" fill="#C2410C" stroke="#C2410C" />
              <polygon points="0,-22 -5,-2 0,0" fill="#E05A1F" stroke="#C2410C" />
              <polygon points="0,22 5,-2 0,0" fill="#1E293B" stroke="#1E293B" />
              <polygon points="0,22 -5,-2 0,0" fill="#334155" stroke="#1E293B" />
            </g>
          </g>
        </svg>
      </div>

      {/* Selected Room Metadata Panel */}
      <div className="w-full lg:w-[280px] bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-lg font-bold font-architectural text-blueprint border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-terracotta" />
          Technical Details
        </h3>
        {hoveredRoom ? (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Room Name</span>
              <h4 className="text-base font-bold text-slate-800">{hoveredRoom.name}</h4>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Dimensions</span>
                <p className="text-sm font-medium text-slate-700">
                  {hoveredRoom.width} &times; {hoveredRoom.height} ft
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Built Area</span>
                <p className="text-sm font-medium text-slate-700">
                  {Math.round(hoveredRoom.width * hoveredRoom.height)} sq.ft.
                </p>
              </div>
            </div>

            {/* Ventilation Score block */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Wind className="w-3 h-3 text-cyan-600 animate-pulse-soft" />
                  Airflow Score
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  calculateVentilationScore(hoveredRoom).score >= 80 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                    : calculateVentilationScore(hoveredRoom).score >= 50
                      ? 'bg-amber-50 text-amber-700 border border-amber-100'
                      : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {calculateVentilationScore(hoveredRoom).score}% ({calculateVentilationScore(hoveredRoom).rating})
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                {calculateVentilationScore(hoveredRoom).desc}
              </p>
            </div>

            {/* Openings listing */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Structural Elements</span>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Doors: {hoveredRoom.doors.length} internal</li>
                <li>• Windows: {hoveredRoom.windows.length} external ({hoveredRoom.windows.map(w => `${w.width}ft ${w.wall}`).join(', ') || 'None'})</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="h-44 flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
            <Maximize2 className="w-8 h-8 stroke-1 text-slate-300" />
            <p className="text-xs">Hover or click a room on the CAD canvas to inspect physical attributes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
