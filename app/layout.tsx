import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { absoluteUrl, siteConfig } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
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
  const shouldLoadAnalytics = process.env.NODE_ENV === "production";

  return (
    <html lang="en">
      <body>
        {children}
        {shouldLoadAnalytics ? (
          <>
            <Script
              async
              src="https://plausible.io/js/pa-gi8LN7uDl7Mbn6ht4W3QU.js"
              strategy="afterInteractive"
            />
            <Script id="plausible-init" strategy="afterInteractive">
              {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
plausible.init()`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
