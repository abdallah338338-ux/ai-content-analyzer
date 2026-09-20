import { Router } from "express";
import { analyzeYouTubeVideo } from "../services/gemini.js";
import { isFacebookUrl, fetchFacebookOembed, buildFacebookAnalysis } from "../services/facebookOembed.js";
import { supabase } from "../lib/supabaseClient.js";

const router = Router();

// Helper to validate YouTube URL format
function isYouTubeUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host.includes("youtube.com") ||
      host.includes("youtu.be")
    );
  } catch {
    return false;
  }
}

async function persistSession({ workspace_id, source_type, url, title, analysis_mode, analysisResult, metadata }) {
  try {
    const { data, error: dbError } = await supabase
      .from("content_sessions")
      .insert({
        workspace_id,
        source_type,
        source_url: url,
        title,
        status: "completed",
        analysis_mode,
        analysis: analysisResult,
        metadata: metadata || { analyzed_at: new Date().toISOString() },
      })
      .select()
      .single();

    if (dbError) {
      console.warn("[supabase] Session save warning:", dbError.message);
      return null;
    }
    return data;
  } catch (dbErr) {
    console.warn("[supabase] Exception during insert:", dbErr.message);
    return null;
  }
}

router.post("/api/analyze/url", async (req, res) => {
  const { url, analysis_mode = "full", workspace_id = "main-workspace" } = req.body || {};

  if (!url) {
    return res.status(400).json({
      status: "error",
      code: "INVALID_URL",
      message: "URL parameter is required in request body.",
    });
  }

  // --- Facebook: metadata-only via official tokenless oEmbed API ---
  if (isFacebookUrl(url)) {
    try {
      const oembed = await fetchFacebookOembed(url);
      const analysisResult = buildFacebookAnalysis(oembed, url);
      const sessionTitle = analysisResult.title;

      let sessionRecord = await persistSession({
        workspace_id,
        source_type: "facebook",
        url,
        title: sessionTitle,
        analysis_mode,
        analysisResult,
        metadata: {
          analyzed_at: new Date().toISOString(),
          oembed_html: oembed.html || null,
          provider_name: oembed.provider_name || "Facebook",
        },
      });

      if (!sessionRecord) {
        sessionRecord = {
          id: "temp_" + Date.now(),
          workspace_id,
          source_type: "facebook",
          source_url: url,
          title: sessionTitle,
          status: "completed",
          analysis_mode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      return res.status(200).json({ status: "ok", session: sessionRecord, analysis: analysisResult });
    } catch (err) {
      console.error("[analyze/url:facebook] Error:", err);
      return res.status(err.code === "FACEBOOK_OEMBED_UNREACHABLE" ? 502 : 400).json({
        status: "error",
        code: err.code || "FACEBOOK_OEMBED_FAILED",
        message: err.message || "Unable to fetch this Facebook link's metadata.",
      });
    }
  }

  if (!isYouTubeUrl(url)) {
    return res.status(400).json({
      status: "error",
      code: "UNSUPPORTED_SOURCE",
      message: "Only public YouTube and Facebook URLs are supported.",
    });
  }

  try {
    // 1. Analyze video with Gemini server-side
    const analysisResult = await analyzeYouTubeVideo(url, analysis_mode);

    const sessionTitle = analysisResult.title || "YouTube Video Analysis";

    // 2. Persist session into Supabase content_sessions
    let sessionRecord = await persistSession({
      workspace_id,
      source_type: "youtube",
      url,
      title: sessionTitle,
      analysis_mode,
      analysisResult,
    });

    // Fallback session object if Supabase env vars are missing or DB unavailable
    if (!sessionRecord) {
      sessionRecord = {
        id: "temp_" + Date.now(),
        workspace_id,
        source_type: "youtube",
        source_url: url,
        title: sessionTitle,
        status: "completed",
        analysis_mode,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return res.status(200).json({
      status: "ok",
      session: sessionRecord,
      analysis: analysisResult,
    });
  } catch (err) {
    console.error("[analyze/url] Error:", err);
    return res.status(500).json({
      status: "error",
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "An unexpected error occurred during analysis.",
    });
  }
});

export default router;
