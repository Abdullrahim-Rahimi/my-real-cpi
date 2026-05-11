import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://myrealcpi.com";
const TITLE = "My Real CPI — your personal inflation rate";
const DESCRIPTION =
  "The headline CPI uses an average national basket. Your spending isn't average. Tell us what you spend on; we'll compute your personal inflation rate from the same official data the central banks use.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · My Real CPI" },
  description: DESCRIPTION,
  applicationName: "My Real CPI",
  keywords: ["CPI", "inflation", "personal inflation", "cost of living", "HICP"],
  authors: [{ name: "My Real CPI" }],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "My Real CPI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/*
          Thin emerald progress bar at the top during route transitions.
          Animated automatically on every <Link> click and programmatic
          navigation, so navigation between pages no longer feels silent.
        */}
        <NextTopLoader
          color="#059669"
          height={2.5}
          showSpinner={false}
          shadow="0 0 6px #059669"
        />
        {children}
      </body>
    </html>
  );
}
