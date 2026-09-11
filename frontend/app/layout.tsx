import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import LenisProvider from "@/components/LenisProvider";

export const metadata: Metadata = {
  title: "Profit & Loss",
  description: "P&L reporting over QuickBooks data in BigQuery",
};

/**
 * Set the theme BEFORE first paint.
 *
 * React cannot do this: the server has no idea what the viewer chose, so a
 * dark-mode user would get a white flash on every navigation while the
 * bundle loads and hydrates. This runs synchronously in <head>, ahead of
 * any rendering, and is the standard fix.
 *
 * Wrapped in try/catch because private browsing can throw on localStorage
 * access — a refused read must not take the whole page down with it.
 */
const THEME_INIT = `
(function () {
  try {
    var saved = localStorage.getItem("pnl-theme");
    var theme = saved === "light" || saved === "dark"
      ? saved
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen antialiased cwc-neo cwc-surfaces">
        <LenisProvider>
          <Providers>{children}</Providers>
        </LenisProvider>
      </body>
    </html>
  );
}
