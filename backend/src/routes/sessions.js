import { Router } from "express";
import { answerSessionQuestion } from "../services/gemini.js";
import { supabase } from "../lib/supabaseClient.js";

const router = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_WORKSPACE_ID = "main-workspace";
const MESSAGE_LIMIT = 20;

function isValidSessionId(sessionId) {
  return typeof sessionId === "string" && UUID_PATTERN.test(sessionId);
}

function databaseError(res, error) {
  console.error("[sessions] Database error:", error?.message || error);
  return res.status(500).json({ status: "error", code: "DATABASE_ERROR", message: "Unable to access session data." });
}

async function loadSession(sessionId) {
  return supabase
    .from("content_sessions")
    .select("id, workspace_id, source_type, source_url, title, status, analysis_mode, analysis, metadata, created_at, updated_at")
    .eq("id", sessionId)
    .maybeSingle();
}

function invalidSession(res) {
  return res.status(400).json({ status: "error", code: "INVALID_SESSION_ID", message: "A valid session ID is required." });
}

// If a workspace_id was supplied by the caller, the loaded session must
// belong to it — otherwise treat it as not found rather than leaking that
// a session with this ID exists in someone else's workspace.
function belongsToWorkspace(session, requestedWorkspaceId) {
  if (!requestedWorkspaceId) return true; // not scoped by this caller — allow (back-compat)
  return session.workspace_id === requestedWorkspaceId;
}

router.get("/api/sessions", async (req, res) => {
  const workspaceId = typeof req.query.workspace_id === "string" && req.query.workspace_id.trim()
    ? req.query.workspace_id.trim()
    : DEFAULT_WORKSPACE_ID;

  const { data, error } = await supabase
    .from("content_sessions")
    .select("id, workspace_id, source_type, source_url, title, status, analysis_mode, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) return databaseError(res, error);
  return res.json({ status: "ok", sessions: data || [] });
});

router.get("/api/sessions/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  if (!isValidSessionId(sessionId)) return invalidSession(res);

  const { data, error } = await loadSession(sessionId);
  if (error) return databaseError(res, error);
  if (!data || !belongsToWorkspace(data, req.query.workspace_id)) {
    return res.status(404).json({ status: "error", code: "SESSION_NOT_FOUND", message: "Session not found." });
  }
  return res.json({ status: "ok", session: data, analysis: data.analysis || {} });
});

router.get("/api/sessions/:sessionId/messages", async (req, res) => {
  const { sessionId } = req.params;
  if (!isValidSessionId(sessionId)) return invalidSession(res);

  const { data: session, error: sessionError } = await loadSession(sessionId);
  if (sessionError) return databaseError(res, sessionError);
  if (!session || !belongsToWorkspace(session, req.query.workspace_id)) {
    return res.status(404).json({ status: "error", code: "SESSION_NOT_FOUND", message: "Session not found." });
  }

  const { data, error } = await supabase
    .from("content_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) return databaseError(res, error);
  return res.json({ status: "ok", session_id: sessionId, messages: data || [] });
});

router.post("/api/sessions/:sessionId/chat", async (req, res) => {
  const { sessionId } = req.params;
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!isValidSessionId(sessionId)) return invalidSession(res);
  if (!message) return res.status(400).json({ status: "error", code: "INVALID_MESSAGE", message: "A non-empty message is required." });

  const { data: session, error: sessionError } = await loadSession(sessionId);
  if (sessionError) return databaseError(res, sessionError);
  if (!session || !belongsToWorkspace(session, req.body?.workspace_id)) {
    return res.status(404).json({ status: "error", code: "SESSION_NOT_FOUND", message: "Session not found." });
  }

  const { data: previousMessages, error: messagesError } = await supabase
    .from("content_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_LIMIT);
  if (messagesError) return databaseError(res, messagesError);

  const { error: userSaveError } = await supabase
    .from("content_messages")
    .insert({ session_id: sessionId, role: "user", content: message });
  if (userSaveError) return databaseError(res, userSaveError);

  let answer;
  try {
    answer = await answerSessionQuestion(session, (previousMessages || []).reverse(), message);
  } catch (error) {
    console.error("[sessions] Chat error:", error.message || error);
    return res.status(502).json({ status: "error", code: error.code || "CHAT_FAILED", message: error.message || "Unable to generate a chat response." });
  }

  const { data: assistantMessage, error: saveError } = await supabase
    .from("content_messages")
    .insert({ session_id: sessionId, role: "assistant", content: answer })
    .select("id, role, content, created_at")
    .single();
  if (saveError) return databaseError(res, saveError);

  if (!assistantMessage) return res.status(500).json({ status: "error", code: "DATABASE_ERROR", message: "Unable to save the chat response." });
  return res.json({ status: "ok", session_id: sessionId, message: assistantMessage });
});

export default router;