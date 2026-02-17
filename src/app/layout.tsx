import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NBA CBA Expert",
  description:
    "AI-powered NBA Collective Bargaining Agreement assistant. Ask questions about contracts, trades, free agency, salary cap rules, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
