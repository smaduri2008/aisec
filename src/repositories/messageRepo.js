import { query } from "../db/client.js";

export async function insertMessage({ conversationId, sender, content, platformMessageId }) {
  const res = await query(
    `INSERT INTO messages (conversation_id, sender, content, platform_message_id, sent_at)
     VALUES ($1,$2,$3,$4,NOW())
     RETURNING *`,
    [conversationId, sender, content, platformMessageId || null]
  );
  return res.rows[0];
}

export async function recentMessages(conversationId, limit = 20) {
  const res = await query(
    `SELECT sender, content, sent_at
     FROM messages
     WHERE conversation_id=$1
     ORDER BY sent_at DESC
     LIMIT $2`,
    [conversationId, limit]
  );
  return res.rows.reverse();
}