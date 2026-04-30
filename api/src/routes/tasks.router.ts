import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { getRegistryContract } from "../services/chain.service";
import { pinJSON } from "../services/ipfs.service";
import { logger } from "../utils/logger";
import { TaskCategory } from "../types";

const router = Router();

const CategoryValues = Object.values(TaskCategory);
const CategoryMap: Record<string, number> = {
  DataProcessing: 0,
  WebScraping:    1,
  CodeGeneration: 2,
  Research:       3,
  Translation:    4,
  Other:          5,
};
const CategoryNames = ["DataProcessing","WebScraping","CodeGeneration","Research","Translation","Other"];

function mapTask(raw: any) {
  return {
    taskId:         Number(raw.taskId),
    poster:         raw.poster,
    metadataURI:    raw.metadataURI,
    bountyUSDC:     raw.bountyUSDC.toString(),
    reviewFeeUSDC:  raw.reviewFeeUSDC.toString(),
    status:         ["Open","Active","UnderReview","Completed","Disputed","Cancelled"][Number(raw.status)],
    category:       CategoryNames[Number(raw.category)] ?? "Other",
    deadline:       Number(raw.deadline),
    assignedWorker: raw.assignedWorker !== "0x0000000000000000000000000000000000000000" ? raw.assignedWorker : null,
    resultURI:      raw.resultURI || null,
    resultHash:     raw.resultHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? raw.resultHash : null,
    createdAt:      Number(raw.createdAt),
    completedAt:    Number(raw.completedAt) || null,
    minTrustScore:  Number(raw.minTrustScore),
  };
}

// GET /tasks?category=Research&offset=0&limit=20
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const category    = (req.query.category as string) ?? "Research";
  const offset      = parseInt((req.query.offset as string) ?? "0");
  const limit       = Math.min(parseInt((req.query.limit as string) ?? "20"), 100);
  const categoryIdx = CategoryMap[category] ?? 3;

  try {
    const registry = getRegistryContract();
    const [rawTasks, total] = await registry.getOpenTasks(categoryIdx, offset, limit);
    res.json({
      tasks:  rawTasks.map(mapTask),
      total:  Number(total),
      offset,
      limit,
    });
  } catch (err) {
    logger.error("Failed to fetch tasks", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// GET /tasks/:id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

  try {
    const registry = getRegistryContract();
    const [raw, bids] = await Promise.all([
      registry.getFullTask(taskId),
      registry.getTaskBids(taskId),
    ]);
    res.json({
      task: mapTask(raw),
      bids: bids.map((b: any) => ({
        bidId:           Number(b.bidId),
        taskId:          Number(b.taskId),
        worker:          b.worker,
        proposedFeeUSDC: b.proposedFeeUSDC.toString(),
        pitchURI:        b.pitchURI || null,
        createdAt:       Number(b.createdAt),
        accepted:        b.accepted,
      })),
    });
  } catch (err) {
    logger.error("Failed to fetch task", err);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// POST /tasks — create task metadata (IPFS pin); on-chain posting done by client via EIP-3009
const PostTaskSchema = z.object({
  title:        z.string().min(5).max(200),
  description:  z.string().min(20).max(10000),
  category:     z.enum(["DataProcessing","WebScraping","CodeGeneration","Research","Translation","Other"]),
  bountyUSDC:   z.string().regex(/^\d+$/),
  reviewFeeUSDC:z.string().regex(/^\d+$/).optional().default("0"),
  deadline:     z.number().int().positive(),
  minTrustScore:z.number().int().min(0).max(10000).optional().default(0),
  attachments:  z.array(z.string()).optional().default([]),
});

router.post("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const parsed = PostTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;

  try {
    const metadataURI = await pinJSON({
      title:       data.title,
      description: data.description,
      category:    data.category,
      attachments: data.attachments,
      poster:      req.agentAddress,
      createdAt:   Math.floor(Date.now() / 1000),
    });

    res.json({
      metadataURI,
      bountyUSDC:    data.bountyUSDC,
      reviewFeeUSDC: data.reviewFeeUSDC,
      categoryIndex: CategoryMap[data.category],
      deadline:      data.deadline,
      minTrustScore: data.minTrustScore,
    });
  } catch (err) {
    logger.error("Failed to create task metadata", err);
    res.status(500).json({ error: "Failed to create task metadata" });
  }
});

// PATCH /tasks/:id/cancel
router.patch("/:id/cancel", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

  try {
    const registry = getRegistryContract();
    const raw = await registry.getFullTask(taskId);
    if (raw.poster.toLowerCase() !== req.agentAddress?.toLowerCase()) {
      res.status(403).json({ error: "Not the task poster" });
      return;
    }
    // Note: actual cancellation tx must be sent by client (poster's wallet signs it)
    // This endpoint validates the request and returns the calldata for the client to execute
    const iface = registry.interface;
    const calldata = iface.encodeFunctionData("cancelTask", [taskId]);
    res.json({ calldata, to: await registry.getAddress() });
  } catch (err) {
    logger.error("Failed to prepare cancel", err);
    res.status(500).json({ error: "Failed to prepare cancel" });
  }
});

export { router as tasksRouter };
