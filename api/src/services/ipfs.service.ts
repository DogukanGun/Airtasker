import { config } from "../config";
import { logger } from "../utils/logger";

// Simple IPFS service — uses Pinata if configured, else falls back to a local stub.
// In production, replace with full Pinata SDK or web3.storage.

export async function pinJSON(data: unknown): Promise<string> {
  if (config.PINATA_JWT) {
    return pinToPinata(data);
  }
  // Local stub: return a deterministic fake CID for development
  const hash = Buffer.from(JSON.stringify(data)).toString("base64url").slice(0, 46);
  logger.debug("IPFS stub (no Pinata JWT): returning fake CID", { hash });
  return `ipfs://Qm${hash}`;
}

export async function fetchJSON(uri: string): Promise<unknown> {
  if (uri.startsWith("ipfs://")) {
    const cid = uri.replace("ipfs://", "");
    if (config.PINATA_JWT) {
      const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
      return res.json();
    }
    // Local stub
    logger.debug("IPFS stub fetch", { uri });
    return { stub: true, uri };
  }
  throw new Error(`Unsupported URI scheme: ${uri}`);
}

async function pinToPinata(data: unknown): Promise<string> {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.PINATA_JWT}`,
    },
    body: JSON.stringify({ pinataContent: data }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { IpfsHash: string };
  return `ipfs://${json.IpfsHash}`;
}
