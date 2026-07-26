import { query } from "../db/client.js";

export async function getActiveConversation(clientId, platform) {
  const res = await query(
    `SELECT * FROM conversations
     WHERE client_id = $1
       AND platform = $2
       AND status != 'resolved'
     ORDER BY last_message_at DESC NULLS LAST
     LIMIT 1`,
    [clientId, platform]
  );
  return res.rows[0] || null;
}

export async function createConversation(clientId, platform) {
  const res = await query(
    `INSERT INTO conversations (client_id, platform, status, last_message_at)
     VALUES ($1,$2,'awaiting_owner',NOW())
     RETURNING *`,
    [clientId, platform]
  );
  return res.rows[0];
}

export async function setAwaitingOwner(conversationId, minutes) {
  await query(
    `UPDATE conversations
     SET status='awaiting_owner',
         reply_due_at = NOW() + ($2::text || ' minutes')::interval,
         last_message_at = NOW()
     WHERE id=$1`,
    [conversationId, String(minutes)]
  );
}

export async function markOwnerHandled(conversationId) {
  await query(
    `UPDATE conversations
     SET status='owner_handled',
         reply_due_at=NULL,
         last_message_at=NOW()
     WHERE id=$1`,
    [conversationId]
  );
}

export async function markAiHandled(conversationId) {
  await query(
    `UPDATE conversations
     SET status='ai_handled',
         reply_due_at=NULL,
         last_message_at=NOW()
     WHERE id=$1`,
    [conversationId]
  );
}

export async function dueConversations(limit = 50) {
  const res = await query(
    `SELECT *
     FROM conversations
     WHERE status='awaiting_owner'
       AND reply_due_at IS NOT NULL
       AND reply_due_at <= NOW()
     ORDER BY reply_due_at ASC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

export async function lockDueConversation(conversationId) {
  // Lightweight optimistic lock: only proceed if still due + awaiting_owner
  const res = await query(
    `UPDATE conversations
     SET reply_due_at = reply_due_at
     WHERE id = $1
       AND status='awaiting_owner'
       AND reply_due_at IS NOT NULL
       AND reply_due_at <= NOW()
     RETURNING *`,
    [conversationId]
  );
  return res.rows[0] || null;
}