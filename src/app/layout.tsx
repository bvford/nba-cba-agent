import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NBA CBA Expert | AI-Powered Salary Cap Assistant",
  description:
    "Ask questions about NBA contracts, trades, free agency, salary cap rules, and more. Powered by the full 2023 CBA with live player data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="antialiased bg-gradient-page"
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
