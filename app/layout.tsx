import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pinata Mixtape",
  description: "Retro mixtape manager agent template for Pinata-hosted agents."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
