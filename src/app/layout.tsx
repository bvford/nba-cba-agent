import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Barlow_Condensed, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const description =
  "Ask questions about NBA contracts, trades, free agency, salary cap rules, and more. Powered by the 2023 CBA with updated player data and live stats context.";

export const metadata: Metadata = {
  metadataBase: new URL("https://chatcba.vercel.app"),
  title: {
    default: "ChatCBA — Your AI Salary Cap Expert",
    template: "%s — ChatCBA",
  },
  description,
  openGraph: {
    title: "ChatCBA — Your AI Salary Cap Expert",
    description,
    url: "https://chatcba.vercel.app",
    siteName: "ChatCBA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChatCBA — Your AI Salary Cap Expert",
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${barlowCondensed.variable} ${plusJakartaSans.variable}`}
    >
      <body className="antialiased bg-gradient-page">{children}</body>
    </html>
  );
}
