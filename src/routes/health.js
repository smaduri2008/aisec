import { Router } from "express";
const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "ai-secretary-backend",
    timestamp: new Date().toISOString()
  });
});

export default router;