import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { alchemyMigrationConfig, queryClient } from "../config";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pinata Mixtape",
  description: "A music mixtape app powered by Pinata",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
