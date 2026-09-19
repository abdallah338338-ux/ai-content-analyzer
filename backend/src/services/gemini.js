import { GoogleGenAI } from "@google/genai";

function normalizeSchema(data) {
  return {
    title: typeof data.title === "string" ? data.title : "YouTube Video Analysis",
    overview: typeof data.overview === "string" ? data.overview : "",
    key_points: Array.isArray(data.key_points) ? data.key_points : [],
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
    speech_analysis: typeof data.speech_analysis === "string" ? data.speech_analysis : "",
    visual_analysis: typeof data.visual_analysis === "string" ? data.visual_analysis : "",
    structure: typeof data.structure === "string" ? data.structure : "",
    evidence_notes: Array.isArray(data.evidence_notes) ? data.evidence_notes : [],
    entities: Array.isArray(data.entities) ? data.entities : [],
    uncertainties: Array.isArray(data.uncertainties) ? data.uncertainties : [],
  };
}

export async function analyzeYouTubeVideo(url, analysisMode = "full") {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw {
      code: "GEMINI_KEY_MISSING",
      message: "GEMINI_API_KEY environment variable is not configured.",
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Analyze the public YouTube video at this URL: ${url}

Please provide a detailed, structured analysis matching this JSON format:
{
  "title": "Video Title or concise main subject",
  "overview": "Comprehensive overview summary of the video content",
  "key_points": [
    "Key point 1",
    "Key point 2"
  ],
  "timeline": [
    {
      "start": "00:00",
      "end": "01:30",
      "topic": "Topic title",
      "summary": "Summary of this timestamp range"
    }
  ],
  "speech_analysis": "Analysis of spoken content, key audio dialogues or narration",
  "visual_analysis": "Analysis of key visual elements, scenes, graphics, or text shown",
  "structure": "Structural breakdown of the video progression",
  "evidence_notes": [
    "Key factual evidence or data point mentioned"
  ],
  "entities": [
    "Important person, organization, or topic entity mentioned"
  ],
  "uncertainties": []
}

Analysis mode requested: ${analysisMode}.
IMPORTANT: Respond ONLY with valid raw JSON. Do not include markdown code fence formatting (no \`\`\`json).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    let rawText = response.text ? response.text.trim() : "";
    
    // Clean markdown code blocks if present
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const parsedAnalysis = JSON.parse(rawText);
    return normalizeSchema(parsedAnalysis);
  } catch (error) {
    console.error("[gemini] Error analyzing YouTube video:", error.message || error);

    let safeMessage = error.message || "An error occurred while contacting Gemini API.";
    if (apiKey) {
      safeMessage = safeMessage.replaceAll(apiKey, "[REDACTED]");
    }

    if (error instanceof SyntaxError) {
      throw {
        code: "GEMINI_INVALID_RESPONSE",
        message: "Failed to parse structured JSON response from Gemini model.",
      };
    }

    throw {
      code: error.code || "GEMINI_ERROR",
      message: safeMessage,
    };
  }
}
