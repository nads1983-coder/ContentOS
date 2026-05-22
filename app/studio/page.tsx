import type { Metadata } from "next";
import { StudioShell } from "@/components/studio-shell";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "ContentOS Studio | AI Content Workspace",
  description: "Generate, format, repurpose, and save platform-ready social content packs in ContentOS Studio.",
  alternates: {
    canonical: absoluteUrl("/studio")
  },
  robots: {
    index: false,
    follow: false
  }
};

export default function StudioPage() {
  return <StudioShell />;
}
