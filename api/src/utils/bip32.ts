import { HDNodeWallet } from "ethers";
import { ethers } from "ethers";

const DERIVATION_TEMPLATE = (taskId: number, sessionIndex = 0) =>
  `m/44'/60'/0'/${taskId}'/${sessionIndex}`;

export function deriveSessionKey(masterMnemonic: string, taskId: number, sessionIndex = 0): HDNodeWallet {
  const path = DERIVATION_TEMPLATE(taskId, sessionIndex);
  return HDNodeWallet.fromPhrase(masterMnemonic, undefined, path);
}

export function getSessionAddress(masterMnemonic: string, taskId: number): string {
  return deriveSessionKey(masterMnemonic, taskId).address;
}

const SESSION_KEY_PREFIX = "AIRTASKER_SESSION";

export function buildSessionKeyMessage(taskId: number, sessionAddress: string): string {
  return `${SESSION_KEY_PREFIX}:${taskId}:${sessionAddress}`;
}

export async function signSessionKeyProof(
  masterWallet: ethers.Wallet,
  taskId: number,
  sessionAddress: string
): Promise<string> {
  const message = buildSessionKeyMessage(taskId, sessionAddress);
  return masterWallet.signMessage(message);
}

export function verifySessionKeyProof(
  taskId: number,
  sessionAddress: string,
  masterAddress: string,
  signature: string
): boolean {
  try {
    const message = buildSessionKeyMessage(taskId, sessionAddress);
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === masterAddress.toLowerCase();
  } catch {
    return false;
  }
}
