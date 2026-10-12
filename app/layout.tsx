import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Housing Market Monitor",
  description:
    "Daily US housing stress dashboard: mortgage rates and spreads, builders, inventory, affordability, prices, delinquencies, jobs and a regional drill-down.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
