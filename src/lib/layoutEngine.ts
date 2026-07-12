import { PlotInput, Room, FloorPlan, CompassDirection } from './types';

// Helper to determine quadrants based on North direction orientation
// Returns local grid offsets matching Vastu regions (NE, SE, SW, NW)
// Local Grid coordinates: Top-Left is (0,0), Bottom-Right is (Width, Length)
// Front of the plot is always at the bottom (y = Length)
interface VastuQuadrants {
  NE: 'TL' | 'TR' | 'BL' | 'BR';
  SE: 'TL' | 'TR' | 'BL' | 'BR';
  SW: 'TL' | 'TR' | 'BL' | 'BR';
  NW: 'TL' | 'TR' | 'BL' | 'BR';
}

function getVastuQuadrants(facing: CompassDirection): VastuQuadrants {
  // If facing is North (North is at the front, i.e., at the bottom y = Length)
  // Then: Front is North, Rear is South, Left is East, Right is West
  if (facing === 'N') {
    return {
      NE: 'BL', // Front-Left
      SE: 'BR', // Front-Right
      SW: 'TR', // Rear-Right
      NW: 'TL', // Rear-Left
    };
  }
  // If facing is South (North is at the rear, i.e., at the top y = 0)
  // Then: Front is South, Rear is North, Left is West, Right is East
  if (facing === 'S') {
    return {
      NE: 'TR', // Rear-Right
      SE: 'BR', // Front-Right
      SW: 'BL', // Front-Left
      NW: 'TL', // Rear-Left
    };
  }
  // If facing is East (North is at the left x = 0)
  // Then: Front is East, Rear is West, Left is North, Right is South
  if (facing === 'E') {
    return {
      NE: 'TL', // Rear-Left
      SE: 'BL', // Front-Left
      SW: 'BR', // Front-Right
      NW: 'TR', // Rear-Right
    };
  }
  // If facing is West (North is at the right x = Width)
  // Then: Front is West, Rear is East, Left is South, Right is North
  if (facing === 'W') {
    return {
      NE: 'TR', // Rear-Right
      SE: 'BR', // Front-Right
      SW: 'BL', // Front-Left
      NW: 'TL', // Rear-Left
    };
  }
  
  // Defaults for intermediate (NE, NW, SE, SW)
  return {
    NE: 'TR',
    SE: 'BR',
    SW: 'BL',
    NW: 'TL',
  };
}

