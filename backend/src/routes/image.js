import { Router } from "express";
import multer from "multer";
import { analyzeImage } from "../services/gemini.js";
import { supabase } from "../lib/supabaseClient.js";

const router = Router();
const BUCKET = "content-assets";
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, TYPES.has(file.mimetype)),
});

function error(res, status, code, message) {
  return res.status(status).json({ status: "error", code, message });
}

async function ensureBucket() {
  const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (createError && !/already exists/i.test(createError.message || "")) throw createError;
}

router.post("/api/analyze/image", upload.single("image"), async (req, res) => {
  const workspaceId = typeof req.body.workspace_id === "string" && req.body.workspace_id.trim()
    ? req.body.workspace_id.trim() : "main-workspace";
  const analysisMode = typeof req.body.analysis_mode === "string" ? req.body.analysis_mode : "full";
  const image = req.file;

  if (!image) return error(res, 400, "INVALID_IMAGE", "An image file is required.");
  if (!TYPES.has(image.mimetype)) return error(res, 415, "UNSUPPORTED_IMAGE_TYPE", "Only JPEG, PNG, and WebP images are supported.");
  if (!image.buffer?.length) return error(res, 400, "INVALID_IMAGE", "The uploaded image is empty.");
  if (image.size > MAX_BYTES) return error(res, 413, "IMAGE_TOO_LARGE", "Images must be 10 MB or smaller.");

  const extension = image.mimetype === "image/jpeg" ? "jpg" : image.mimetype.split("/")[1];
  let session;
  try {
    const { data, error: sessionError } = await supabase.from("content_sessions").insert({
      workspace_id: workspaceId,
      source_type: "image",
      status: "processing",
      analysis_mode: analysisMode,
      metadata: { mime_type: image.mimetype, file_name: image.originalname, size_bytes: image.size },
    }).select().single();
    if (sessionError) throw sessionError;
    session = data;

    await ensureBucket();
    const storagePath = session.id + "/original-image." + extension;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, image.buffer, {
      contentType: image.mimetype, upsert: false,
    });
    if (uploadError) throw Object.assign(uploadError, { code: "IMAGE_UPLOAD_FAILED" });

    const { data: asset, error: assetError } = await supabase.from("content_assets").insert({
      session_id: session.id,
      asset_type: "image",
      file_name: image.originalname,
      storage_path: storagePath,
      mime_type: image.mimetype,
      size_bytes: image.size,
    }).select().single();
    if (assetError) throw assetError;

    const analysis = await analyzeImage(image.buffer, image.mimetype, analysisMode);
    const title = analysis.title || "Image Analysis";
    const { data: completed, error: updateError } = await supabase.from("content_sessions").update({
      title, status: "completed", analysis,
    }).eq("id", session.id).select().single();
    if (updateError) throw updateError;
    return res.json({ status: "ok", session: completed, analysis, asset });
  } catch (caught) {
    console.error("[analyze/image]", caught.message || caught);
    if (session?.id) await supabase.from("content_sessions").update({ status: "failed" }).eq("id", session.id);
    return error(res, 500, caught.code || "IMAGE_ANALYSIS_FAILED", "Unable to analyze this image.");
  }
});

router.use((caught, _req, res, next) => {
  if (caught instanceof multer.MulterError && caught.code === "LIMIT_FILE_SIZE") return error(res, 413, "IMAGE_TOO_LARGE", "Images must be 10 MB or smaller.");
  return next(caught);
});

export default router;
