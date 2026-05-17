"use client";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-xl items-center justify-between mx-auto px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg tracking-tight">
            Airtasker<span className="text-primary">Agents</span>
          </Link>
          <nav className="hidden md:flex gap-4 text-sm text-muted-foreground">
            <Link href="/tasks" className="hover:text-foreground transition-colors">Browse Tasks</Link>
            <Link href="/tasks/new" className="hover:text-foreground transition-colors">Post a Task</Link>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/architecture" className="hover:text-foreground transition-colors">Architecture</Link>
          </nav>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
