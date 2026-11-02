import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

export const ACTIVE_GEMINI_MODEL = "gemini-3.8-flash";

/**
 * Validates the Gemini API connection and model availability
 */
export async function testGeminiConnection(): Promise<{
  available: boolean;
  model: string;
  latencyMs: number;
  message: string;
}> {
  const startTime = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        available: false,
        model: ACTIVE_GEMINI_MODEL,
        latencyMs: 0,
        message: "GEMINI_API_KEY is not configured in server environment.",
      };
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: ACTIVE_GEMINI_MODEL,
      contents: "Reply with the word 'OK' only.",
    });

    const latencyMs = Date.now() - startTime;
    const text = response.text?.trim() || "";

    if (text.includes("OK") || text.length > 0) {
      return {
        available: true,
        model: ACTIVE_GEMINI_MODEL,
        latencyMs,
        message: `Model ${ACTIVE_GEMINI_MODEL} is active and verified (${latencyMs}ms).`,
      };
    }

    return {
      available: false,
      model: ACTIVE_GEMINI_MODEL,
      latencyMs,
      message: "Unexpected response from Gemini API.",
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return {
      available: false,
      model: ACTIVE_GEMINI_MODEL,
      latencyMs,
      message: error?.message || "Failed to connect to Gemini API.",
    };
  }
}
