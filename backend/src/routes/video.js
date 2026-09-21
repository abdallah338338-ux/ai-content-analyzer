import { Router } from "express";
import multer from "multer";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { analyzeVideoFile } from "../services/gemini.js";
import { supabase } from "../lib/supabaseClient.js";

const router = Router();

// Free Render is a 512 MB instance with an ephemeral filesystem.
// We therefore process videos temporarily and do NOT persist raw video files
// in Supabase Storage. The Gemini File API accepts much larger files, but this
// free deployment intentionally keeps the practical upload cap lower.
const MAX_BYTES = 150 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/mpeg",
  "video/ogg",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => {
      const safeExt = path.extname(file.originalname || "").toLowerCase().slice(0, 10);
      cb(null, `aica-${Date.now()}-${crypto.randomUUID()}${safeExt}`);
    },
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_TYPES.has(file.mimetype)),
});

function error(res, status, code, message) {
  return res.status(status).json({ status: "error", code, message });
}

router.post("/api/analyze/video", upload.single("video"), async (req, res) => {
  const workspaceId =
    typeof req.body?.workspace_id === "string" && req.body.workspace_id.trim()
      ? req.body.workspace_id.trim()
      : "main-workspace";
  const analysisMode =
    typeof req.body?.analysis_mode === "string" && req.body.analysis_mode.trim()
      ? req.body.analysis_mode.trim()
      : "full";
  const video = req.file;

  if (!video) {
    return error(
      res,
      400,
      "INVALID_VIDEO",
      "A video file is required. Use MP4, WebM, MOV, MPEG, MKV, or OGG."
    );
  }

  if (!ALLOWED_TYPES.has(video.mimetype)) {
    await fs.unlink(video.path).catch(() => {});
    return error(
      res,
      415,
      "UNSUPPORTED_VIDEO_TYPE",
      "Supported video formats: MP4, WebM, MOV, MPEG, MKV, and OGG."
    );
  }

  if (!video.size) {
    await fs.unlink(video.path).catch(() => {});
    return error(res, 400, "INVALID_VIDEO", "The uploaded video is empty.");
  }

  let session = null;

  try {
    const { data, error: sessionError } = await supabase
      .from("content_sessions")
      .insert({
        workspace_id: workspaceId,
        source_type: "video",
        status: "processing",
        analysis_mode: analysisMode,
        metadata: {
          mime_type: video.mimetype,
          file_name: video.originalname,
          size_bytes: video.size,
          storage: "temporary-render-filesystem",
          persisted_raw_video: false,
        },
      })
      .select()
      .single();

    if (sessionError) throw sessionError;
    session = data;

    const analysis = await analyzeVideoFile(
      video.path,
      video.mimetype,
      video.originalname,
      analysisMode
    );

    const title = analysis.title || video.originalname || "Video Analysis";

    const { data: asset, error: assetError } = await supabase
      .from("content_assets")
      .insert({
        session_id: session.id,
        asset_type: "video",
        file_name: video.originalname,
        storage_path: null,
        mime_type: video.mimetype,
        size_bytes: video.size,
        public_url: null,
      })
      .select()
      .single();

    if (assetError) throw assetError;

    const { data: completed, error: updateError } = await supabase
      .from("content_sessions")
      .update({
        title,
        status: "completed",
        analysis,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.json({
      status: "ok",
      session: completed,
      analysis,
      asset,
    });
  } catch (caught) {
    console.error("[analyze/video]", caught?.message || caught);

    if (session?.id) {
      await supabase
        .from("content_sessions")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);
    }

    return error(
      res,
      500,
      caught?.code || "VIDEO_ANALYSIS_FAILED",
      caught?.message || "Unable to analyze this video."
    );
  } finally {
    await fs.unlink(video.path).catch(() => {});
  }
});

router.use((caught, _req, res, next) => {
  if (caught instanceof multer.MulterError) {
    if (caught.code === "LIMIT_FILE_SIZE") {
      return error(
        res,
        413,
        "VIDEO_TOO_LARGE",
        "For the free deployment, uploaded videos are limited to 150 MB."
      );
    }
    return error(res, 400, "VIDEO_UPLOAD_FAILED", caught.message);
  }
  return next(caught);
});

export default router;
