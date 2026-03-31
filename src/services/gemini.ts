import { GoogleGenAI, Type } from "@google/genai";
import * as tf from '@tensorflow/tfjs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  af: 'Afrikaans',
  xh: 'IsiXhosa',
  zu: 'IsiZulu',
};

export async function generateWeeklyReport(stats: any, reports: any[], language = 'en') {
  const model = "gemini-3-flash-preview";

  const resolutionRate = stats.total > 0
    ? Math.round((stats.statusBreakdown['Resolved'] / stats.total) * 100)
    : 0;

  const recentSample = reports.slice(0, 25).map((r: any) => ({
    type: r.type,
    importance: r.importance,
    status: r.status,
    address: r.address || null,
    reportedAt: r.reportedAt,
  }));

  const today = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const langName = LANGUAGE_NAMES[language] ?? 'English';

  const prompt = `You are a senior municipal operations analyst for MuniLens, an AI-powered infrastructure monitoring platform. Today is ${today}.

IMPORTANT: You MUST write ALL text fields — headline, executiveSummary, riskRationale, all priorityActions titles/departments/timeframes/descriptions, all trendInsights titles/descriptions, and all recommendations — entirely in ${langName}. Do not use English unless ${langName} is English.

Analyze this real-time municipal fault report data and produce a concise, data-driven operational briefing:

STATISTICS:
- Total faults: ${stats.total}
- Resolution rate: ${resolutionRate}%
- Open: ${stats.statusBreakdown['Open']} | In Progress: ${stats.statusBreakdown['In Progress']} | Resolved: ${stats.statusBreakdown['Resolved']}
- Critical: ${stats.importanceBreakdown?.Critical || 0} | High: ${stats.importanceBreakdown?.High || 0} | Medium: ${stats.importanceBreakdown?.Medium || 0} | Low: ${stats.importanceBreakdown?.Low || 0}
- Fault type distribution: ${JSON.stringify(stats.typeData)}
- Top fault category: ${stats.topFault}
- Geographic centre (lat/lng): ${stats.avgLat.toFixed(4)}, ${stats.avgLng.toFixed(4)}

RECENT REPORTS SAMPLE (latest ${recentSample.length}):
${JSON.stringify(recentSample, null, 2)}

Be specific, reference actual numbers, and keep all text concise and actionable.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: {
            type: Type.STRING,
            description: "Concise impactful operational headline, max 12 words",
          },
          executiveSummary: {
            type: Type.STRING,
            description: "2-3 sentences summarising current infrastructure status using real numbers from the data",
          },
          riskLevel: {
            type: Type.STRING,
            enum: ['Critical', 'High', 'Medium', 'Low'],
            description: "Overall system risk level based on unresolved critical/high issues",
          },
          riskRationale: {
            type: Type.STRING,
            description: "One sentence explaining the risk level assessment",
          },
          priorityActions: {
            type: Type.ARRAY,
            description: "Top 3-4 priority actions ordered by urgency",
            items: {
              type: Type.OBJECT,
              properties: {
                priority: { type: Type.INTEGER },
                title: { type: Type.STRING },
                department: { type: Type.STRING },
                timeframe: { type: Type.STRING },
                description: { type: Type.STRING },
                importance: { type: Type.STRING, enum: ['Critical', 'High', 'Medium', 'Low'] },
              },
              required: ['priority', 'title', 'department', 'timeframe', 'description', 'importance'],
            },
          },
          trendInsights: {
            type: Type.ARRAY,
            description: "2-3 data-driven trend observations",
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['title', 'description'],
            },
          },
          recommendations: {
            type: Type.ARRAY,
            description: "4-5 concise strategic recommendations",
            items: { type: Type.STRING },
          },
        },
        required: ['headline', 'executiveSummary', 'riskLevel', 'riskRationale', 'priorityActions', 'trendInsights', 'recommendations'],
      },
    },
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch {
    return null;
  }
}

// ── Local TF.js Teachable Machine model ─────────────────────────────────────
const TM_MODEL_URL  = '/model/model.json';
const TM_IMAGE_SIZE = 224;

const TM_LABELS = [
  'Water leaks',
  'Pothole',
  'Pothole with water',
  'Electric infra damage',
  'Road cracks',
];

const TM_LABEL_MAP: Record<string, { category: string; importance: 'Critical' | 'High' | 'Medium' | 'Low'; routedTo: string; estimatedSolution: string }> = {
  'Water leaks': {
    category: 'Water Leaks',
    importance: 'High',
    routedTo: 'Water & Sanitation Department',
    estimatedSolution: '24-48 hours',
  },
  'Pothole': {
    category: 'Potholes',
    importance: 'Medium',
    routedTo: 'Department of Transportation',
    estimatedSolution: '3-5 business days',
  },
  'Pothole with water': {
    category: 'Potholes',
    importance: 'High',
    routedTo: 'Department of Transportation',
    estimatedSolution: '24-48 hours',
  },
  'Electric infra damage': {
    category: 'Electrical Infrastructure Damage',
    importance: 'Critical',
    routedTo: 'Department of Electricity and Energy',
    estimatedSolution: '24 hours',
  },
  'Road cracks': {
    category: 'Road Cracks',
    importance: 'Medium',
    routedTo: 'Department of Transportation',
    estimatedSolution: '5-7 business days',
  },
};

let _tmModel: tf.LayersModel | null = null;

async function getTmModel(): Promise<tf.LayersModel> {
  if (!_tmModel) {
    _tmModel = await tf.loadLayersModel(TM_MODEL_URL);
  }
  return _tmModel;
}

export async function classifyFault(base64Image: string) {
  try {
    const model = await getTmModel();

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image load failed'));
      el.src = `data:image/jpeg;base64,${base64Image}`;
    });

    const canvas = document.createElement('canvas');
    canvas.width  = TM_IMAGE_SIZE;
    canvas.height = TM_IMAGE_SIZE;
    canvas.getContext('2d')!.drawImage(img, 0, 0, TM_IMAGE_SIZE, TM_IMAGE_SIZE);

    const tensor = tf.browser
      .fromPixels(canvas)
      .toFloat()
      .div(127.5)
      .sub(1)
      .expandDims(0);

    const output = model.predict(tensor) as tf.Tensor;
    const probs  = await output.data();
    tensor.dispose();
    output.dispose();

    let maxIdx = 0;
    for (let i = 1; i < probs.length; i++) {
      if (probs[i] > probs[maxIdx]) maxIdx = i;
    }

    const topLabel = TM_LABELS[maxIdx];
    console.log('[MuniLens] Classification result:', topLabel, `(${(probs[maxIdx] * 100).toFixed(1)}% confidence)`);
    const result = TM_LABEL_MAP[topLabel] ?? {
      category: 'Other',
      importance: 'Medium' as const,
      routedTo: 'General Maintenance',
      estimatedSolution: 'TBD',
    };
    console.log('[MuniLens] Mapped to:', result);
    return result;
  } catch (err) {
    console.error('[MuniLens] Local model classification failed:', err);
    return { category: 'Other', importance: 'Medium' as const, routedTo: 'General Maintenance', estimatedSolution: 'TBD' };
  }
}
