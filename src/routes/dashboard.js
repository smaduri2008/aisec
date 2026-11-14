import { Router } from "express";
import { logger } from "../services/logger.js";
import { sendInstagramMessage } from "../services/instagram.js";
import { processDueTimers } from "../services/timerProcessor.js";
import {
  listConversations,
  getConversationById,
  markOwnerHandled,
  markResolved
} from "../repositories/conversationsRepo.js";
import { allMessages, insertMessage } from "../repositories/messageRepo.js";
import { getBusinessSettings, upsertBusinessSettings } from "../repositories/settingsRepo.js";

const router = Router();

// POST /api/check-timers — same work as the public cron endpoint
// (/jobs/check-timers), but reachable from the dashboard under auth so the
// "Check now" button doesn't have to call the unauthenticated cron route.
router.post("/check-timers", async (_req, res) => {
  try {
    const result = await processDueTimers();
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    logger.error("Manual check-timers failed:", err.message);
    res.status(500).json({ error: "Failed to run timer check" });
  }
});

// GET /api/conversations?status=awaiting_owner
router.get("/conversations", async (req, res) => {
  try {
    const { status } = req.query;
    const conversations = await listConversations({ status: status || undefined });
    res.status(200).json({ conversations });
  } catch (err) {
    logger.error("Failed to list conversations:", err.message);
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

// GET /api/conversations/:id
router.get("/conversations/:id", async (req, res) => {
  try {
    const conversation = await getConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    const messages = await allMessages(req.params.id);
    res.status(200).json({ conversation, messages });
  } catch (err) {
    logger.error("Failed to load conversation:", err.message);
    res.status(500).json({ error: "Failed to load conversation" });
  }
});

// POST /api/conversations/:id/reply  { message }
router.post("/conversations/:id/reply", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const conversation = await getConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const sent = await sendInstagramMessage({
      recipientId: conversation.platform_user_id,
      message
    });

    const saved = await insertMessage({
      conversationId: conversation.id,
      sender: "owner",
      content: message,
      platformMessageId: sent?.message_id || null
    });

    await markOwnerHandled(conversation.id);

    res.status(200).json({ ok: true, message: saved });
  } catch (err) {
    logger.error("Dashboard reply failed:", err.message);
    res.status(500).json({ error: "Failed to send reply" });
  }
});

// POST /api/conversations/:id/resolve
router.post("/conversations/:id/resolve", async (req, res) => {
  try {
    const conversation = await markResolved(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.status(200).json({ ok: true, conversation });
  } catch (err) {
    logger.error("Failed to resolve conversation:", err.message);
    res.status(500).json({ error: "Failed to resolve conversation" });
  }
});

// GET /api/settings
router.get("/settings", async (_req, res) => {
  try {
    const settings = await getBusinessSettings();
    res.status(200).json({ settings });
  } catch (err) {
    logger.error("Failed to load settings:", err.message);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// PUT /api/settings
router.put("/settings", async (req, res) => {
  try {
    const settings = await upsertBusinessSettings(req.body || {});
    res.status(200).json({ ok: true, settings });
  } catch (err) {
    logger.error("Failed to save settings:", err.message);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
