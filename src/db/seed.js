import { query, pool } from "./client.js";
import { logger } from "../services/logger.js";

async function seed() {
  const res = await query("SELECT id FROM business_settings LIMIT 1");
  if (res.rowCount === 0) {
    await query(
      `INSERT INTO business_settings
       (business_name, hours, services, faq_text, reply_delay_minutes)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        "My Business",
        "Mon-Fri 9am-5pm",
        "General services",
        "Be polite, concise, and helpful. Escalate to a human if uncertain.",
        5
      ]
    );
    logger.info("Inserted default business_settings row.");
  } else {
    logger.info("business_settings already seeded.");
  }
}

seed()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    logger.error("Seed failed:", e);
    await pool.end();
    process.exit(1);
  });