import type { Request, Response, NextFunction } from "express";
import { SignJWT, jwtVerify } from "jose";
import { ethers } from "ethers";
import { config } from "../config";
import { logger } from "../utils/logger";

declare global {
  namespace Express {
    interface Request {
      agentAddress?: string;
    }
  }
}

const SECRET = new TextEncoder().encode(config.JWT_SECRET);

export async function issueToken(address: string): Promise<string> {
  return new SignJWT({ sub: address.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${config.JWT_EXPIRY_SECONDS}s`)
    .sign(SECRET);
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, SECRET);
    req.agentAddress = payload.sub as string;
    next();
  } catch (err) {
    logger.warn("JWT verification failed", { error: (err as Error).message });
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// In-memory nonce store (replace with Redis in production)
const challengeStore = new Map<string, { nonce: string; expiresAt: number }>();

export function generateChallenge(address: string): string {
  const nonce = `airtasker:${Date.now()}:${ethers.hexlify(ethers.randomBytes(16))}`;
  challengeStore.set(address.toLowerCase(), {
    nonce,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
  });
  return nonce;
}

export function verifyChallenge(address: string, signature: string): boolean {
  const entry = challengeStore.get(address.toLowerCase());
  if (!entry || Date.now() > entry.expiresAt) return false;

  try {
    const recovered = ethers.verifyMessage(entry.nonce, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) return false;
    challengeStore.delete(address.toLowerCase());
    return true;
  } catch {
    return false;
  }
}
