import { query } from "../db/client.js";

export async function getBusinessSettings() {
  const res = await query(`SELECT * FROM business_settings LIMIT 1`);
  return (
    res.rows[0] || {
      business_name: "My Business",
      hours: "",
      services: "",
      faq_text: "",
      reply_delay_minutes: 5,
      ai_enabled: true
    }
  );
}

// Single-tenant app: one settings row. Update it if it exists, otherwise create it.
export async function upsertBusinessSettings(fields) {
  const existing = await query(`SELECT id FROM business_settings LIMIT 1`);

  const business_name = fields.business_name ?? null;
  const hours = fields.hours ?? null;
  const services = fields.services ?? null;
  const faq_text = fields.faq_text ?? null;
  const reply_delay_minutes = Number.isFinite(Number(fields.reply_delay_minutes))
    ? Number(fields.reply_delay_minutes)
    : 5;
  const ai_enabled = fields.ai_enabled !== undefined ? Boolean(fields.ai_enabled) : true;

  if (existing.rows[0]) {
    const res = await query(
      `UPDATE business_settings
       SET business_name=$1, hours=$2, services=$3, faq_text=$4,
           reply_delay_minutes=$5, ai_enabled=$6
       WHERE id=$7
       RETURNING *`,
      [business_name, hours, services, faq_text, reply_delay_minutes, ai_enabled, existing.rows[0].id]
    );
    return res.rows[0];
  }

  const res = await query(
    `INSERT INTO business_settings
       (business_name, hours, services, faq_text, reply_delay_minutes, ai_enabled)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [business_name, hours, services, faq_text, reply_delay_minutes, ai_enabled]
  );
  return res.rows[0];
}