export function generateProceduralLayout(plotInput: PlotInput): FloorPlan[] {
  const {
    length_ft,
    width_ft,
    north_direction,
    floors,
    bedrooms,
    bathrooms,
    parking,
    garden,
    balcony,
    vastu_preference,
  } = plotInput;

  // 1. Calculate Setbacks (Standard Indian Municipal Rules)
  // Front: 5ft, Sides: 3ft each, Rear: 3ft
  const frontSetback = 5;
  const sideSetback = 3;
  const rearSetback = 3;

  const xMin = sideSetback;
  const xMax = width_ft - sideSetback;
  const yMin = rearSetback;
  const yMax = length_ft - frontSetback;

  const buildWidth = xMax - xMin;
  const buildLength = yMax - yMin;

  const floorPlans: FloorPlan[] = [];

  // Vastu Quadrant assignment
  const vq = getVastuQuadrants(north_direction);

  // Distribute bedrooms and bathrooms across floors
  const totalBHK = bedrooms;
  const totalBaths = bathrooms;

  // Let's plan room allocation per floor
  // e.g. BHK ground vs upper
  const bhkPerFloor: number[] = [];
  const bathsPerFloor: number[] = [];

  if (floors === 1) {
    bhkPerFloor[0] = totalBHK;
    bathsPerFloor[0] = totalBaths;
  } else if (floors === 2) {
    bhkPerFloor[0] = Math.max(1, Math.floor(totalBHK / 2));
    bhkPerFloor[1] = totalBHK - bhkPerFloor[0];
    bathsPerFloor[0] = Math.max(1, Math.floor(totalBaths / 2));
    bathsPerFloor[1] = totalBaths - bathsPerFloor[0];
  } else {
    // 3 floors
    bhkPerFloor[0] = 1;
    bhkPerFloor[1] = Math.max(1, Math.floor((totalBHK - 1) / 2));
    bhkPerFloor[2] = totalBHK - 1 - bhkPerFloor[1];
    bathsPerFloor[0] = 1;
    bathsPerFloor[1] = Math.max(1, Math.floor((totalBaths - 1) / 2));
    bathsPerFloor[2] = totalBaths - 1 - bathsPerFloor[1];
  }

  // Shared Staircase position if floors > 1 (identical coordinates on all floors for realism)
  const stairW = 8;
  const stairL = 12;
  // Positioned along the left wall, mid-depth
  const stairX = xMin;
  const stairY = yMin + buildLength * 0.4;

  for (let f = 1; f <= floors; f++) {
    const floorIndex = f - 1;
    const rooms: Room[] = [];

    // Grid coordinates: we divide the usable buildWidth and buildLength
    // Rear zone: yMin to yMin + buildLength * 0.35
    // Mid zone: yMin + buildLength * 0.35 to yMin + buildLength * 0.65
    // Front zone: yMin + buildLength * 0.65 to yMax

    const ySplit1 = yMin + buildLength * 0.35;
    const ySplit2 = yMin + buildLength * 0.65;

    const rearHeight = ySplit1 - yMin;
    const midHeight = ySplit2 - ySplit1;
    const frontHeight = yMax - ySplit2;

    // Staircase (on all floors if multi-floor)
    if (floors > 1) {
      rooms.push({
        id: `f${f}-staircase`,
        name: 'Staircase',
        x: stairX,
        y: stairY,
        width: stairW,
        height: stairL,
        doors: [
          { id: `f${f}-d-stair-in`, wall: 'E', offset: stairL / 2 }
        ],
        windows: [
          { id: `f${f}-w-stair-ext`, wall: 'W', offset: stairL / 2, width: 3 }
        ]
      });
    }

    // --- REAR ZONE: Bedrooms and Bathrooms ---
    // If we have a bedroom on this floor
    const bedsOnThisFloor = bhkPerFloor[floorIndex] || 0;
    const bathsOnThisFloor = bathsPerFloor[floorIndex] || 0;

    if (bedsOnThisFloor > 0) {
      if (bedsOnThisFloor === 1) {
        // Split Rear zone into: Bedroom + Bath
        // Let's divide Rear zone vertically (X axis)
        const bedW = buildWidth * 0.7;
        const bathW = buildWidth * 0.3;

        // Vastu SW adjustment: SW is master bedroom, NW/SE bath
        const alignLeft = vastu_preference && (vq.SW === 'TL' || vq.SW === 'BL');

        const bedX = alignLeft ? xMin : xMin + bathW;
        const bathX = alignLeft ? xMin + bedW : xMin;

        rooms.push({
          id: `f${f}-bedroom-1`,
          name: f === 2 ? 'Master Bedroom' : `Bedroom ${f === 1 ? '1' : floorIndex * 2}`,
          x: bedX,
          y: yMin,
          width: bedW,
          height: rearHeight,
          doors: [
            { id: `f${f}-d-bed1`, wall: 'S', offset: bedW / 2 }
          ],
          windows: [
            { id: `f${f}-w-bed1-ext`, wall: 'N', offset: bedW / 2, width: 4 }
          ]
        });

        if (bathsOnThisFloor > 0) {
          rooms.push({
            id: `f${f}-bathroom-1`,
            name: `Bathroom ${f === 2 ? 'Master' : '1'}`,
            x: bathX,
            y: yMin,
            width: bathW,
            height: rearHeight,
            doors: [
              { id: `f${f}-d-bath1`, wall: alignLeft ? 'W' : 'E', offset: rearHeight / 2 }
            ],
            windows: [
              { id: `f${f}-w-bath1-ext`, wall: 'N', offset: bathW / 2, width: 2 }
            ]
          });
        }
      } else {
        // 2 Bedrooms in Rear Zone (split in half)
        const roomW = buildWidth / 2;
        rooms.push({
          id: `f${f}-bedroom-1`,
          name: `Bedroom ${floorIndex * 2 + 1}`,
          x: xMin,
          y: yMin,
          width: roomW,
          height: rearHeight,
          doors: [
            { id: `f${f}-d-bed1`, wall: 'S', offset: roomW / 2 }
          ],
          windows: [
            { id: `f${f}-w-bed1-ext`, wall: 'N', offset: roomW / 3, width: 3 }
          ]
        });

        rooms.push({
          id: `f${f}-bedroom-2`,
          name: `Bedroom ${floorIndex * 2 + 2}`,
          x: xMin + roomW,
          y: yMin,
          width: roomW,
          height: rearHeight,
          doors: [
            { id: `f${f}-d-bed2`, wall: 'S', offset: roomW / 2 }
          ],
          windows: [
            { id: `f${f}-w-bed2-ext`, wall: 'N', offset: (2 * roomW) / 3, width: 3 }
          ]
        });

        // Common bathroom placed in middle zone
      }
    }

    // --- MID ZONE: Kitchen, Hall, common Bath ---
    const midXStart = (floors > 1) ? xMin + stairW : xMin;
    const midWidth = width_ft - sideSetback * 2 - ((floors > 1) ? stairW : 0);

    if (f === 1) {
      // Ground floor middle: Kitchen and Dining/Foyer
      // Vastu SE: Kitchen should be in South-East
      const kitchenW = midWidth * 0.4;
      const hallW = midWidth * 0.6;
      
      const alignRight = vastu_preference && (vq.SE === 'TR' || vq.SE === 'BR');
      const kitX = alignRight ? midXStart + hallW : midXStart;
      const hallX = alignRight ? midXStart : midXStart + kitchenW;

      rooms.push({
        id: `f${f}-kitchen`,
        name: 'Kitchen',
        x: kitX,
        y: ySplit1,
        width: kitchenW,
        height: midHeight,
        doors: [
          { id: `f${f}-d-kit`, wall: alignRight ? 'W' : 'E', offset: midHeight / 2 }
        ],
        windows: [
          { id: `f${f}-w-kit-ext`, wall: alignRight ? 'E' : 'W', offset: midHeight / 2, width: 3 }
        ]
      });

      rooms.push({
        id: `f${f}-dining`,
        name: 'Dining & Lobby',
        x: hallX,
        y: ySplit1,
        width: hallW,
        height: midHeight,
        doors: [
          { id: `f${f}-d-dining-rear`, wall: 'N', offset: hallW / 2 }
        ],
        windows: []
      });

      // Extra common bathroom if ground floor has multiple baths
      if (bathsOnThisFloor > 1 || (bedsOnThisFloor > 1 && bathsOnThisFloor > 0)) {
        // Cut a small bath out of Dining space (e.g. 6x8 ft)
        const cbW = 6;
        const cbL = 8;
        rooms.push({
          id: `f${f}-bathroom-common`,
          name: 'Common Toilet',
          x: hallX + hallW - cbW,
          y: ySplit1,
          width: cbW,
          height: cbL,
          doors: [
            { id: `f${f}-d-cbt`, wall: 'S', offset: cbW / 2 }
          ],
          windows: [
            { id: `f${f}-w-cbt-ext`, wall: 'E', offset: cbL / 2, width: 2 }
          ]
        });
      }
    } else {
      // Upper Floors middle: Family lounge + study/bathroom
      const loungeW = midWidth * 0.7;
      const studyW = midWidth * 0.3;

      rooms.push({
        id: `f${f}-family-lounge`,
        name: 'Family Lounge',
        x: midXStart,
        y: ySplit1,
        width: loungeW,
        height: midHeight,
        doors: [],
        windows: []
      });

      rooms.push({
        id: `f${f}-study`,
        name: bathsOnThisFloor > 1 ? 'Bathroom' : 'Study Room',
        x: midXStart + loungeW,
        y: ySplit1,
        width: studyW,
        height: midHeight,
        doors: [
          { id: `f${f}-d-study`, wall: 'W', offset: midHeight / 2 }
        ],
        windows: [
          { id: `f${f}-w-study-ext`, wall: 'E', offset: midHeight / 2, width: 3 }
        ]
      });
    }

    // --- FRONT ZONE: Living Room, Parking, Garden, Balcony ---
    if (f === 1) {
      // Ground floor front: Living Room, Parking/Porch
      const liveW = buildWidth * 0.65;
      const parkW = buildWidth * 0.35;

      // Vastu main entry: NE quadrant, which could be Left or Right depending on facing
      const alignLeft = vastu_preference && (vq.NE === 'BL' || vq.NE === 'TL');
      const liveX = alignLeft ? xMin : xMin + parkW;
      const parkX = alignLeft ? xMin + liveW : xMin;

      rooms.push({
        id: `f${f}-living`,
        name: 'Living Room',
        x: liveX,
        y: ySplit2,
        width: liveW,
        height: frontHeight,
        doors: [
          { id: `f${f}-d-main-entry`, wall: 'S', offset: liveW / 4 }, // Main house entrance
          { id: `f${f}-d-live-int`, wall: 'N', offset: liveW / 2 }
        ],
        windows: [
          { id: `f${f}-w-live-front`, wall: 'S', offset: (3 * liveW) / 4, width: 5 }
        ]
      });

      if (parking) {
        rooms.push({
          id: `f${f}-parking`,
          name: 'Parking / Porch',
          x: parkX,
          y: ySplit2,
          width: parkW,
          height: frontHeight,
          doors: [],
          windows: [] // Open space
        });
      } else if (garden) {
        rooms.push({
          id: `f${f}-garden`,
          name: 'Front Garden Lawn',
          x: parkX,
          y: ySplit2,
          width: parkW,
          height: frontHeight,
          doors: [],
          windows: [] // Open lawn
        });
      } else {
        // Just make Living Room wider
        // (If neither parking nor garden is toggled, expand living area)
        // Find existing living room and change width
        const live = rooms.find(r => r.id === `f${f}-living`);
        if (live) {
          live.width = buildWidth;
          live.x = xMin;
        }
      }
    } else {
      // Upper Floors front: Bedroom + Balcony
      const roomW = buildWidth * 0.75;
      const balcW = buildWidth * 0.25;

      rooms.push({
        id: `f${f}-bedroom-front`,
        name: `Bedroom ${floorIndex * 2 + 1}`,
        x: xMin,
        y: ySplit2,
        width: roomW,
        height: frontHeight,
        doors: [
          { id: `f${f}-d-bedf`, wall: 'N', offset: roomW / 2 },
          { id: `f${f}-d-bedf-balc`, wall: 'S', offset: roomW - 2 } // door to balcony
        ],
        windows: [
          { id: `f${f}-w-bedf-front`, wall: 'S', offset: roomW / 2, width: 4 }
        ]
      });

      if (balcony) {
        rooms.push({
          id: `f${f}-balcony`,
          name: 'Balcony',
          x: xMin + roomW,
          y: ySplit2,
          width: balcW,
          height: frontHeight,
          doors: [],
          windows: []
        });
      } else {
        // Expand bedroom
        const bed = rooms.find(r => r.id === `f${f}-bedroom-front`);
        if (bed) {
          bed.width = buildWidth;
        }
      }
    }

    // Push floor plan
    floorPlans.push({
      id: `f${f}-plan`,
      plot_id: '', // Will be assigned upon db save
      floor_number: f,
      rooms,
      reasoning_notes: '', // Filled by Gemini refinement later
      created_at: new Date().toISOString()
    });
  }

  return floorPlans;
}
