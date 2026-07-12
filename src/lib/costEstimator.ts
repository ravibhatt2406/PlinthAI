import costDataset from '../data/cost-dataset.json';
import { PlotInput, FloorPlan, CostEstimateItem } from './types';

export interface CostSummary {
  items: CostEstimateItem[];
  structureSubtotal: number;
  finishingSubtotal: number;
  interiorSubtotal: number;
  laborSubtotal: number;
  gstAmount: number;
  contingencyAmount: number;
  grandTotal: number;
  costPerSqft: number;
}

export function calculateConstructionCost(
  plotInput: PlotInput,
  floorPlans: FloorPlan[],
  materialsPreset: 'premium' | 'standard' = 'premium'
): CostSummary {
  // 1. Calculate Built-Up Area
  // We sum up internal room areas and add wall buffer (+10%)
  let totalInternalArea = 0;
  let totalWallLength = 0;
  let totalDoors = 0;
  let totalWindowsArea = 0;

  floorPlans.forEach((plan) => {
    plan.rooms.forEach((room) => {
      const isOutdoor = room.name.toLowerCase().includes('parking') || room.name.toLowerCase().includes('garden');
      if (!isOutdoor) {
        totalInternalArea += room.width * room.height;
        totalWallLength += (room.width * 2) + (room.height * 2);
      }
      totalDoors += room.doors.length;
      room.windows.forEach((win) => {
        totalWindowsArea += win.width * 4; // assume standard 4ft window height
      });
    });
  });

  // Share walls divider (walls are shared between contiguous rooms)
  totalWallLength = totalWallLength / 1.6;

  const builtUpArea = totalInternalArea * 1.1; // +10% wall envelope thickness
  const wallArea = totalWallLength * 10; // 10ft high walls

  // 2. Fetch Rates from CPWD Dataset
  const ds = costDataset;

  // 3. Compute Quantities & Materials
  // Structure quantities
  const cementBags = Math.ceil(builtUpArea * 0.45);
  const steelKg = Math.ceil(builtUpArea * 2.8);
  const bricksCount = Math.ceil(wallArea * 12.5); // 12.5 bricks per sqft of 9-inch wall
  const sandCft = Math.ceil(builtUpArea * 1.4);
  const aggregateCft = Math.ceil(builtUpArea * 1.5);

  const cementCost = cementBags * ds.cement.rate_inr;
  const steelCost = steelKg * ds.steel.rate_inr;
  const bricksCost = (bricksCount / 1000) * ds.bricks.rate_inr;
  const sandCost = sandCft * ds.sand.rate_inr;
  const aggregateCost = aggregateCft * ds.aggregate.rate_inr;

  // Finishing quantities
  const tilesArea = totalInternalArea;
  const tileRate = materialsPreset === 'premium' ? ds.flooring_vitrified.rate_inr : ds.flooring_ceramic.rate_inr;
  const tileName = materialsPreset === 'premium' ? ds.flooring_vitrified.name : ds.flooring_ceramic.name;
  const flooringCost = tilesArea * tileRate;

  const paintArea = wallArea * 2; // both sides of walls
  const paintRate = materialsPreset === 'premium' ? ds.paint_premium.rate_inr : ds.paint_standard.rate_inr;
  const paintName = materialsPreset === 'premium' ? ds.paint_premium.name : ds.paint_standard.name;
  const paintCost = paintArea * paintRate;

  const windowFrameCost = totalWindowsArea * ds.windows_upvc.rate_inr;
  const doorsCost = totalDoors * ds.doors.rate_inr;

  // Interior & Systems
  const electricalCost = builtUpArea * ds.electrical_point.rate_inr;
  const plumbingCost = plotInput.bathrooms * ds.plumbing_toilet.rate_inr;

  // Labor
  const masonDays = Math.ceil(builtUpArea * 0.08);
  const helperDays = Math.ceil(builtUpArea * 0.12);
  const carpenterDays = Math.ceil((totalDoors * 1.5) + (totalWindowsArea / 12));

  const masonCost = masonDays * ds.labor_mason.rate_inr;
  const helperCost = helperDays * ds.labor_helper.rate_inr;
  const carpenterCost = carpenterDays * ds.labor_carpenter.rate_inr;

  // Categorize items
  const items: CostEstimateItem[] = [
    // Structure Category
    {
      plot_id: '',
      category: 'structure',
      line_item: ds.cement.name,
      quantity: cementBags,
      unit: ds.cement.unit,
      unit_cost_inr: ds.cement.rate_inr,
      total_cost_inr: cementCost,
      source: ds.cement.source
    },
    {
      plot_id: '',
      category: 'structure',
      line_item: ds.steel.name,
      quantity: steelKg,
      unit: ds.steel.unit,
      unit_cost_inr: ds.steel.rate_inr,
      total_cost_inr: steelCost,
      source: ds.steel.source
    },
    {
      plot_id: '',
      category: 'structure',
      line_item: ds.bricks.name,
      quantity: bricksCount,
      unit: 'pieces',
      unit_cost_inr: ds.bricks.rate_inr / 1000,
      total_cost_inr: bricksCost,
      source: ds.bricks.source
    },
    {
      plot_id: '',
      category: 'structure',
      line_item: ds.sand.name,
      quantity: sandCft,
      unit: ds.sand.unit,
      unit_cost_inr: ds.sand.rate_inr,
      total_cost_inr: sandCost,
      source: ds.sand.source
    },
    {
      plot_id: '',
      category: 'structure',
      line_item: ds.aggregate.name,
      quantity: aggregateCft,
      unit: ds.aggregate.unit,
      unit_cost_inr: ds.aggregate.rate_inr,
      total_cost_inr: aggregateCost,
      source: ds.aggregate.source
    },

    // Finishing Category
    {
      plot_id: '',
      category: 'finishing',
      line_item: tileName,
      quantity: tilesArea,
      unit: 'sq.ft.',
      unit_cost_inr: tileRate,
      total_cost_inr: flooringCost,
      source: materialsPreset === 'premium' ? ds.flooring_vitrified.source : ds.flooring_ceramic.source
    },
    {
      plot_id: '',
      category: 'finishing',
      line_item: paintName,
      quantity: paintArea,
      unit: 'sq.ft.',
      unit_cost_inr: paintRate,
      total_cost_inr: paintCost,
      source: materialsPreset === 'premium' ? ds.paint_premium.source : ds.paint_standard.source
    },
    {
      plot_id: '',
      category: 'finishing',
      line_item: ds.doors.name,
      quantity: totalDoors,
      unit: ds.doors.unit,
      unit_cost_inr: ds.doors.rate_inr,
      total_cost_inr: doorsCost,
      source: ds.doors.source
    },
    {
      plot_id: '',
      category: 'finishing',
      line_item: ds.windows_upvc.name,
      quantity: totalWindowsArea,
      unit: ds.windows_upvc.unit,
      unit_cost_inr: ds.windows_upvc.rate_inr,
      total_cost_inr: windowFrameCost,
      source: ds.windows_upvc.source
    },

    // Interior / MEP
    {
      plot_id: '',
      category: 'interior',
      line_item: ds.electrical_point.name,
      quantity: Math.ceil(builtUpArea),
      unit: 'sq.ft.',
      unit_cost_inr: ds.electrical_point.rate_inr,
      total_cost_inr: electricalCost,
      source: ds.electrical_point.source
    },
    {
      plot_id: '',
      category: 'interior',
      line_item: ds.plumbing_toilet.name,
      quantity: plotInput.bathrooms,
      unit: ds.plumbing_toilet.unit,
      unit_cost_inr: ds.plumbing_toilet.rate_inr,
      total_cost_inr: plumbingCost,
      source: ds.plumbing_toilet.source
    },

    // Labor Category
    {
      plot_id: '',
      category: 'labor',
      line_item: ds.labor_mason.name,
      quantity: masonDays,
      unit: ds.labor_mason.unit,
      unit_cost_inr: ds.labor_mason.rate_inr,
      total_cost_inr: masonCost,
      source: ds.labor_mason.source
    },
    {
      plot_id: '',
      category: 'labor',
      line_item: ds.labor_helper.name,
      quantity: helperDays,
      unit: ds.labor_helper.unit,
      unit_cost_inr: ds.labor_helper.rate_inr,
      total_cost_inr: helperCost,
      source: ds.labor_helper.source
    },
    {
      plot_id: '',
      category: 'labor',
      line_item: ds.labor_carpenter.name,
      quantity: carpenterDays,
      unit: ds.labor_carpenter.unit,
      unit_cost_inr: ds.labor_carpenter.rate_inr,
      total_cost_inr: carpenterCost,
      source: ds.labor_carpenter.source
    }
  ];

  const structureSubtotal = cementCost + steelCost + bricksCost + sandCost + aggregateCost;
  const finishingSubtotal = flooringCost + paintCost + doorsCost + windowFrameCost;
  const interiorSubtotal = electricalCost + plumbingCost;
  const laborSubtotal = masonCost + helperCost + carpenterCost;

  const subtotal = structureSubtotal + finishingSubtotal + interiorSubtotal + laborSubtotal;
  const gstAmount = subtotal * 0.12; // 12% GST on composite building contract
  const contingencyAmount = subtotal * 0.10; // 10% contingency buffer
  const grandTotal = subtotal + gstAmount + contingencyAmount;
  const costPerSqft = grandTotal / (builtUpArea || 1);

  return {
    items,
    structureSubtotal,
    finishingSubtotal,
    interiorSubtotal,
    laborSubtotal,
    gstAmount,
    contingencyAmount,
    grandTotal,
    costPerSqft,
  };
}

