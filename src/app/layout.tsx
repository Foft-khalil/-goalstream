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
  minimumScale: 0.5,
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
        {/* Critical iOS 12 Safari polyfills - must load before React */}
        <script dangerouslySetInnerHTML={{ __html: [
          'if(typeof Object.fromEntries!=="function"){Object.fromEntries=function(e){var o={};if(Array.isArray(e)){for(var i=0;i<e.length;i++){o[e[i][0]]=e[i][1];}}else{for(var k of e){o[k[0]]=k[1];}}return o;};}',
          'if(typeof globalThis==="undefined"){window.globalThis=window;}',
          'if(typeof Promise.allSettled!=="function"){Promise.allSettled=function(p){return Promise.all(p.map(function(v){return Promise.resolve(v).then(function(r){return{status:"fulfilled",value:r};},function(e){return{status:"rejected",reason:e};});}));};}',
          'if(typeof String.prototype.replaceAll!=="function"){String.prototype.replaceAll=function(s,n){if(s instanceof RegExp)return this.replace(s,n);return this.split(s).join(n);};}',
          'if(typeof Array.prototype.at!=="function"){Array.prototype.at=function(i){var l=this.length;var x=i>=0?i:l+i;return x>=0&&x<l?this[x]:void 0;};}',
          'if(typeof IntersectionObserver==="undefined"){window.IntersectionObserver=function(c){this.observe=function(e){c([{isIntersecting:true,target:e}],this);};this.unobserve=function(){};this.disconnect=function(){};};}',
        ].join('\n') }} />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
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
