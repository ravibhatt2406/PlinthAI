import { NextResponse } from 'next/server';
import { PlotInput, Room } from '../../../lib/types';

export async function POST(req: Request) {
  try {
    const { plotInput, rooms, sunMetrics }: {
      plotInput: PlotInput;
      rooms: Room[];
      sunMetrics: {
        sunrise: string;
        sunset: string;
        maxTemp: number;
        minTemp: number;
        uvIndex: number;
      };
    } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

    if (!apiKey) {
      // Fallback response if key is missing
      const fallbackEvaluation = `
Based on your plot facing **${plotInput.north_direction}** at coords [${plotInput.lat.toFixed(3)}, ${plotInput.lng.toFixed(3)}]:
- **Morning Sun Exposure**: East-facing and North-East zones receive gentle morning sunlight. Ideal for the Kitchen and Dining area.
- **Afternoon Sun Exposure**: West and South-West zones receive intense afternoon sunlight, which is why Vastu places the Master Bedroom here to buffer heat or suggests thick wall cladding.
- **Thermal & Material Advice**: With average temperatures of ${sunMetrics.maxTemp || '32'}°C, UPVC double-glazed sliding windows and a reflective high-alibi paint coating are recommended to limit solar heat gains.
      `;
      return NextResponse.json({ evaluation: fallbackEvaluation });
    }

    const promptText = `
You are an architectural sun-exposure and passive-cooling analysis engine.
Analyze the following house design details:

1. Plot parameters:
- North direction orientation: ${plotInput.north_direction} (which direction faces the front street)
- Plot dimensions: ${plotInput.width_ft} x ${plotInput.length_ft} ft
- Lat/Lng: ${plotInput.lat}, ${plotInput.lng}

2. Rooms layout:
${JSON.stringify(rooms.map((r: Room) => ({ name: r.name, x: r.x, y: r.y, w: r.width, h: r.height, windows: r.windows })), null, 2)}

3. Real weather/solar metrics:
- Sunrise: ${sunMetrics.sunrise || 'N/A'}
- Sunset: ${sunMetrics.sunset || 'N/A'}
- Max Temperature: ${sunMetrics.maxTemp || 'N/A'}°C
- Min Temperature: ${sunMetrics.minTemp || 'N/A'}°C
- Max UV Index: ${sunMetrics.uvIndex || 'N/A'}

Provide a plain-language architectural sun-exposure summary in 3 short bullet points:
1. "Morning Sun Exposure": Which rooms receive early light (East/NE facing) and if that matches their use.
2. "Afternoon Sun Exposure & Shadowing": Which rooms get direct afternoon heat (West/SW facing) and how shadowing shields the rest of the plan.
3. "Thermal & Material Recommendations": Material suggestions (like UPVC glass ratings, roof thermal insulation, shading overhangs) to optimize cooling based on the max temperature and UV index.

Keep the response concise, professional, and directly grounded in the provided geometry and metrics. Return raw markdown text. Do not add generic explanations.
`;

    const apiBody = {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.3
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
      throw new Error(`Gemini API failed: ${res.statusText}`);
    }

    const resultData = await res.json();
    const evaluation = resultData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return NextResponse.json({ evaluation });
  } catch (error) {
    const err = error as Error;
    console.error('evaluate-sunlight API error:', err);
    return NextResponse.json({ error: err.message || 'Failed to analyze sunlight' }, { status: 500 });
  }
}
