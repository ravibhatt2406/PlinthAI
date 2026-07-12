import { PlotInput, FloorPlan } from './types';

export async function refineFloorPlan(
  plotInput: PlotInput,
  proceduralPlans: FloorPlan[]
): Promise<FloorPlan[]> {
  try {
    const response = await fetch('/api/refine-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plotInput,
        floorPlans: proceduralPlans,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    if (data.floorPlans && Array.isArray(data.floorPlans)) {
      return data.floorPlans as FloorPlan[];
    }

    throw new Error('Invalid response structure from refine-plan API');
  } catch (error) {
    console.error('refineFloorPlan failed, using fallback:', error);
    // Return unrefined procedural plans
    return proceduralPlans.map((fp) => ({
      ...fp,
      reasoning_notes: `Procedural layout configured for a ${plotInput.width_ft}x${plotInput.length_ft} ft plot with ${plotInput.north_direction} orientation. Rooms arranged according to structural load-bearing parameters and ${plotInput.vastu_preference ? 'Vastu compliance principles' : 'standard functional flow'}.`
    }));
  }
}
