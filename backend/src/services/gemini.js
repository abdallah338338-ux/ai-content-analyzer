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

export async function answerSessionQuestion(session, previousMessages, message) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw { code: "GEMINI_KEY_MISSING", message: "GEMINI_API_KEY environment variable is not configured." };
  }

  const analysis = session.analysis || {};
  const conversation = previousMessages.map(({ role, content }) => ({ role, content }));
  const context = {
    source_url: session.source_url,
    source_type: session.source_type,
    title: session.title,
    overview: analysis.overview,
    key_points: analysis.key_points,
    timeline: analysis.timeline,
    speech_analysis: analysis.speech_analysis,
    visual_analysis: analysis.visual_analysis,
    structure: analysis.structure,
    evidence_notes: analysis.evidence_notes,
    entities: analysis.entities,
    uncertainties: analysis.uncertainties,
    previous_conversation: conversation,
  };

  const prompt = `You are answering a question about one analyzed content session. Answer primarily from the session context below. Do not invent facts, timestamps, or details absent from the context. If the context is insufficient, say so clearly. Use timestamps only when they appear in the provided timeline. Keep the answer natural and helpful.\n\nSession context:\n${JSON.stringify(context)}\n\nUser question:\n${message}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });
    const answer = response.text ? response.text.trim() : "";

    if (!answer) {
      throw { code: "GEMINI_REQUEST_FAILED", message: "Gemini returned an empty chat response." };
    }

    return answer;
  } catch (error) {
    console.error("[gemini] Error answering session question:", error.message || error);
    let safeMessage = error.message || "An error occurred while contacting Gemini API.";
    safeMessage = safeMessage.replaceAll(apiKey, "[REDACTED]");
    throw { code: error.code || "GEMINI_REQUEST_FAILED", message: safeMessage };
  }
}

export async function analyzeImage(buffer, mimeType, analysisMode = "full") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw { code: "GEMINI_KEY_MISSING", message: "GEMINI_API_KEY environment variable is not configured." };
  const prompt = `Analyze this image and return ONLY valid raw JSON with this schema: {"title":"","overview":"","key_points":[],"timeline":[],"speech_analysis":"","visual_analysis":"","structure":"","evidence_notes":[],"entities":[],"uncertainties":[]}. Focus only on visible elements, readable text, relationships, and uncertainty. Do not invent details or timestamps. Analysis mode: ${analysisMode}.`;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: buffer.toString("base64") } }] }],
    });
    let rawText = response.text ? response.text.trim() : "";
    if (rawText.startsWith("```")) rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return normalizeSchema(JSON.parse(rawText));
  } catch (error) {
    console.error("[gemini] Error analyzing image:", error.message || error);
    let safeMessage = (error.message || "Unable to analyze image.").replaceAll(apiKey, "[REDACTED]");
    if (error instanceof SyntaxError) throw { code: "IMAGE_ANALYSIS_FAILED", message: "Gemini returned invalid image analysis." };
    throw { code: error.code || "GEMINI_REQUEST_FAILED", message: safeMessage };
  }
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
      model: "gemini-3.6-flash",
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
