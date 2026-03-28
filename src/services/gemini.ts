import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export async function generateWeeklyReport(stats: any) {
  const model = "gemini-3-flash-preview";
  const prompt = `
    You are a municipal services analyst for MuniLens. Based on this week's fault report data:
    - Total faults reported: ${stats.total}
    - Most common fault: ${stats.topFault}
    - Hotspot area (lat/lng avg): ${stats.avgLat}, ${stats.avgLng}
    - Status breakdown: ${JSON.stringify(stats.statusBreakdown)}

    Write a professional 1-page summary with key insights, trends, and recommended priority actions for the municipality.
    Format the output in Markdown.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
}

export async function classifyFault(base64Image: string) {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Analyze this photo of a municipal infrastructure fault. 
    1. Determine the category (Pothole, Water Leak, Electrical Damage, Broken Streetlight, Illegal Dumping, or Other).
    2. Assess the Importance Level (Critical, High, Medium, Low) based on the visual evidence:
       - Critical: Immediate danger to life, major property damage, or total service outage (e.g., massive sinkhole, gushing water main, exposed high-voltage wires).
       - High: Significant disruption or potential for rapid worsening (e.g., large pothole on main road, steady water leak).
       - Medium: Noticeable issue but not immediately dangerous (e.g., small pothole, dripping pipe).
       - Low: Minor aesthetic or non-urgent issue.
    3. Route to the correct department:
       - Water Leaks -> "Water & Sanitation Department"
       - Electrical Damage / Outages -> "Department of Electricity and Energy"
       - Potholes / Road Damage -> "Department of Transportation"
       - Others -> Route to the most appropriate municipal department.
    4. Provide an estimated solution timeframe (e.g., "24-48 hours", "3-5 business days").
  `;

  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Image,
    },
  };

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }, imagePart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          importance: { type: Type.STRING, enum: ['Critical', 'High', 'Medium', 'Low'] },
          routedTo: { type: Type.STRING, description: "The municipal department responsible for this fault" },
          estimatedSolution: { type: Type.STRING, description: "Estimated time to resolve the issue" },
        },
        required: ['category', 'importance', 'routedTo', 'estimatedSolution'],
      },
    },
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (err) {
    return { category: "Other", importance: "Medium", routedTo: "General Maintenance", estimatedSolution: "TBD" };
  }
}
