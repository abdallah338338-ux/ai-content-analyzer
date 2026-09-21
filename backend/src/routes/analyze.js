import { Router } from "express";
import fs from "fs";
import fsPromises from "fs/promises";
import os from "os";
import path from "path";
import { analyzeYouTubeVideo } from "../services/gemini.js";
import { isFacebookUrl, fetchFacebookOembed, fetchPublicFacebookVideo } from "../services/facebookOembed.js";
import { analyzeVideoFile } from "../services/gemini.js";
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

  // --- Facebook: try real public video analysis first; never fake an analysis ---
  if (isFacebookUrl(url)) {
    let tempVideoPath = null;

    try {
      const oembed = await fetchFacebookOembed(url);

      const resolved = await fetchPublicFacebookVideo(
        url,
        (body, meta) => writeResponseBodyToTempFile(body, meta)
      );

      tempVideoPath = resolved.filePath;

      const analysisResult = await analyzeVideoFile(
        tempVideoPath,
        resolved.mimeType,
        "facebook-video",
        analysis_mode
      );

      const sessionTitle = analysisResult.title || oembed.title || "Facebook Video";

      let sessionRecord = await persistSession({
        workspace_id,
        source_type: "facebook",
        url,
        title: sessionTitle,
        analysis_mode,
        analysisResult,
        metadata: {
          analyzed_at: new Date().toISOString(),
          provider_name: oembed.provider_name || "Facebook",
          facebook_resolution: "public-direct-media",
          resolved_mime_type: resolved.mimeType,
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

      return res.status(200).json({
        status: "ok",
        session: sessionRecord,
        analysis: analysisResult,
      });
    } catch (err) {
      console.error("[analyze/url:facebook] Error:", err);

      const fallbackCodes = new Set([
        "FACEBOOK_DIRECT_VIDEO_UNAVAILABLE",
        "FACEBOOK_VIDEO_DOWNLOAD_FAILED",
        "FACEBOOK_VIDEO_TOO_LARGE",
        "FACEBOOK_PAGE_UNAVAILABLE",
        "FACEBOOK_PAGE_UNREACHABLE",
      ]);

      return res.status(
        err.code === "FACEBOOK_OEMBED_UNREACHABLE" || err.code === "FACEBOOK_PAGE_UNREACHABLE"
          ? 502
          : fallbackCodes.has(err.code)
            ? 422
            : 400
      ).json({
        status: "error",
        code: err.code || "FACEBOOK_ANALYSIS_FAILED",
        message:
          err.message ||
          "Facebook full video analysis could not be completed. Upload the video file directly if the public page does not expose a processable video.",
      });
    } finally {
      if (tempVideoPath) {
        await fsPromises.unlink(tempVideoPath).catch(() => {});
      }
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
