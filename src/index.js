import express from "express";
import { config } from "./config.js";
import { logger } from "./services/logger.js";
import healthRoutes from "./routes/health.js";
import privacyRoutes from "./routes/privacy.js";
import metaRoutes from "./routes/meta.js";
import jobsRoutes from "./routes/jobs.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.use(healthRoutes);
app.use(privacyRoutes);
app.use(metaRoutes);
app.use(jobsRoutes);

app.use((err, _req, res, _next) => {
  logger.error("Unhandled app error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  logger.info(`AI Secretary backend listening on port ${config.port}`);
});