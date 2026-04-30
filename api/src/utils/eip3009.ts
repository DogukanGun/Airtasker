import { ethers } from "ethers";
import type { X402PaymentHeader } from "../types";

const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
  )
);

const EIP712_DOMAIN_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
  )
);

export function buildTransferDomain(chainId: number, usdcAddress: string) {
  return {
    name: "USD Coin",
    version: "2",
    chainId,
    verifyingContract: usdcAddress,
  };
}

export const TRANSFER_WITH_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from",        type: "address" },
    { name: "to",          type: "address" },
    { name: "value",       type: "uint256" },
    { name: "validAfter",  type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce",       type: "bytes32" },
  ],
};

export function computeDomainSeparator(chainId: number, usdcAddress: string): string {
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "bytes32", "uint256", "address"],
    [
      EIP712_DOMAIN_TYPEHASH,
      ethers.keccak256(ethers.toUtf8Bytes("USD Coin")),
      ethers.keccak256(ethers.toUtf8Bytes("2")),
      chainId,
      usdcAddress,
    ]
  );
  return ethers.keccak256(encoded);
}

export function computeTransferHash(payment: Omit<X402PaymentHeader, "v" | "r" | "s" | "version" | "scheme" | "network" | "asset" | "recipient">): string {
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "address", "uint256", "uint256", "uint256", "bytes32"],
    [
      TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
      payment.from,
      payment.to,
      BigInt(payment.value),
      BigInt(payment.validAfter),
      BigInt(payment.validBefore),
      payment.nonce,
    ]
  );
  return ethers.keccak256(encoded);
}

export function computeDigest(domainSeparator: string, structHash: string): string {
  return ethers.keccak256(
    ethers.concat([ethers.toUtf8Bytes("\x19\x01"), domainSeparator, structHash])
  );
}

export function recoverSigner(payment: X402PaymentHeader, chainId: number): string {
  const domainSeparator = computeDomainSeparator(chainId, payment.asset);
  const structHash = computeTransferHash(payment);
  const digest = computeDigest(domainSeparator, structHash);
  return ethers.recoverAddress(digest, { v: payment.v, r: payment.r, s: payment.s });
}

export function verifyTransferAuthorization(payment: X402PaymentHeader, chainId: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (now <= parseInt(payment.validAfter))  return false;
  if (now >= parseInt(payment.validBefore)) return false;

  const recovered = recoverSigner(payment, chainId);
  return recovered.toLowerCase() === payment.from.toLowerCase();
}

export async function signTransferAuthorization(
  signer: ethers.Wallet,
  params: {
    to: string;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: string;
    chainId: number;
    usdcAddress: string;
  }
): Promise<{ v: number; r: string; s: string }> {
  const domain = buildTransferDomain(params.chainId, params.usdcAddress);
  const message = {
    from:        signer.address,
    to:          params.to,
    value:       params.value,
    validAfter:  params.validAfter,
    validBefore: params.validBefore,
    nonce:       params.nonce,
  };
  const sig = await signer.signTypedData(domain, TRANSFER_WITH_AUTH_TYPES, message);
  const { v, r, s } = ethers.Signature.from(sig);
  return { v, r, s };
}

export async function executeTransferAuthorization(
  payment: X402PaymentHeader,
  provider: ethers.Provider,
  executorWallet: ethers.Wallet,
  usdcAbi: string[]
): Promise<ethers.TransactionReceipt | null> {
  const usdc = new ethers.Contract(payment.asset, usdcAbi, executorWallet);
  const tx = await usdc.transferWithAuthorization(
    payment.from,
    payment.to,
    BigInt(payment.value),
    BigInt(payment.validAfter),
    BigInt(payment.validBefore),
    payment.nonce,
    payment.v,
    payment.r,
    payment.s
  );
  return tx.wait();
}
