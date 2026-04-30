import { describe, it, expect, beforeAll } from "vitest";
import { ethers } from "ethers";
import {
  verifyTransferAuthorization,
  signTransferAuthorization,
  computeDomainSeparator,
  recoverSigner,
} from "../src/utils/eip3009";
import type { X402PaymentHeader } from "../src/types";

const CHAIN_ID    = 31337;
const USDC_ADDR   = "0x0000000000000000000000000000000000000001";
const RECIPIENT   = "0x0000000000000000000000000000000000000002";

describe("EIP-3009 transferWithAuthorization", () => {
  let signer: ethers.Wallet;
  let validPayment: X402PaymentHeader;

  beforeAll(async () => {
    signer = ethers.Wallet.createRandom();
    const now = Math.floor(Date.now() / 1000);
    const nonce = ethers.hexlify(ethers.randomBytes(32));

    const { v, r, s } = await signTransferAuthorization(signer, {
      to:          RECIPIENT,
      value:       100_000n,
      validAfter:  0n,
      validBefore: BigInt(now + 3600),
      nonce,
      chainId:     CHAIN_ID,
      usdcAddress: USDC_ADDR,
    });

    validPayment = {
      version:     "1.0",
      scheme:      "eip3009",
      network:     "local",
      asset:       USDC_ADDR,
      recipient:   RECIPIENT,
      amount:      "100000",
      from:        signer.address,
      to:          RECIPIENT,
      value:       "100000",
      validAfter:  "0",
      validBefore: (now + 3600).toString(),
      nonce,
      v,
      r,
      s,
    };
  });

  it("recovers correct signer from valid auth", () => {
    const recovered = recoverSigner(validPayment, CHAIN_ID);
    expect(recovered.toLowerCase()).toBe(signer.address.toLowerCase());
  });

  it("verifies valid payment", () => {
    expect(verifyTransferAuthorization(validPayment, CHAIN_ID)).toBe(true);
  });

  it("rejects expired payment", () => {
    const expired = {
      ...validPayment,
      validBefore: (Math.floor(Date.now() / 1000) - 10).toString(),
    };
    expect(verifyTransferAuthorization(expired, CHAIN_ID)).toBe(false);
  });

  it("rejects payment not yet valid", () => {
    const notYet = {
      ...validPayment,
      validAfter: (Math.floor(Date.now() / 1000) + 3600).toString(),
    };
    expect(verifyTransferAuthorization(notYet, CHAIN_ID)).toBe(false);
  });

  it("rejects tampered amount", async () => {
    const tampered = { ...validPayment, value: "999999" };
    // Signature was made over the original value, so recovery will yield a different address
    const recovered = recoverSigner(tampered, CHAIN_ID);
    expect(recovered.toLowerCase()).not.toBe(signer.address.toLowerCase());
  });
});

describe("BIP-32 session keys", () => {
  it("derives deterministic address for same mnemonic+taskId", async () => {
    const { deriveSessionKey } = await import("../src/utils/bip32");
    const mnemonic = ethers.Mnemonic.entropyToPhrase(ethers.randomBytes(16));
    const a1 = deriveSessionKey(mnemonic, 42).address;
    const a2 = deriveSessionKey(mnemonic, 42).address;
    expect(a1).toBe(a2);
  });

  it("derives different address for different taskIds", async () => {
    const { deriveSessionKey } = await import("../src/utils/bip32");
    const mnemonic = ethers.Mnemonic.entropyToPhrase(ethers.randomBytes(16));
    const a1 = deriveSessionKey(mnemonic, 1).address;
    const a2 = deriveSessionKey(mnemonic, 2).address;
    expect(a1).not.toBe(a2);
  });

  it("verifies valid session key proof", async () => {
    const { signSessionKeyProof, verifySessionKeyProof, getSessionAddress } = await import("../src/utils/bip32");
    const mnemonic = ethers.Mnemonic.entropyToPhrase(ethers.randomBytes(16));
    const master = ethers.HDNodeWallet.fromPhrase(mnemonic);
    const sessionAddress = getSessionAddress(mnemonic, 5);
    const sig = await signSessionKeyProof(master as unknown as ethers.Wallet, 5, sessionAddress);
    expect(verifySessionKeyProof(5, sessionAddress, master.address, sig)).toBe(true);
  });

  it("rejects proof for wrong task ID", async () => {
    const { signSessionKeyProof, verifySessionKeyProof, getSessionAddress } = await import("../src/utils/bip32");
    const mnemonic = ethers.Mnemonic.entropyToPhrase(ethers.randomBytes(16));
    const master = ethers.HDNodeWallet.fromPhrase(mnemonic);
    const sessionAddress = getSessionAddress(mnemonic, 5);
    const sig = await signSessionKeyProof(master as unknown as ethers.Wallet, 5, sessionAddress);
    // Verify with wrong task ID
    expect(verifySessionKeyProof(999, sessionAddress, master.address, sig)).toBe(false);
  });
});
