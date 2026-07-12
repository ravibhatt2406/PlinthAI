'use client';

import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as SunCalc from 'suncalc';
import { Room, FloorPlan, CompassDirection, StyleType } from '../lib/types';
import { Sun, Moon, Info, Eye, Layers } from 'lucide-react';

interface HouseViewer3DProps {
  floorPlans: FloorPlan[];
  plotWidth: number;
  plotLength: number;
  northDirection: CompassDirection;
  stylePreference: StyleType;
  latitude: number;
  longitude: number;
  timeOfDay: number; // 6 to 18 representing hours
  onTimeChange?: (time: number) => void;
}

// Subcomponent to render the sun indicator sphere in 3D space
function SunSphere({ position, intensity }: { position: [number, number, number]; intensity: number }) {
  if (intensity <= 0) return null;
  return (
    <mesh position={position}>
      <sphereGeometry args={[1.5, 16, 16]} />
      <meshBasicMaterial color="#FDB813" />
    </mesh>
  );
}

export default function HouseViewer3D({
  floorPlans,
  plotWidth,
  plotLength,
  northDirection,
  stylePreference,
  latitude,
  longitude,
  timeOfDay,
  onTimeChange,
}: HouseViewer3DProps) {
  const [selectedStyle, setSelectedStyle] = useState<StyleType>(stylePreference);
  const [prevStylePreference, setPrevStylePreference] = useState<StyleType>(stylePreference);

  if (stylePreference !== prevStylePreference) {
    setPrevStylePreference(stylePreference);
    setSelectedStyle(stylePreference);
  }

  const [showRoof, setShowRoof] = useState(false);
  const [activeFloor, setActiveFloor] = useState<number | 'all'>('all');
  const [forceSun, setForceSun] = useState(true); // Default to true for bright daylight on load

  // Safeguards to prevent NaN in suncalc calculations
  const lat = latitude !== undefined && !isNaN(latitude) ? latitude : 28.6139;
  const lng = longitude !== undefined && !isNaN(longitude) ? longitude : 77.2090;

  // Removed useEffect for selectedStyle since it is now synchronized during render phase

  // Center offsets
  const offsetX = plotWidth / 2;
  const offsetZ = plotLength / 2;

  // Materials & Colors based on selected style
  const getStyleTheme = (style: StyleType) => {
    switch (style) {
      case 'traditional':
        return {
          wallColor: '#C2410C', // Red brick tone
          wallRoughness: 0.9,
          slabColor: '#78716C', // Stone grey
          floorColor: '#B45309', // Warm wood
          glassColor: '#E0F2FE',
          roofColor: '#7C2D12', // Terracotta sloped look
        };
      case 'minimal':
        return {
          wallColor: '#F8FAFC', // White stucco
          wallRoughness: 0.7,
          slabColor: '#E2E8F0',
          floorColor: '#E2E8F0', // Pale grey screed
          glassColor: '#E0F7FA',
          roofColor: '#F1F5F9',
        };
      case 'luxury':
        return {
          wallColor: '#E2E8F0', // Marble off-white
          wallRoughness: 0.3,
          slabColor: '#F1F5F9',
          floorColor: '#F8FAFC', // White tiles
          glassColor: '#22D3EE', // Turquoise tinted glass
          roofColor: '#334155',
        };
      case 'modern':
      default:
        return {
          wallColor: '#475569', // Modern slate grey
          wallRoughness: 0.5,
          slabColor: '#1E293B',
          floorColor: '#D97706', // Oak floorboards
          glassColor: '#38BDF8', // Cyan glass
          roofColor: '#0F172A',
        };
    }
  };

  const theme = getStyleTheme(selectedStyle);

  // Helper to create a Date object representing the local solar time at the plot coordinates
  const getUtcDateForLocalTime = (hour: number, longitudeVal: number): Date => {
    const date = new Date();
    // Approximate timezone offset: 15 degrees longitude = 1 hour offset
    const timezoneOffsetHours = longitudeVal / 15;
    const targetUtcHourFloat = hour - timezoneOffsetHours;
    
    let utcHour = Math.floor(targetUtcHourFloat);
    let utcMin = Math.round((targetUtcHourFloat - utcHour) * 60);
    
    if (utcMin < 0) {
      utcMin += 60;
      utcHour -= 1;
    }
    
    date.setUTCHours((utcHour + 24) % 24);
    date.setUTCMinutes(utcMin);
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);
    return date;
  };

  // Compute sun angle metrics dynamically using useMemo when parameters change
  const sunStats = useMemo(() => {
    const date = getUtcDateForLocalTime(timeOfDay, lng);
    const sunPos = SunCalc.getPosition(date, lat, lng);
    
    let altVal = sunPos.altitude;
    let azVal = sunPos.azimuth;

    // Auto-detect degree output (e.g.Delhi altitude is ~61 deg, which is > 2.0 radians)
    // If it's in radians, convert to degrees for stats display
    if (Math.abs(altVal) <= 2.0) {
      altVal = altVal * (180 / Math.PI);
      azVal = azVal * (180 / Math.PI);
    }

    return {
      azimuth: azVal,
      altitude: altVal,
      isDaylight: altVal > 0,
    };
  }, [timeOfDay, lat, lng]);

  // Compute Solar positions using suncalc based on active coordinates and hour
  // SunCalc azimuth is 0 at South, positive is West, negative is East
  // altitude is angle above horizon (radians)
  const computeSunCoords = (hour: number): { x: number; y: number; z: number; intensity: number } => {
    if (forceSun) {
      // Fixed bright overhead daylight sun (12:00 PM equivalent)
      return { x: 15, y: 35, z: 15, intensity: 1.3 };
    }

    // Generate date in UTC to match local solar time
    const date = getUtcDateForLocalTime(hour, lng);

    const sunPos = SunCalc.getPosition(date, lat, lng);
    
    let altRad = sunPos.altitude;
    let azRad = sunPos.azimuth;

    // Auto-detect and convert degrees to radians if needed
    if (Math.abs(altRad) > 2.0) {
      altRad = altRad * (Math.PI / 180);
      azRad = azRad * (Math.PI / 180);
    }

    const distance = 45;
    if (altRad <= 0) {
      // Sun is set
      return { x: 0, y: -20, z: 0, intensity: 0 };
    }

    // Translate suncalc coordinates to Three.js coordinate system (Y is up, Z is depth)
    // Rotate to match compass orientation
    const angleMap: Record<CompassDirection, number> = {
      N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315
    };
    const plotNorthRotation = angleMap[northDirection] * (Math.PI / 180);
    const finalAzimuth = azRad + plotNorthRotation;

    const y = distance * Math.sin(altRad);
    const x = distance * Math.cos(altRad) * Math.sin(finalAzimuth);
    const z = distance * Math.cos(altRad) * Math.cos(finalAzimuth);

    // Scaling light intensity based on solar altitude (brighter at noon)
    const intensity = Math.min(1.5, Math.max(0, Math.sin(altRad) * 1.5));

    return { x, y, z, intensity };
  };

  const sun = computeSunCoords(timeOfDay);

  // Renders a wall with window and door cutouts procedurally
  const renderWallsForRoom = (room: Room, floorNum: number, wallTheme: typeof theme) => {
    const wallHeight = 10;
    const wallThickness = 0.5;
    const baseElevation = (floorNum - 1) * wallHeight;

    const wallElements: React.JSX.Element[] = [];

    // Helper to draw a single 3D wall segment
    const drawSegment = (
      id: string,
      x: number,
      z: number,
      w: number,
      h: number,
      d: number,
      yOff: number = 0
    ) => (
      <mesh
        key={id}
        position={[x - offsetX, baseElevation + yOff + h / 2, z - offsetZ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wallTheme.wallColor} roughness={wallTheme.wallRoughness} />
      </mesh>
    );

    // Helper to draw a window pane
    const drawWindowGlass = (id: string, x: number, z: number, w: number, d: number, rot: boolean = false) => (
      <mesh
        key={id}
        position={[x - offsetX, baseElevation + 5.0, z - offsetZ]}
      >
        <boxGeometry args={[rot ? 0.1 : w, 4, rot ? w : 0.1]} />
        <meshPhysicalMaterial
          color={wallTheme.glassColor}
          transparent
          opacity={0.6}
          roughness={0.1}
          metalness={0.9}
          transmission={0.8}
          thickness={0.2}
        />
      </mesh>
    );

    // North wall (Top wall along X)
    const nDoors = room.doors.filter(d => d.wall === 'N');
    const nWins = room.windows.filter(w => w.wall === 'N');
    if (nDoors.length === 0 && nWins.length === 0) {
      wallElements.push(drawSegment(`${room.id}-wall-n`, room.x + room.width / 2, room.y, room.width, wallHeight, wallThickness));
    } else {
      // Procedural wall segmentation along X
      // Let's sort all openings along the wall width (from offset 0 to width)
      const openings = [
        ...nDoors.map(d => ({ offset: d.offset, width: 3, type: 'door', id: d.id })),
        ...nWins.map(w => ({ offset: w.offset, width: w.width, type: 'window', id: w.id }))
      ].sort((a, b) => a.offset - b.offset);

      let currentX = 0;
      openings.forEach((op, idx) => {
        // Draw solid wall segment before opening
        if (op.offset > currentX) {
          const segW = op.offset - currentX;
          wallElements.push(drawSegment(`${room.id}-wall-n-seg-${idx}`, room.x + currentX + segW / 2, room.y, segW, wallHeight, wallThickness));
        }

        // Draw header and sill around openings
        if (op.type === 'door') {
          // Door opening: header only (from 7.5ft to 10ft)
          wallElements.push(drawSegment(`${room.id}-door-n-hdr-${idx}`, room.x + op.offset + op.width / 2, room.y, op.width, 2.5, wallThickness, 7.5));
        } else if (op.type === 'window') {
          // Window opening: sill (0 to 3ft) and header (7 to 10ft)
          wallElements.push(drawSegment(`${room.id}-win-n-sill-${idx}`, room.x + op.offset + op.width / 2, room.y, op.width, 3, wallThickness, 0));
          wallElements.push(drawSegment(`${room.id}-win-n-hdr-${idx}`, room.x + op.offset + op.width / 2, room.y, op.width, 3, wallThickness, 7));
          // Draw glass
          wallElements.push(drawWindowGlass(`${room.id}-win-n-glass-${idx}`, room.x + op.offset + op.width / 2, room.y, op.width, wallThickness));
        }

        currentX = op.offset + op.width;
      });

      // Draw final wall segment
      if (room.width > currentX) {
        const segW = room.width - currentX;
        wallElements.push(drawSegment(`${room.id}-wall-n-seg-last`, room.x + currentX + segW / 2, room.y, segW, wallHeight, wallThickness));
      }
    }

    // South wall (Bottom wall along X)
    const sDoors = room.doors.filter(d => d.wall === 'S');
    const sWins = room.windows.filter(w => w.wall === 'S');
    if (sDoors.length === 0 && sWins.length === 0) {
      wallElements.push(drawSegment(`${room.id}-wall-s`, room.x + room.width / 2, room.y + room.height, room.width, wallHeight, wallThickness));
    } else {
      const openings = [
        ...sDoors.map(d => ({ offset: d.offset, width: 3, type: 'door' })),
        ...sWins.map(w => ({ offset: w.offset, width: w.width, type: 'window' }))
      ].sort((a, b) => a.offset - b.offset);

      let currentX = 0;
      openings.forEach((op, idx) => {
        if (op.offset > currentX) {
          const segW = op.offset - currentX;
          wallElements.push(drawSegment(`${room.id}-wall-s-seg-${idx}`, room.x + currentX + segW / 2, room.y + room.height, segW, wallHeight, wallThickness));
        }

        if (op.type === 'door') {
          wallElements.push(drawSegment(`${room.id}-door-s-hdr-${idx}`, room.x + op.offset + op.width / 2, room.y + room.height, op.width, 2.5, wallThickness, 7.5));
        } else if (op.type === 'window') {
          wallElements.push(drawSegment(`${room.id}-win-s-sill-${idx}`, room.x + op.offset + op.width / 2, room.y + room.height, op.width, 3, wallThickness, 0));
          wallElements.push(drawSegment(`${room.id}-win-s-hdr-${idx}`, room.x + op.offset + op.width / 2, room.y + room.height, op.width, 3, wallThickness, 7));
          wallElements.push(drawWindowGlass(`${room.id}-win-s-glass-${idx}`, room.x + op.offset + op.width / 2, room.y + room.height, op.width, wallThickness));
        }
        currentX = op.offset + op.width;
      });

      if (room.width > currentX) {
        const segW = room.width - currentX;
        wallElements.push(drawSegment(`${room.id}-wall-s-seg-last`, room.x + currentX + segW / 2, room.y + room.height, segW, wallHeight, wallThickness));
      }
    }

    // West wall (Left wall along Z)
    const wDoors = room.doors.filter(d => d.wall === 'W');
    const wWins = room.windows.filter(w => w.wall === 'W');
    if (wDoors.length === 0 && wWins.length === 0) {
      wallElements.push(drawSegment(`${room.id}-wall-w`, room.x, room.y + room.height / 2, wallThickness, wallHeight, room.height));
    } else {
      const openings = [
        ...wDoors.map(d => ({ offset: d.offset, width: 3, type: 'door' })),
        ...wWins.map(w => ({ offset: w.offset, width: w.width, type: 'window' }))
      ].sort((a, b) => a.offset - b.offset);

      let currentZ = 0;
      openings.forEach((op, idx) => {
        if (op.offset > currentZ) {
          const segL = op.offset - currentZ;
          wallElements.push(drawSegment(`${room.id}-wall-w-seg-${idx}`, room.x, room.y + currentZ + segL / 2, wallThickness, wallHeight, segL));
        }

        if (op.type === 'door') {
          wallElements.push(drawSegment(`${room.id}-door-w-hdr-${idx}`, room.x, room.y + op.offset + op.width / 2, wallThickness, 2.5, op.width, 7.5));
        } else if (op.type === 'window') {
          wallElements.push(drawSegment(`${room.id}-win-w-sill-${idx}`, room.x, room.y + op.offset + op.width / 2, wallThickness, 3, op.width, 0));
          wallElements.push(drawSegment(`${room.id}-win-w-hdr-${idx}`, room.x, room.y + op.offset + op.width / 2, wallThickness, 3, op.width, 7));
          wallElements.push(drawWindowGlass(`${room.id}-win-w-glass-${idx}`, room.x, room.y + op.offset + op.width / 2, wallThickness, op.width, true));
        }
        currentZ = op.offset + op.width;
      });

      if (room.height > currentZ) {
        const segL = room.height - currentZ;
        wallElements.push(drawSegment(`${room.id}-wall-w-seg-last`, room.x, room.y + currentZ + segL / 2, wallThickness, wallHeight, segL));
      }
    }

    // East wall (Right wall along Z)
    const eDoors = room.doors.filter(d => d.wall === 'E');
    const eWins = room.windows.filter(w => w.wall === 'E');
    if (eDoors.length === 0 && eWins.length === 0) {
      wallElements.push(drawSegment(`${room.id}-wall-e`, room.x + room.width, room.y + room.height / 2, wallThickness, wallHeight, room.height));
    } else {
      const openings = [
        ...eDoors.map(d => ({ offset: d.offset, width: 3, type: 'door' })),
        ...eWins.map(w => ({ offset: w.offset, width: w.width, type: 'window' }))
      ].sort((a, b) => a.offset - b.offset);

      let currentZ = 0;
      openings.forEach((op, idx) => {
        if (op.offset > currentZ) {
          const segL = op.offset - currentZ;
          wallElements.push(drawSegment(`${room.id}-wall-e-seg-${idx}`, room.x + room.width, room.y + currentZ + segL / 2, wallThickness, wallHeight, segL));
        }

        if (op.type === 'door') {
          wallElements.push(drawSegment(`${room.id}-door-e-hdr-${idx}`, room.x + room.width, room.y + op.offset + op.width / 2, wallThickness, 2.5, op.width, 7.5));
        } else if (op.type === 'window') {
          wallElements.push(drawSegment(`${room.id}-win-e-sill-${idx}`, room.x + room.width, room.y + op.offset + op.width / 2, wallThickness, 3, op.width, 0));
          wallElements.push(drawSegment(`${room.id}-win-e-hdr-${idx}`, room.x + room.width, room.y + op.offset + op.width / 2, wallThickness, 3, op.width, 7));
          wallElements.push(drawWindowGlass(`${room.id}-win-e-glass-${idx}`, room.x + room.width, room.y + op.offset + op.width / 2, wallThickness, op.width, true));
        }
        currentZ = op.offset + op.width;
      });

      if (room.height > currentZ) {
        const segL = room.height - currentZ;
        wallElements.push(drawSegment(`${room.id}-wall-e-seg-last`, room.x + room.width, room.y + currentZ + segL / 2, wallThickness, wallHeight, segL));
      }
    }

    return wallElements;
  };

  // Render a floor plan level in 3D
  const renderFloorPlan3D = (plan: FloorPlan) => {
    const floorNum = plan.floor_number;

    // Filter floor visibility based on active view toggles
    if (activeFloor !== 'all' && activeFloor !== floorNum) {
      return null;
    }

    const isHighestFloor = floorNum === floorPlans.length;
    const baseElevation = (floorNum - 1) * 10;

    return (
      <group key={plan.id}>
        {/* Floor Slab */}
        <mesh
          position={[0, baseElevation - 0.2, 0]}
          receiveShadow
        >
          <boxGeometry args={[plotWidth - 6, 0.4, plotLength - 8]} />
          <meshStandardMaterial color={theme.slabColor} roughness={0.8} />
        </mesh>

        {/* Room Floors & Walls */}
        {plan.rooms.map((room) => {
          const isOutdoor = room.name.toLowerCase().includes('parking') || room.name.toLowerCase().includes('garden') || room.name.toLowerCase().includes('balcony');
          
          return (
            <group key={room.id}>
              {/* Individual Room floor finish (e.g. tiles/wood) */}
              {!isOutdoor && (
                <mesh
                  position={[room.x + room.width / 2 - offsetX, baseElevation + 0.05, room.y + room.height / 2 - offsetZ]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  receiveShadow
                >
                  <planeGeometry args={[room.width - 0.1, room.height - 0.1]} />
                  <meshStandardMaterial color={theme.floorColor} roughness={0.4} />
                </mesh>
              )}

              {/* Staircase Steps decoration */}
              {room.name === 'Staircase' && (
                <group position={[room.x - offsetX, baseElevation, room.y - offsetZ]}>
                  {Array.from({ length: 12 }).map((_, stepIdx) => {
                    const stepW = room.width - 1;
                    const stepH = 10 / 12; // Total floor height is 10ft divided by 12 steps
                    const stepD = room.height / 12;
                    return (
                      <mesh
                        key={`step-${stepIdx}`}
                        position={[stepW / 2 + 0.5, stepIdx * stepH + stepH / 2, stepIdx * stepD + stepD / 2]}
                        castShadow
                        receiveShadow
                      >
                        <boxGeometry args={[stepW, stepH, stepD]} />
                        <meshStandardMaterial color={theme.slabColor} />
                      </mesh>
                    );
                  })}
                </group>
              )}

              {/* Room name tag floating above in 3D */}
              <Text
                position={[room.x + room.width / 2 - offsetX, baseElevation + 6, room.y + room.height / 2 - offsetZ]}
                fontSize={1.2}
                color={selectedStyle === 'minimal' ? '#0F1D36' : '#FFFFFF'}
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 4, 0, 0]}
              >
                {room.name}
              </Text>

              {/* Extrude walls (doors/windows cutouts applied) */}
              {!isOutdoor && renderWallsForRoom(room, floorNum, theme)}
            </group>
          );
        })}

        {/* Roof Slab (only rendered over the highest floor if enabled) */}
        {isHighestFloor && showRoof && (
          <mesh
            position={[0, baseElevation + 9.8, 0]}
            castShadow
          >
            <boxGeometry args={[plotWidth - 5.8, 0.4, plotLength - 7.8]} />
            <meshStandardMaterial color={theme.roofColor} roughness={0.7} />
          </mesh>
        )}
      </group>
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 3D Scene Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        {/* Style selection */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Layers className="w-4 h-4" /> Material Scheme:
          </span>
          <div className="flex gap-1.5">
            {(['modern', 'minimal', 'traditional', 'luxury'] as StyleType[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStyle(st)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize border cursor-pointer transition ${
                  selectedStyle === st
                    ? 'bg-blueprint border-blueprint text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Solar Mode Override */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Sun className="w-4 h-4 text-amber-500" /> Lighting:
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setForceSun(true)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer transition ${
                forceSun
                  ? 'bg-amber-600 border-amber-600 text-white shadow-sm font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Daylight
            </button>
            <button
              type="button"
              onClick={() => setForceSun(false)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer transition ${
                !forceSun
                  ? 'bg-blueprint border-blueprint text-white shadow-sm font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Shadow Sim
            </button>
          </div>
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Eye className="w-4 h-4" /> View Level:
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => { setActiveFloor('all'); setShowRoof(true); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer transition ${
                activeFloor === 'all' && showRoof
                  ? 'bg-blueprint border-blueprint text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Full Structure
            </button>
            <button
              type="button"
              onClick={() => { setActiveFloor('all'); setShowRoof(false); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer transition ${
                activeFloor === 'all' && !showRoof
                  ? 'bg-blueprint border-blueprint text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Cutaway (No Roof)
            </button>
            {floorPlans.map((fp) => (
              <button
                key={fp.floor_number}
                type="button"
                onClick={() => { setActiveFloor(fp.floor_number); setShowRoof(false); }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer transition ${
                  activeFloor === fp.floor_number
                    ? 'bg-blueprint border-blueprint text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Floor {fp.floor_number === 1 ? 'G' : fp.floor_number - 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3D Canvas Box */}
      <div className="relative w-full h-[450px] bg-[#0F172A] border border-slate-700 rounded-2xl overflow-hidden shadow-lg">
        <Canvas
          shadows
          camera={{ position: [25, 30, 45], fov: 40 }}
          className="w-full h-full"
        >
          {/* Background and Ambient Settings */}
          <color attach="background" args={['#0B0F19']} />
          <ambientLight intensity={0.6} />
          {/* Constant fill light to keep house visible even at night */}
          <directionalLight position={[20, 45, 20]} intensity={0.8} color="#ffffff" />
          {/* Ground Terrain plane representing plot */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#1E293B" roughness={0.9} />
          </mesh>

          {/* Boundaries of the full Plot as a thin 3D frame wire */}
          <gridHelper args={[100, 50, '#334155', '#1E293B']} position={[0, -0.4, 0]} />

          {/* Procedural Building Slabs & Extrusion */}
          {floorPlans.map(plan => renderFloorPlan3D(plan))}

          {/* Sunlight directional light casting shadows */}
          {sun.intensity > 0 && (
            <directionalLight
              castShadow
              position={[sun.x, sun.y, sun.z]}
              intensity={sun.intensity}
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-far={100}
              shadow-camera-left={-30}
              shadow-camera-right={30}
              shadow-camera-top={30}
              shadow-camera-bottom={-30}
              shadow-bias={-0.0005}
            />
          )}

          {/* Soft secondary bounced sky light */}
          <hemisphereLight color="#87CEEB" groundColor="#000000" intensity={0.2} />

          {/* Visual Indicator of the Sun in space */}
          <SunSphere position={[sun.x, sun.y, sun.z]} intensity={sun.intensity} />

          <OrbitControls maxPolarAngle={Math.PI / 2.1} minDistance={10} maxDistance={90} />
        </Canvas>

        {/* Day / Night state badge inside the Canvas overlay */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs shadow-md">
          {forceSun ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '20s' }} />
              <span className="font-bold text-amber-300">Bright Daylight Mode (Active)</span>
            </>
          ) : sun.intensity > 0 ? (
            <>
              <Sun className="w-4 h-4 text-yellow-400 animate-spin" style={{ animationDuration: '20s' }} />
              <span>Simulated Sun Active</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-300 animate-pulse" />
              <span>Shadow Simulation: Night Mode</span>
            </>
          )}
        </div>

        {/* Sun Angle Metrics Drawer overlay inside Canvas */}
        <div className="absolute bottom-4 right-4 z-10 bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-300 rounded-xl p-3 text-xs shadow-md w-[220px] space-y-1">
          <h5 className="font-bold text-white flex items-center gap-1"><Info className="w-3.5 h-3.5 text-terracotta" /> Solar Orientation</h5>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2">
            <span>Latitude:</span> <span className="text-white text-right">{lat.toFixed(4)}°</span>
            <span>Longitude:</span> <span className="text-white text-right">{lng.toFixed(4)}°</span>
            <span>Hour Indicator:</span> <span className="text-white text-right">{Math.floor(timeOfDay)}:00</span>
            <span>Sun Altitude:</span> <span className="text-white text-right">{sunStats.altitude.toFixed(1)}°</span>
            <span>Sun Azimuth:</span> <span className="text-white text-right">{sunStats.azimuth.toFixed(1)}°</span>
          </div>
        </div>
      </div>
      
      {/* Daylight / shadow slider controls */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1 w-full space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1.5"><Sun className="w-4 h-4 text-amber-500" /> Time of Day (Hourly shadow dial)</span>
            <span className="text-terracotta bg-terracotta/5 px-2 py-0.5 rounded border border-terracotta/10">
              {timeOfDay === 12 ? '12:00 PM (Solar Noon)' : timeOfDay > 12 ? `${timeOfDay - 12}:00 PM` : `${timeOfDay}:00 AM`}
            </span>
          </div>
          <input
            type="range"
            min="6"
            max="18"
            step="1"
            value={timeOfDay}
            onChange={(e) => {
              setForceSun(false);
              if (onTimeChange) onTimeChange(Number(e.target.value));
            }}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-terracotta"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>6:00 AM (Sunrise)</span>
            <span>12:00 PM (Noon)</span>
            <span>6:00 PM (Sunset)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
