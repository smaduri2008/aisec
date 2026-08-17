import { Router } from "express";
import { config } from "../config.js";
import { logger } from "../services/logger.js";
import { upsertClient } from "../repositories/clientRepo.js";
import {
  createConversation,
  getActiveConversation,
  markOwnerHandled,
  setAwaitingOwner
} from "../repositories/conversationsRepo.js";
import { insertMessage } from "../repositories/messageRepo.js";
import { sendInstagramMessage } from "../services/instagram.js";

const router = Router();

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function normalizeMessagingEvent(event) {
  const senderId = firstString(event?.sender?.id);
  const text = firstString(event?.message?.text);
  const mid = firstString(event?.message?.mid);

  return {
    senderId,
    text,
    mid,
    username: null,
    source: "entry.messaging"
  };
}

function normalizeChangeEvent(change) {
  if (change?.field !== "messages") {
    return null;
  }

  const value = change?.value || {};
  const firstMessage = Array.isArray(value?.messages) ? value.messages[0] : null;

  const senderId = firstString(
    value?.from?.id,
    value?.sender?.id,
    firstMessage?.from,
    firstMessage?.sender?.id
  );

  const text = firstString(
    value?.text,
    value?.message?.text,
    firstMessage?.text?.body,
    firstMessage?.text
  );

  const mid = firstString(
    value?.mid,
    value?.message?.mid,
    firstMessage?.id,
    firstMessage?.mid
  );

  return {
    senderId,
    text,
    mid,
    username: firstString(value?.from?.username, value?.sender?.username),
    source: "entry.changes"
  };
}

function extractMetaEvents(body) {
  const normalized = [];
  const skipped = [];
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  let messagingCount = 0;
  let changesCount = 0;

  for (const entry of entries) {
    const messagingEvents = Array.isArray(entry?.messaging) ? entry.messaging : [];
    messagingCount += messagingEvents.length;
    for (const event of messagingEvents) {
      const candidate = normalizeMessagingEvent(event);
      if (candidate?.senderId && candidate?.text) {
        normalized.push(candidate);
      } else {
        skipped.push({ source: "entry.messaging", reason: "non_message_or_missing_sender" });
      }
    }

    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    changesCount += changes.length;
    for (const change of changes) {
      const candidate = normalizeChangeEvent(change);
      if (!candidate) {
        skipped.push({ source: "entry.changes", reason: "unsupported_field" });
        continue;
      }

      if (candidate.senderId && candidate.text) {
        normalized.push(candidate);
      } else {
        skipped.push({ source: "entry.changes", reason: "non_message_or_missing_sender" });
      }
    }
  }

  return {
    events: normalized,
    skipped,
    summary: {
      object: body?.object || null,
      entryCount: entries.length,
      messagingCount,
      changesCount
    }
  };
}

function logWebhook(event, details) {
  logger.info(`[meta-webhook] ${event}`, JSON.stringify(details));
}

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
  const body = req.body;
  logWebhook("request_hit", {
    method: req.method,
    path: req.path,
    hasBody: !!body,
    bodyType: typeof body
  });

  try {
    if (!body?.entry || !Array.isArray(body.entry)) {
      logWebhook("payload_ignored", { reason: "No entry array", object: body?.object || null });
      return res.status(200).json({ ignored: true, reason: "No entry array" });
    }

    const { events, skipped, summary } = extractMetaEvents(body);
    logWebhook("payload_summary", {
      ...summary,
      normalizedEventCount: events.length,
      skippedCount: skipped.length
    });

    let processed = 0;
    let errors = 0;

    for (const event of events) {
      try {
        const client = await upsertClient({
          platform: "instagram",
          platformUserId: event.senderId,
          name: event.username
        });

        let conversation = await getActiveConversation(client.id, "instagram");
        if (!conversation) {
          conversation = await createConversation(client.id, "instagram");
        }

        await insertMessage({
          conversationId: conversation.id,
          sender: "client",
          content: event.text,
          platformMessageId: event.mid || null
        });

        await setAwaitingOwner(conversation.id, config.replyDelayMinutes);
        processed += 1;
      } catch (eventError) {
        errors += 1;
        logger.error(
          "[meta-webhook] event_processing_error",
          JSON.stringify({
            source: event.source,
            senderId: event.senderId || null,
            mid: event.mid || null,
            message: eventError.message
          })
        );
      }
    }

    logWebhook("processing_complete", {
      ...summary,
      processedCount: processed,
      skippedCount: skipped.length,
      errorCount: errors
    });

    return res.status(200).json({
      ok: true,
      processedCount: processed,
      skippedCount: skipped.length,
      errorCount: errors
    });
  } catch (err) {
    logger.error("Meta webhook processing error:", err.message);
    return res.status(200).json({ ok: false, error: "Webhook processing failed" });
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