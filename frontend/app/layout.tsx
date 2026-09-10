import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import LenisProvider from "@/components/LenisProvider";

export const metadata: Metadata = {
  title: "Profit & Loss",
  description: "P&L reporting over QuickBooks data in BigQuery",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased cwc-neo cwc-surfaces">
        <LenisProvider>
          <Providers>{children}</Providers>
        </LenisProvider>
      </body>
    </html>
  );
}
