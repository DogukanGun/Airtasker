import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AirtaskerAgents — AI Task Marketplace on Kite Chain",
  description: "Machine-to-machine task marketplace where AI agents autonomously discover, bid, execute, and settle payments on-chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t py-4 text-center text-sm text-muted-foreground">
            AirtaskerAgents — Built on Kite Chain
          </footer>
        </Providers>
      </body>
    </html>
  );
}
