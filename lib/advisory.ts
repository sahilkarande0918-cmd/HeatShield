import { GoogleGenAI } from '@google/genai';
import { riskBand } from './risk';

/**
 * Turning a cell's numbers into something a ward officer could actually send.
 *
 * Two rules shape everything here. The model is given the numbers and told not
 * to invent any others — a fabricated temperature in a public heat advisory is
 * worse than no advisory. And every response is labelled with what produced it,
 * so a templated fallback is never mistaken for a drafted one.
 */

// gemini-2.5-flash is closed to new API keys; 3.6-flash is the current cheap,
// fast model and is what the free tier issues access to.
const MODEL = 'gemini-3.6-flash';

export type AdvisoryInput = {
  cityName: string;
  areaName: string;
  risk: number;
  feelsLikeC: number;
  regionalC: number;
  population: number;
  greenCover: number;
  validAt: Date;
  simulated: boolean;
  /** Distance to the closest existing water point, km, if any is mapped. */
  nearestReliefKm: number | null;
};

export type Advisory = { body: string; source: 'gemini' | 'template' };

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

function timeLabel(d: Date) {
  return d.toLocaleString('en-IN', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function buildPrompt(i: AdvisoryInput): string {
  const band = riskBand(i.risk);
  return [
    'You are drafting a public heat advisory for a municipal ward officer in India.',
    'They will forward it to community health workers, anganwadi staff and local WhatsApp groups.',
    '',
    'FACTS (use only these numbers; do not invent, estimate or add any others):',
    `- Area: ${i.areaName}, ${i.cityName}`,
    `- Valid for: ${timeLabel(i.validAt)} IST`,
    `- Heat risk: ${band.label} (${i.risk.toFixed(0)} out of 100)`,
    `- Feels like in this area: ${i.feelsLikeC.toFixed(1)} °C`,
    `- Regional forecast: ${i.regionalC.toFixed(1)} °C, so this area runs ${(i.feelsLikeC - i.regionalC).toFixed(1)} °C hotter`,
    `- People living here: about ${fmt(i.population)}`,
    `- Tree and park cover: ${(i.greenCover * 100).toFixed(0)}% of the area`,
    i.nearestReliefKm === null
      ? '- No public drinking water point is mapped within reach of this area'
      : `- Nearest mapped public water point: ${i.nearestReliefKm.toFixed(1)} km away`,
    '',
    'WRITE:',
    '- 90 to 130 words, plain English at a Class 8 reading level.',
    '- Start with the area name and how hot it will feel. No greeting, no sign-off, no subject line.',
    '- Name who is most at risk here specifically: outdoor workers, the elderly, infants, pregnant women.',
    '- Give three concrete actions the ward can take today. Be specific to the facts above.',
    '- If relief is far away or cover is low, say so plainly.',
    '- No emoji. No markdown. No bullet characters. Continuous prose in two or three short paragraphs.',
    '- Do not claim this is an official IMD or government warning.',
    i.simulated
      ? '- This is a simulated scenario, not a real forecast. Do not reference that fact in the text; it is labelled separately in the interface.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Deterministic fallback. Used when no API key is configured or the model call
 * fails; the caller surfaces `source` so the interface can say which is which.
 * It is intentionally plain rather than trying to imitate drafted prose.
 */
export function templateAdvisory(i: AdvisoryInput): Advisory {
  const band = riskBand(i.risk);
  const delta = (i.feelsLikeC - i.regionalC).toFixed(1);
  const relief =
    i.nearestReliefKm === null
      ? 'No public drinking water point is mapped near this area, so water will have to be brought in.'
      : `The nearest mapped public water point is about ${i.nearestReliefKm.toFixed(1)} km away.`;

  return {
    source: 'template',
    body: [
      `${i.areaName}, ${i.cityName}: heat risk is ${band.label.toUpperCase()} for ${timeLabel(i.validAt)} IST. ` +
        `Conditions here will feel like ${i.feelsLikeC.toFixed(1)} °C, about ${delta} °C above the regional forecast of ${i.regionalC.toFixed(1)} °C, ` +
        `because this area is densely built with ${(i.greenCover * 100).toFixed(0)}% tree and park cover. Around ${fmt(i.population)} people live here.`,
      `${band.meaning} Outdoor workers, the elderly, infants and pregnant women are most at risk. ${relief}`,
      `Actions today: arrange shaded rest and drinking water for outdoor workers between 12 pm and 4 pm; ` +
        `ask health workers to check on elderly residents living alone; keep ORS stocked at the nearest health post.`,
    ].join('\n\n'),
  };
}

export async function generateAdvisory(i: AdvisoryInput, apiKey?: string): Promise<Advisory> {
  if (!apiKey) return templateAdvisory(i);
  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(i),
    });
    const body = res.text?.trim();
    if (!body) throw new Error('empty response');
    return { body, source: 'gemini' };
  } catch (err) {
    console.error('[advisory] Gemini call failed, using template:', err);
    return templateAdvisory(i);
  }
}
