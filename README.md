# ContentOS

ContentOS is an AI social content generator that turns one rough idea into a complete platform-ready content pack.

Primary tagline: **Create platform-ready content from one idea.**

Supporting line: Generate posts, captions, scripts, hooks, CTAs, hashtags and repurposing packs in minutes.

## Product

ContentOS is built for founders, creators, consultants, freelancers, agencies, coaches, small teams, and personal brands who need consistent content without starting from a blank page every time.

## Features

- Landing page with SEO, FAQ, pricing, examples, and product positioning
- Content generation through the existing `/api/generate` OpenAI flow
- Platform outputs for LinkedIn, Instagram, TikTok, X/Twitter, Facebook, and YouTube Shorts
- Repurposing packs, carousel outlines, scripts, hooks, CTAs, and hashtags
- Platform formatter for LinkedIn, Instagram, TikTok, X threads, and video scripts
- Output actions for copy all, save all, individual copy, refinement shortcuts, and `.txt` download
- Saved library with filtering, sorting-ready structure, timestamps, and delete/copy actions
- Supabase Auth REST architecture for signup, login, logout, password reset, account sessions, and dashboard protection
- Supabase database schema for users, subscriptions, saved content, generations, onboarding, brand profiles, usage, and leads
- Stripe Checkout, Customer Portal, and webhook route architecture
- Sitemap, robots, Open Graph image, favicon, apple icon, and structured JSON-LD
- Legal/public pages for features, pricing, about, contact, FAQ, privacy, terms, refund policy
- Admin dashboard shell protected by configured admin emails

## Environment Variables

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5.2
NEXT_PUBLIC_SITE_URL=https://contentos.app
NEXT_PUBLIC_SUPPORT_EMAIL=support@getcontentos.co

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_CREATOR_PRICE_ID=
STRIPE_PRO_STUDIO_PRICE_ID=

NEXT_PUBLIC_PLAUSIBLE_DOMAIN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_SENTRY_DSN=
ADMIN_EMAILS=
```

## Database

Run `lib/database-schema.sql` in Supabase to create the production tables and indexes.

## Stripe Products

Pro Creator: AI social content generation for creators, founders and consultants. Includes multi-platform outputs, formatter tools, repurposing packs and saved content library.

Pro Studio: Advanced AI social content workspace for agencies, teams and high-volume creators. Includes multiple brand profiles, advanced workflows and expanded usage limits.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```
