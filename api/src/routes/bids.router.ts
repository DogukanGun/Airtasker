import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { getRegistryContract } from "../services/chain.service";
import { verifySessionKeyProof } from "../utils/bip32";
import { logger } from "../utils/logger";

const router = Router();

// GET /tasks/:taskId/bids
router.get("/:taskId/bids", async (req: Request, res: Response): Promise<void> => {
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

  try {
    const registry = getRegistryContract();
    const bids = await registry.getTaskBids(taskId);
    res.json(bids.map((b: any) => ({
      bidId:           Number(b.bidId),
      taskId:          Number(b.taskId),
      worker:          b.worker,
      proposedFeeUSDC: b.proposedFeeUSDC.toString(),
      pitchURI:        b.pitchURI || null,
      createdAt:       Number(b.createdAt),
      accepted:        b.accepted,
    })));
  } catch (err) {
    logger.error("Failed to fetch bids", err);
    res.status(500).json({ error: "Failed to fetch bids" });
  }
});

const SubmitBidSchema = z.object({
  proposedFeeUSDC:  z.string().regex(/^\d+$/),
  pitchText:        z.string().max(2000).optional().default(""),
  pitchURI:         z.string().optional().default(""),
  sessionKeyAddress:z.string().regex(/^0x[0-9a-f]{40}$/i),
  sessionKeyProof:  z.string(), // master signature over session key
});

// POST /tasks/:taskId/bids
router.post("/:taskId/bids", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

  const parsed = SubmitBidSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { proposedFeeUSDC, sessionKeyAddress, sessionKeyProof } = parsed.data;

  // Verify the session key proof (master signed the session key address)
  const masterAddress = req.agentAddress!;
  const validProof = verifySessionKeyProof(taskId, sessionKeyAddress, masterAddress, sessionKeyProof);
  if (!validProof) {
    res.status(400).json({ error: "Invalid session key proof" });
    return;
  }

  try {
    const registry = getRegistryContract();
    // Return calldata for the client to sign and send (worker's session key submits the bid on-chain)
    const iface = registry.interface;
    const calldata = iface.encodeFunctionData("submitBid", [
      taskId,
      BigInt(proposedFeeUSDC),
      parsed.data.pitchURI || "",
      sessionKeyProof,
    ]);
    res.json({
      calldata,
      to: await registry.getAddress(),
      note: "Sign and send this transaction from your session key address",
      sessionKeyAddress,
    });
  } catch (err) {
    logger.error("Failed to prepare bid", err);
    res.status(500).json({ error: "Failed to prepare bid" });
  }
});

const AcceptBidSchema = z.object({ bidId: z.number().int().positive() });

// PATCH /tasks/:taskId/bids/:bidId/accept
router.patch("/:taskId/bids/:bidId/accept", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const taskId = parseInt(req.params.taskId);
  const bidId  = parseInt(req.params.bidId);
  if (isNaN(taskId) || isNaN(bidId)) { res.status(400).json({ error: "Invalid IDs" }); return; }

  try {
    const registry = getRegistryContract();
    const raw = await registry.getFullTask(taskId);
    if (raw.poster.toLowerCase() !== req.agentAddress?.toLowerCase()) {
      res.status(403).json({ error: "Only the task poster can accept bids" });
      return;
    }

    const iface = registry.interface;
    const calldata = iface.encodeFunctionData("acceptBid", [taskId, bidId]);
    res.json({ calldata, to: await registry.getAddress() });
  } catch (err) {
    logger.error("Failed to prepare accept bid", err);
    res.status(500).json({ error: "Failed to prepare accept bid" });
  }
});

export { router as bidsRouter };
