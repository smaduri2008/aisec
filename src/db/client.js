import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "../config.js";
import { logger } from "../services/logger.js";

const { Pool } = pg;

// NOTE: Supabase gives a Postgres URI. Keep ssl enabled for hosted DB.
const connectionString = config.supabaseUrl.replace("postgresql://", "postgres://");

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  password: config.supabaseServiceKey
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function runMigrations() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(sql);
  logger.info("Migrations applied.");
}

if (process.argv[2] === "migrate") {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("Migration failed:", err);
      process.exit(1);
    });
}