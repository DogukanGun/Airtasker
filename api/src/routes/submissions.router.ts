import { Router, type Request, type Response } from "express";
import { ethers } from "ethers";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { x402PaymentRequired, verifyPayment } from "../middleware/x402.middleware";
import { getRegistryContract, getSigner } from "../services/chain.service";
import { config } from "../config";
import { logger } from "../utils/logger";

const router = Router();

// In-memory submission store (replace with DB in production)
const submissions = new Map<number, {
  taskId: number;
  worker: string;
  resultSummary: string;
  resultURI: string;
  resultHash: string;
  submittedAt: number;
}>();

// POST /submissions/:taskId — x402 gated
router.post(
  "/:taskId",
  authMiddleware,
  x402PaymentRequired(config.SUBMISSION_FEE_USDC),
  verifyPayment,
  async (req: Request, res: Response): Promise<void> => {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

    const Schema = z.object({
      resultSummary: z.string().min(10).max(5000),
      resultURI:     z.string().startsWith("ipfs://"),
      resultHash:    z.string().regex(/^0x[0-9a-f]{64}$/i),
    });

    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const worker = req.agentAddress!;

    try {
      const registry = getRegistryContract();
      const raw = await registry.getFullTask(taskId);
      if (raw.assignedWorker.toLowerCase() !== worker.toLowerCase()) {
        res.status(403).json({ error: "Not the assigned worker" });
        return;
      }

      // Record submission
      submissions.set(taskId, {
        taskId,
        worker,
        ...parsed.data,
        submittedAt: Math.floor(Date.now() / 1000),
      });

      // Return calldata for the worker to submit the result on-chain
      const iface = registry.interface;
      const calldata = iface.encodeFunctionData("submitResult", [
        taskId,
        parsed.data.resultURI,
        parsed.data.resultHash,
      ]);

      logger.info("Submission recorded", { taskId, worker });
      res.json({
        success: true,
        calldata,
        to: await registry.getAddress(),
        note: "Send this transaction from your session key to finalize on-chain",
      });
    } catch (err) {
      logger.error("Submission failed", err);
      res.status(500).json({ error: "Submission failed" });
    }
  }
);

// GET /submissions/:taskId
router.get("/:taskId", (req: Request, res: Response): void => {
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

  const sub = submissions.get(taskId);
  if (!sub) {
    res.status(404).json({ error: "No submission found" });
    return;
  }
  res.json(sub);
});

export { router as submissionsRouter };