export interface OptimizationOption {
  id: string;
  title: string;
  description: string;
  savingsInr: number;
  recomputedTotal: number;
  type: 'finish_downgrade' | 'remove_balcony' | 'shrink_rooms' | 'reduce_floors';
  suggestedInput: Partial<PlotInput> & { materialsPreset?: 'premium' | 'standard' };
}

export function generateBudgetOptimizations(
  plotInput: PlotInput,
  currentSummary: CostSummary,
  proceduralPlans: FloorPlan[]
): OptimizationOption[] {
  const options: OptimizationOption[] = [];
  const currentTotal = currentSummary.grandTotal;
  const targetBudget = plotInput.budget_inr;

  if (currentTotal <= targetBudget) return [];

  // Option 1: Downgrade finishing materials (Premium Emulsion to Distemper, Vitrified to Ceramic)
  const finishSummary = calculateConstructionCost(plotInput, proceduralPlans, 'standard');
  const savingsFinish = currentTotal - finishSummary.grandTotal;
  if (savingsFinish > 0) {
    options.push({
      id: 'opt-materials',
      title: 'Switch to Standard Finishes',
      description: 'Downgrade flooring from vitrified to ceramic tiles, and interior paint from premium emulsion to standard distemper.',
      savingsInr: savingsFinish,
      recomputedTotal: finishSummary.grandTotal,
      type: 'finish_downgrade',
      suggestedInput: { materialsPreset: 'standard' }
    });
  }

  // Option 2: Remove Balconies
  if (plotInput.balcony) {
    const withoutBalconyInput = { ...plotInput, balcony: false };
    // Let's create a temporary modified rooms layout
    const tempPlans = proceduralPlans.map((plan) => ({
      ...plan,
      rooms: plan.rooms.filter((room) => !room.name.toLowerCase().includes('balcony'))
    }));
    const balcSummary = calculateConstructionCost(withoutBalconyInput, tempPlans);
    const savingsBalc = currentTotal - balcSummary.grandTotal;
    if (savingsBalc > 0) {
      options.push({
        id: 'opt-balcony',
        title: 'Remove Balconies',
        description: 'Convert balcony areas into interior room extensions to eliminate external balustrades and window overhangs.',
        savingsInr: savingsBalc,
        recomputedTotal: balcSummary.grandTotal,
        type: 'remove_balcony',
        suggestedInput: { balcony: false }
      });
    }
  }

  // Option 3: Shrink Room dimensions by 10% (Built-up area optimization)
  const shrinkInput = {
    ...plotInput,
    width_ft: Math.round(plotInput.width_ft * 0.9),
    length_ft: Math.round(plotInput.length_ft * 0.9)
  };
  const tempShrinkPlans = proceduralPlans.map((plan) => ({
    ...plan,
    rooms: plan.rooms.map((room) => ({
      ...room,
      width: room.width * 0.9,
      height: room.height * 0.9
    }))
  }));
  const shrinkSummary = calculateConstructionCost(shrinkInput, tempShrinkPlans);
  const savingsShrink = currentTotal - shrinkSummary.grandTotal;
  if (savingsShrink > 0) {
    options.push({
      id: 'opt-shrink',
      title: 'Reduce Room Sizes by 10%',
      description: `Slightly shrink plot build bounds to ${shrinkInput.width_ft}x${shrinkInput.length_ft} ft, decreasing overall concrete structural weight.`,
      savingsInr: savingsShrink,
      recomputedTotal: shrinkSummary.grandTotal,
      type: 'shrink_rooms',
      suggestedInput: { width_ft: shrinkInput.width_ft, length_ft: shrinkInput.length_ft }
    });
  }

  // Option 4: Reduce Floor Count (if floors > 1)
  if (plotInput.floors > 1) {
    const reducedFloorsInput = { ...plotInput, floors: plotInput.floors - 1 };
    const reducedPlans = proceduralPlans.filter((_, idx) => idx < plotInput.floors - 1);
    const floorSummary = calculateConstructionCost(reducedFloorsInput, reducedPlans);
    const savingsFloor = currentTotal - floorSummary.grandTotal;
    if (savingsFloor > 0) {
      options.push({
        id: 'opt-floors',
        title: `Reduce Structure to ${plotInput.floors - 1} Floor${plotInput.floors > 2 ? 's' : ''}`,
        description: `Eliminate the upper level to scale down foundation structural steel loading requirements.`,
        savingsInr: savingsFloor,
        recomputedTotal: floorSummary.grandTotal,
        type: 'reduce_floors',
        suggestedInput: { floors: plotInput.floors - 1 }
      });
    }
  }

  // Sort options by highest savings first
  return options.sort((a, b) => b.savingsInr - a.savingsInr);
}
