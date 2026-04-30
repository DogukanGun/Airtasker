import type { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { verifyTransferAuthorization } from "../utils/eip3009";
import type { X402PaymentDescriptor, X402PaymentHeader } from "../types";

declare global {
  namespace Express {
    interface Request {
      x402Payment?: X402PaymentHeader;
    }
  }
}

export function x402PaymentRequired(priceUSDC: bigint) {
  return function paymentGate(req: Request, res: Response, next: NextFunction): void {
    const paymentHeader = req.headers["x-payment"] as string | undefined;

    if (!paymentHeader) {
      const descriptor: X402PaymentDescriptor = {
        version:   "1.0",
        scheme:    "eip3009",
        network:   config.NETWORK_NAME,
        asset:     config.USDC_ADDRESS,
        recipient: config.API_WALLET_PRIVATE_KEY
          ? new (require("ethers").Wallet)(config.API_WALLET_PRIVATE_KEY).address
          : "0x0000000000000000000000000000000000000000",
        amount:    priceUSDC.toString(),
        accepts:   ["eip3009-transferWithAuthorization"],
      };
      res.status(402)
        .set("X-Payment-Required", JSON.stringify(descriptor))
        .json({ error: "Payment Required", payment: descriptor });
      return;
    }

    let payment: X402PaymentHeader;
    try {
      const decoded = Buffer.from(paymentHeader, "base64").toString("utf8");
      payment = JSON.parse(decoded) as X402PaymentHeader;
    } catch {
      res.status(400).json({ error: "Malformed X-Payment header" });
      return;
    }

    if (payment.scheme !== "eip3009") {
      res.status(400).json({ error: "Unsupported payment scheme" });
      return;
    }

    req.x402Payment = payment;
    next();
  };
}

export async function verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  const payment = req.x402Payment;
  if (!payment) {
    next();
    return;
  }

  try {
    const valid = verifyTransferAuthorization(payment, config.CHAIN_ID);
    if (!valid) {
      res.status(402).json({ error: "Invalid payment authorization" });
      return;
    }
    next();
  } catch (err) {
    res.status(402).json({ error: "Payment verification failed" });
  }
}
