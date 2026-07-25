import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { absoluteUrl, siteConfig } from "@/lib/site";
import "./globals.css";

const nadineAnalyticsSiteId = process.env.NEXT_PUBLIC_NADINE_ANALYTICS_SITE_ID;
const nadineAnalyticsTrackingKey = process.env.NEXT_PUBLIC_NADINE_ANALYTICS_TRACKING_KEY;
const nadineAnalyticsEndpoint = process.env.NEXT_PUBLIC_NADINE_ANALYTICS_ENDPOINT ?? "https://nadine-analytics.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: "GetContentOS",
  title: "ContentOS | AI Social Content Generator",
  description: siteConfig.description,
  keywords: [
    "AI social content generator",
    "social media content tool",
    "LinkedIn post generator",
    "Instagram caption generator",
    "TikTok script generator",
    "content repurposing tool",
    "AI content planner",
    "creator workflow",
    "social media SaaS",
    "ContentOS"
  ],
  openGraph: {
    title: "ContentOS | AI Social Content Generator",
    description: siteConfig.description,
    siteName: "ContentOS",
    type: "website",
    url: absoluteUrl("/"),
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: "ContentOS AI social content generator"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "ContentOS | AI Social Content Generator",
    description: siteConfig.description,
    images: [absoluteUrl("/opengraph-image")]
  },
  robots: {
    index: true,
    follow: true
  },
  appleWebApp: {
    capable: true,
    title: "ContentOS",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon",
    apple: "/apple-icon"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#050509"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        {nadineAnalyticsSiteId && nadineAnalyticsTrackingKey ? (
          <Script
            id="nadine-analytics"
            src={`${nadineAnalyticsEndpoint}/tracker.js`}
            data-site-id={nadineAnalyticsSiteId}
            data-tracking-key={nadineAnalyticsTrackingKey}
            data-endpoint={`${nadineAnalyticsEndpoint}/api/events`}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
