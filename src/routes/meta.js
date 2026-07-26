import { Router } from "express";
import { config } from "../config.js";
import { logger } from "../services/logger.js";
import { upsertClient } from "../repositories/clientsRepo.js";
import {
  createConversation,
  getActiveConversation,
  markOwnerHandled,
  setAwaitingOwner
} from "../repositories/conversationsRepo.js";
import { insertMessage } from "../repositories/messagesRepo.js";
import { sendInstagramMessage } from "../services/instagram.js";

const router = Router();

/**
 * Meta webhook verification
 */
router.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.meta.webhookVerifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * Stub for App Review requirement: message deletions handling.
 */
router.post("/webhooks/meta/message-deletions", (req, res) => {
  logger.info("Received message deletion webhook payload:", JSON.stringify(req.body));
  return res.status(200).json({ ok: true });
});

/**
 * Instagram webhook receiver
 * Handles inbound messaging events and starts/refreshes reply timer.
 */
router.post("/webhooks/meta", async (req, res) => {
  try {
    const body = req.body;

    if (!body?.entry || !Array.isArray(body.entry)) {
      return res.status(200).json({ ignored: true, reason: "No entry array" });
    }

    for (const entry of body.entry) {
      const events = entry.messaging || [];
      for (const event of events) {
        const senderId = event?.sender?.id;
        const text = event?.message?.text;
        const mid = event?.message?.mid;

        // Skip non-message or echo/system events
        if (!senderId || !text) continue;

        const client = await upsertClient({
          platform: "instagram",
          platformUserId: senderId,
          name: null
        });

        let conversation = await getActiveConversation(client.id, "instagram");
        if (!conversation) {
          conversation = await createConversation(client.id, "instagram");
        }

        await insertMessage({
          conversationId: conversation.id,
          sender: "client",
          content: text,
          platformMessageId: mid || null
        });

        await setAwaitingOwner(conversation.id, config.replyDelayMinutes);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error("Meta webhook processing error:", err.message);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

/**
 * Manual owner send endpoint (used later by dashboard).
 * Sending owner reply also cancels timer and marks owner-handled.
 */
router.post("/messages/send-owner", async (req, res) => {
  try {
    const { conversationId, recipientPlatformUserId, message } = req.body;

    if (!conversationId || !recipientPlatformUserId || !message) {
      return res.status(400).json({
        error: "conversationId, recipientPlatformUserId, message are required"
      });
    }

    const sent = await sendInstagramMessage({
      recipientId: recipientPlatformUserId,
      message
    });

    await insertMessage({
      conversationId,
      sender: "owner",
      content: message,
      platformMessageId: sent?.message_id || null
    });

    await markOwnerHandled(conversationId);

    return res.status(200).json({ ok: true, sent });
  } catch (err) {
    logger.error("Owner send failed:", err.message);
    return res.status(500).json({ error: "Failed to send owner message" });
  }
});

export default router;