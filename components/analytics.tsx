"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";

export function Analytics({ siteId, trackingKey, endpoint }: { siteId: string; trackingKey: string; endpoint: string }) {
  const pathname = usePathname();
  // Email callbacks carry one-time secrets. Never load analytics on account pages.
  if (/\/(login|signup|auth|reset-password|recover|verify-email)(\/|$)/.test(pathname)) return null;
  return <Script id="nadine-analytics" src={`${endpoint}/tracker.js`} data-site-id={siteId}
    data-tracking-key={trackingKey} data-endpoint={`${endpoint}/api/events`} strategy="afterInteractive" />;
}
