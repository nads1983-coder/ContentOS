"use client";

import { useState } from "react";

const platformOptions = ["LinkedIn", "Instagram", "TikTok", "X/Twitter", "Facebook", "YouTube Shorts"];

export function OnboardingForm() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["LinkedIn", "Instagram"]);
  const [message, setMessage] = useState("");

  function togglePlatform(platform: string) {
    setSelectedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: form.get("businessName"),
        audience: form.get("audience"),
        niche: form.get("niche"),
        goals: form.get("goals"),
        writingTone: form.get("writingTone"),
        preferredPlatforms: selectedPlatforms
      })
    });

    setMessage(response.ok ? "Onboarding saved." : "Could not save onboarding yet.");
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {["businessName", "audience", "niche", "goals", "writingTone"].map((name) => (
        <label key={name} className="grid gap-2 text-sm font-semibold text-bone">
          {name.replace(/([A-Z])/g, " $1")}
          <input
            name={name}
            className="min-h-12 rounded border border-line bg-ink/70 px-3 text-bone outline-none focus:border-violet/70 focus:ring-2 focus:ring-violet/20"
          />
        </label>
      ))}
      <div>
        <p className="text-sm font-semibold text-bone">Preferred platforms</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {platformOptions.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => togglePlatform(platform)}
              className={`rounded border px-3 py-2 text-sm ${selectedPlatforms.includes(platform) ? "border-gold/70 bg-gold/10 text-bone" : "border-white/10 bg-white/[0.035] text-muted"}`}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>
      <button className="min-h-12 rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white">
        Save onboarding
      </button>
      {message ? <p className="text-sm text-goldSoft">{message}</p> : null}
    </form>
  );
}
