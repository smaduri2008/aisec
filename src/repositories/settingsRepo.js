import { query } from "../db/client.js";

export async function getBusinessSettings() {
  const res = await query(`SELECT * FROM business_settings LIMIT 1`);
  return (
    res.rows[0] || {
      business_name: "My Business",
      hours: "",
      services: "",
      faq_text: "",
      reply_delay_minutes: 5
    }
  );
}