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

// --- Dashboard-facing reads ---

export async function listConversations({ status, limit = 100 } = {}) {
  const params = [];
  let where = "";

  if (status) {
    params.push(status);
    where = `WHERE c.status = $${params.length}`;
  }

  params.push(limit);

  const res = await query(
    `SELECT
       c.id,
       c.platform,
       c.status,
       c.reply_due_at,
       c.last_message_at,
       cl.id AS client_id,
       cl.name AS client_name,
       cl.platform_user_id,
       cl.phone,
       cl.email,
       lm.content AS last_message_content,
       lm.sender AS last_message_sender,
       lm.sent_at AS last_message_sent_at
     FROM conversations c
     JOIN clients cl ON cl.id = c.client_id
     LEFT JOIN LATERAL (
       SELECT content, sender, sent_at
       FROM messages m
       WHERE m.conversation_id = c.id
       ORDER BY m.sent_at DESC
       LIMIT 1
     ) lm ON true
     ${where}
     ORDER BY c.last_message_at DESC NULLS LAST
     LIMIT $${params.length}`,
    params
  );
  return res.rows;
}

export async function getConversationById(conversationId) {
  const res = await query(
    `SELECT
       c.*,
       cl.name AS client_name,
       cl.platform_user_id,
       cl.phone,
       cl.email
     FROM conversations c
     JOIN clients cl ON cl.id = c.client_id
     WHERE c.id = $1`,
    [conversationId]
  );
  return res.rows[0] || null;
}

export async function markResolved(conversationId) {
  const res = await query(
    `UPDATE conversations
     SET status='resolved',
         reply_due_at=NULL
     WHERE id=$1
     RETURNING *`,
    [conversationId]
  );
  return res.rows[0] || null;
}