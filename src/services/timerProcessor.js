import { logger } from "./logger.js";
import { generateReply } from "./gemini.js";
import { sendInstagramMessage } from "./instagram.js";
import { getBusinessSettings } from "../repositories/settingsRepo.js";
import {
  dueConversations,
  lockDueConversation,
  markAiHandled
} from "../repositories/conversationsRepo.js";
import { recentMessages, insertMessage } from "../repositories/messagesRepo.js";
import { getClientById } from "../repositories/clientsRepo.js";

const FALLBACK_REPLY = "Thanks for reaching out — we’ll get back to you shortly.";

export async function processDueTimers() {
  const due = await dueConversations(50);
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const convo of due) {
    try {
      const locked = await lockDueConversation(convo.id);
      if (!locked) {
        skipped++;
        continue;
      }

      const client = await getClientById(convo.client_id);
      if (!client) {
        skipped++;
        continue;
      }

      const history = await recentMessages(convo.id, 20);
      const settings = await getBusinessSettings();

      let replyText = FALLBACK_REPLY;
      try {
        replyText = await generateReply({
          businessSettings: settings,
          clientName: client.name,
          history
        });
      } catch (aiErr) {
        logger.error("AI generation failed. Using fallback.", aiErr.message);
      }

      const sendResult = await sendInstagramMessage({
        recipientId: client.platform_user_id,
        message: replyText
      });

      await insertMessage({
        conversationId: convo.id,
        sender: "ai",
        content: replyText,
        platformMessageId: sendResult?.message_id || null
      });

      await markAiHandled(convo.id);
      processed++;
    } catch (err) {
      failed++;
      logger.error("Timer process failed for conversation:", convo.id, err.message);
    }
  }

  return {
    dueCount: due.length,
    processed,
    skipped,
    failed
  };
}