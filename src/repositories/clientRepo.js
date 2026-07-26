import { query } from "../db/client.js";

export async function upsertClient({ platform, platformUserId, name }) {
  const res = await query(
    `INSERT INTO clients (platform, platform_user_id, name, created_at, last_contact_at)
     VALUES ($1,$2,$3,NOW(),NOW())
     ON CONFLICT (platform_user_id)
     DO UPDATE SET
       name = COALESCE(EXCLUDED.name, clients.name),
       last_contact_at = NOW()
     RETURNING *`,
    [platform, platformUserId, name || null]
  );
  return res.rows[0];
}

export async function getClientById(id) {
  const res = await query(`SELECT * FROM clients WHERE id=$1`, [id]);
  return res.rows[0] || null;
}