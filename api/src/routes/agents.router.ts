import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware, generateChallenge, issueToken, verifyChallenge } from "../middleware/auth.middleware";
import { getPassportContract } from "../services/chain.service";
import { logger } from "../utils/logger";

const router = Router();

// GET /agents/auth/challenge?address=0x...
router.get("/auth/challenge", (req: Request, res: Response): void => {
  const address = (req.query.address as string)?.toLowerCase();
  if (!address || !/^0x[0-9a-f]{40}$/i.test(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const nonce = generateChallenge(address);
  res.json({ challenge: nonce, expiresIn: 300 });
});

// POST /agents/auth
const AuthSchema = z.object({
  address:   z.string().regex(/^0x[0-9a-f]{40}$/i),
  challenge: z.string(),
  signature: z.string(),
});

router.post("/auth", async (req: Request, res: Response): Promise<void> => {
  const parsed = AuthSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { address, signature } = parsed.data;
  const valid = verifyChallenge(address, signature);
  if (!valid) {
    res.status(401).json({ error: "Invalid signature or expired challenge" });
    return;
  }

  try {
    const token = await issueToken(address);
    res.json({ token, address: address.toLowerCase() });
  } catch (err) {
    logger.error("Token issuance failed", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /agents/:address
router.get("/:address", async (req: Request, res: Response): Promise<void> => {
  const { address } = req.params;
  if (!/^0x[0-9a-f]{40}$/i.test(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }

  try {
    const passport = getPassportContract();
    const [isReg, record] = await Promise.all([
      passport.isRegistered(address),
      passport.getPassport(address),
    ]);

    res.json({
      address:        address.toLowerCase(),
      registered:     isReg,
      trustScore:     Number(record.score),
      tasksCompleted: Number(record.tasksCompleted),
      tasksDisputed:  Number(record.tasksDisputed),
      verified:       record.verified,
      metadataURI:    record.metadataURI,
      lastUpdated:    Number(record.lastUpdated),
    });
  } catch (err) {
    logger.error("Failed to fetch agent profile", err);
    res.status(500).json({ error: "Failed to fetch agent profile" });
  }
});

export { router as agentsRouter };
