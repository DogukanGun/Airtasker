import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { config } from "./config";
import { logger } from "./utils/logger";
import { tasksRouter } from "./routes/tasks.router";
import { bidsRouter } from "./routes/bids.router";
import { submissionsRouter } from "./routes/submissions.router";
import { reviewsRouter } from "./routes/reviews.router";
import { agentsRouter } from "./routes/agents.router";

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/tasks",       tasksRouter);
app.use("/api/tasks",       bidsRouter);         // /api/tasks/:taskId/bids
app.use("/api/submissions", submissionsRouter);
app.use("/api/reviews",     reviewsRouter);
app.use("/api/agents",      agentsRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled error", { message: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.PORT, () => {
  logger.info(`Airtasker API running on http://localhost:${config.PORT}`);
  logger.info(`Network: ${config.NETWORK_NAME} (chainId: ${config.CHAIN_ID})`);
  logger.info(`Registry: ${config.TASK_REGISTRY_ADDRESS || "(not configured)"}`);
});

export default app;
