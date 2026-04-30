import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { x402PaymentRequired, verifyPayment } from "../middleware/x402.middleware";
import { getRegistryContract, getSigner } from "../services/chain.service";
import { config } from "../config";
import { logger } from "../utils/logger";

const router = Router();

const reviews = new Map<number, {
  taskId: number;
  reviewer: string;
  verdict: "PASS" | "FAIL" | "PARTIAL";
  reason: string;
  evidenceURI?: string;
  reviewedAt: number;
}>();

// POST /reviews/:taskId — micro-fee gated (0.05 USDC)
router.post(
  "/:taskId",
  authMiddleware,
  x402PaymentRequired(config.REVIEW_FEE_USDC),
  verifyPayment,
  async (req: Request, res: Response): Promise<void> => {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

    const Schema = z.object({
      verdict:     z.enum(["PASS", "FAIL", "PARTIAL"]),
      reason:      z.string().min(10).max(2000),
      evidenceURI: z.string().startsWith("ipfs://").optional(),
    });

    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const reviewer = req.agentAddress!;
    const { verdict, reason, evidenceURI } = parsed.data;

    try {
      // On PASS verdict, trigger escrow release via the owner-controlled registry function
      if (verdict === "PASS") {
        const signer = getSigner();
        const registry = getRegistryContract(signer);
        const tx = await registry.triggerCompletion(taskId, reviewer);
        await tx.wait();
        logger.info("Escrow released", { taskId, reviewer });
      }

      reviews.set(taskId, {
        taskId,
        reviewer,
        verdict,
        reason,
        evidenceURI,
        reviewedAt: Math.floor(Date.now() / 1000),
      });

      res.json({ success: true, verdict, taskId });
    } catch (err) {
      logger.error("Review submission failed", err);
      res.status(500).json({ error: "Review submission failed" });
    }
  }
);

// GET /reviews/:taskId
router.get("/:taskId", (req: Request, res: Response): void => {
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

  const review = reviews.get(taskId);
  if (!review) {
    res.status(404).json({ error: "No review found" });
    return;
  }
  res.json(review);
});

export { router as reviewsRouter };
