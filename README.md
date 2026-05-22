# ContentOS

An AI-powered social media content operating system for creators, entrepreneurs, small businesses, coaches, consultants, and agencies.

The app turns raw notes, transcripts, launch ideas, offers, and stories into structured platform-ready content across LinkedIn, Instagram, TikTok, X/Twitter, Facebook, and YouTube Shorts.

## Features

- Multi-platform content generation workflow
- Generic content categories for business, personal brand, motivation, education, sales, product promotion, storytelling, thought leadership, community building, and announcements
- Tone presets for professional, bold, friendly, inspirational, direct, story-led, sales-focused, educational, premium, and conversational content
- Platform outputs for LinkedIn, Instagram, TikTok, X/Twitter, Facebook, and YouTube Shorts
- Formatter tools for LinkedIn posts, Instagram captions, TikTok captions, X threads, and short-form video scripts
- Repurposing workflow for posts, captions, threads, carousel outlines, video scripts, and email/newsletter drafts
- Placeholder paywall with Free and Pro entitlement states
- Saved content library with platform/category filters, copy, and delete
- Server-only OpenAI integration
- Local browser persistence for drafts, saved outputs, and recent generations
- Vercel-ready Next.js project structure

## Paywall Notes

The current paywall is intentionally a placeholder. It does not process payments and does not include fake Stripe code.

- Free users get a limited number of generations and basic output types.
- Pro unlocks full generation options, formatter access, repurposing outputs, CTA/carousel/video/email outputs, and saved history.
- The `Plan` switch in the UI simulates entitlement so Stripe can be connected later.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- OpenAI JavaScript SDK
- Lucide React icons

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Add your OpenAI key:

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5.2
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | OpenAI API key used by the server-only generation route. |
| `OPENAI_MODEL` | No | Model used for generation. Defaults to `gpt-5.2`. |

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```

## Vercel Deployment

This project is ready to deploy on Vercel.

1. Import the GitHub repository into Vercel.
2. Add `OPENAI_API_KEY` in Vercel Project Settings.
3. Optionally add `OPENAI_MODEL`.
4. Deploy with the default Next.js settings.

The OpenAI key is only used server-side in `app/api/generate/route.ts`.
