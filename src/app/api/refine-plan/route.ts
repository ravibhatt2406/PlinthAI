import { NextResponse } from 'next/server';
import { PlotInput, FloorPlan } from '../../../lib/types';

export async function POST(req: Request) {
  try {
    const { plotInput, floorPlans }: {
      plotInput: PlotInput;
      floorPlans: FloorPlan[];
    } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not configured. Returning unrefined procedural layout.');
      // Return unrefined plans with default fallback notes
      const fallbackPlans = floorPlans.map((fp: FloorPlan) => ({
        ...fp,
        reasoning_notes: `Procedural layout configured for a ${plotInput.width_ft}x${plotInput.length_ft} ft plot with ${plotInput.north_direction} orientation. Rooms arranged according to structural load-bearing parameters and ${plotInput.vastu_preference ? 'Vastu compliance principles' : 'standard functional flow'}.`
      }));
      return NextResponse.json({ floorPlans: fallbackPlans });
    }

    const promptText = `
You are an expert Indian residential architect specializing in spatial optimization and Vastu Shastra rules.
You are given a client's plot configuration and a procedurally generated 2D floor plan layout as JSON.

Client Plot Parameters:
${JSON.stringify(plotInput, null, 2)}

Procedural Layout:
${JSON.stringify(floorPlans, null, 2)}

Your Job:
1. Review the room dimensions (x, y, width, height) to ensure they are contiguous, fit within setbacks, and align nicely. You may adjust x, y, width, and height slightly (by 0.5 - 2.0 ft) to align rooms and ensure wall lines match clean architectural layouts, but DO NOT overlap rooms or push them outside the buildable envelope (Width: ${plotInput.width_ft - 6}ft, Depth: ${plotInput.length_ft - 8}ft, starting at x=3, y=3).
2. Review door and window placements. Add appropriate doors to link internal spaces (especially Bedrooms to Bathrooms/Hall, and Kitchen to Dining). Add external windows on external-facing walls (N, S, E, W depending on room position) to maximize natural light and cross-ventilation.
   - For doors, "offset" is from the start corner of that wall.
   - For windows, specify "offset" and "width" (usually 3 to 6 ft).
3. If vastu_preference is true, verify room placements:
   - Entrance: North, East, or North-East.
   - Kitchen: South-East (Agneya) or North-West (Vayavya).
   - Master Bedroom: South-West (Nairutya).
   - Bathrooms: South-East, North-West, or West. Never center-plot or North-East.
   - Staircase: South, West, or South-West.
   Optimize the layout and doors/windows to conform to these rules.
4. Provide a clear, professional architectural reasoning statement (2-3 sentences) for the layout of each floor, describing the flow, sun path advantages, and Vastu choices.

Provide the response in the exact JSON format specified by the schema. Do not include any Markdown wrapping like \`\`\`json. Return only raw JSON.
`;

    const schema = {
      type: "OBJECT",
      properties: {
        floorPlans: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              floor_number: { type: "INTEGER" },
              reasoning_notes: { type: "STRING" },
              rooms: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    name: { type: "STRING" },
                    x: { type: "NUMBER" },
                    y: { type: "NUMBER" },
                    width: { type: "NUMBER" },
                    height: { type: "NUMBER" },
                    doors: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          id: { type: "STRING" },
                          wall: { type: "STRING", enum: ["N", "S", "E", "W"] },
                          offset: { type: "NUMBER" }
                        },
                        required: ["id", "wall", "offset"]
                      }
                    },
                    windows: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          id: { type: "STRING" },
                          wall: { type: "STRING", enum: ["N", "S", "E", "W"] },
                          offset: { type: "NUMBER" },
                          width: { type: "NUMBER" }
                        },
                        required: ["id", "wall", "offset", "width"]
                      }
                    }
                  },
                  required: ["id", "name", "x", "y", "width", "height", "doors", "windows"]
                }
              }
            },
            required: ["floor_number", "rooms", "reasoning_notes"]
          }
        }
      },
      required: ["floorPlans"]
    };

    const apiBody = {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2
      }
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiBody),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error: ${res.statusText} - ${errText}`);
    }

    const resultData = await res.json();
    const candidateText = resultData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!candidateText) {
      throw new Error("No layout response text from Gemini API");
    }

    const parsed = JSON.parse(candidateText.trim());
    return NextResponse.json(parsed);
  } catch (error) {
    const err = error as Error;
    console.error('Refine plan endpoint error:', err);
    return NextResponse.json({ error: err.message || 'Failed to refine layout' }, { status: 500 });
  }
}
