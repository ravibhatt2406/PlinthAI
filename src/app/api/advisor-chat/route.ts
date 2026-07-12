import { NextResponse } from 'next/server';
import { PlotInput, FloorPlan, Room, Window, Door, CostEstimateItem } from '../../../lib/types';
import { CostSummary } from '../../../lib/costEstimator';

interface ChatMessage {
  role: string;
  content: string;
}

export async function POST(req: Request) {
  try {
    const { messages, plot, floorPlans, costSummary }: {
      messages: ChatMessage[];
      plot: PlotInput;
      floorPlans: FloorPlan[];
      costSummary: CostSummary;
    } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json({
        content: "I'm in local developer mode since the Gemini API key is not configured. Please add the `GEMINI_API_KEY` to your environment variables to enable active reasoning. Let me know if you want to inspect the cost breakdown or room details!"
      });
    }

    const systemInstruction = `
You are PLINTH's AI Construction Advisor, an expert in residential architecture, Indian building codes, CPWD schedules of rates, and Vastu Shastra.
You are helping the user optimize, understand, and refine their custom house plan.

Here is the exact data of the user's project:
- **Plot Parameters**:
  - Address: ${plot.address}
  - Coords: ${plot.lat}, ${plot.lng}
  - Dimensions: ${plot.width_ft} ft width x ${plot.length_ft} ft depth (Area: ${plot.width_ft * plot.length_ft} sq.ft.)
  - Facing North Direction: ${plot.north_direction}
  - Floors: ${plot.floors} (Style: ${plot.style})
  - Budget Limit: INR ${plot.budget_inr}
  - BHK Program: ${plot.bedrooms} Bedrooms, ${plot.bathrooms} Bathrooms
  - Vastu Preference Enforced: ${plot.vastu_preference ? 'YES' : 'NO'}

- **Generated Rooms Layout**:
  ${JSON.stringify(floorPlans.map((fp: FloorPlan) => ({
    floor: fp.floor_number,
    reasoning: fp.reasoning_notes,
    rooms: fp.rooms.map((r: Room) => ({
      name: r.name,
      dimensions: `${r.width}x${r.height} ft`,
      area: `${r.width * r.height} sq.ft.`,
      windows: r.windows.map((w: Window) => `${w.width}ft on ${w.wall} wall`),
      doors: r.doors.map((d: Door) => `on ${d.wall} wall`)
    }))
  })), null, 2)}

- **CPWD Construction Cost Estimate Summary**:
  - Total Material & Labor Cost: INR ${costSummary.grandTotal.toFixed(0)} (Cost per sq.ft.: INR ${costSummary.costPerSqft.toFixed(0)})
  - Structure Subtotal: INR ${costSummary.structureSubtotal.toFixed(0)}
  - Finishing Subtotal: INR ${costSummary.finishingSubtotal.toFixed(0)}
  - Interiors/Systems Subtotal: INR ${costSummary.interiorSubtotal.toFixed(0)}
  - Labor Subtotal: INR ${costSummary.laborSubtotal.toFixed(0)}
  - GST Applied (12%): INR ${costSummary.gstAmount.toFixed(0)}
  - Contingency Buffer (10%): INR ${costSummary.contingencyAmount.toFixed(0)}

- **Cost Breakdowns by Item**:
  ${JSON.stringify(costSummary.items.map((i: CostEstimateItem) => ({
    item: i.line_item,
    qty: `${i.quantity} ${i.unit}`,
    unit_cost: `INR ${i.unit_cost_inr}`,
    total: `INR ${i.total_cost_inr}`,
    source: i.source
  })), null, 2)}

CRITICAL COMPLIANCE RULES:
1. **No Hallucinations**: You must ONLY reference figures and dimensions present in the provided project data. If the user asks about an item not listed (e.g., "what if I use Italian marble flooring?"), say explicitly: "The active plan is estimated using CPWD 2025-2026 vitrified/ceramic tile standards, which are priced at INR ${costSummary.items.find((i: CostEstimateItem) => i.line_item.toLowerCase().includes('tile'))?.unit_cost_inr || 80} per sqft. I do not have access to live market prices for Italian marble in this demo."
2. **Grounded Answers**: Never make up or guess cost averages. If a figure is not in the JSON, state that you cannot compute it rather than guessing.
3. **Professional Architectural Tone**: Sound like an experienced builder or surveyor. Use terminology like "CPWD Schedule of Rates", "load-bearing beams", "plinth level", "setback margins", and "Vastu quadrants (Agneya, Nairutya, Vayavya, Eshanya)".

Structure your chat responses with:
- Bold names or line items.
- Bullet points for comparative breakdowns.
- Clear structural recommendations.
`;

    // Map conversation messages to Gemini's expected API format
    // Gemini expects contents: [{ role: 'user' | 'model', parts: [{ text: '...' }] }]
    // System instruction is passed separately or prefixed
    const contents = messages.map((m: ChatMessage) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const apiBody = {
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.4
      }
    };

    const correctUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const retryRes = await fetch(correctUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiBody),
    });

    if (!retryRes.ok) {
      const errText = await retryRes.text();
      throw new Error(`Gemini Chat API failed: ${retryRes.statusText} - ${errText}`);
    }

    const resultData = await retryRes.json();
    const replyText = resultData.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I encountered an issue processing that. Please try again.";
    
    return NextResponse.json({ content: replyText });
  } catch (error) {
    const err = error as Error;
    console.error('advisor-chat API error:', err);
    return NextResponse.json({ error: err.message || 'Failed to chat with advisor' }, { status: 500 });
  }
}
