import { Router } from "express";
import { processDueTimers } from "../services/timerProcessor.js";

const router = Router();

/**
 * Cron endpoint: call every minute from Render Cron.
 */
router.post("/jobs/check-timers", async (_req, res) => {
  const result = await processDueTimers();
  res.status(200).json({ ok: true, ...result });
});

export default router;