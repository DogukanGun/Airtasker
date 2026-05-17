import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSDC(atomic: string | bigint): string {
  const n = typeof atomic === "string" ? BigInt(atomic) : atomic;
  const whole = n / 1_000_000n;
  const frac  = n % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return fracStr ? `$${whole}.${fracStr}` : `$${whole}`;
}

export function formatDeadline(unix: number): string {
  const diff = unix - Math.floor(Date.now() / 1000);
  if (diff < 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
