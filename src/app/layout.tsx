import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#16a34a",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "GoalStream — Sport en direct",
  description:
    "Regardez les matchs de football et basketball en direct. Scores en temps réel, chaînes sportives et plus encore.",
  keywords: ["football", "basketball", "NBA", "live streaming", "soccer", "sports", "direct", "match"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "32x32" },
      { url: "/favicon-32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg?v=2", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=2", sizes: "180x180" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GoalStream",
  },
  openGraph: {
    title: "GoalStream — Sport en direct",
    description: "Regardez les matchs de football et basketball en direct",
    type: "website",
    siteName: "GoalStream",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="GoalStream" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
