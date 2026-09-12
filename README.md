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
- Better Auth email/password authentication with verification, reset, revocable sessions and protected dashboard access
- Private Neon Postgres records for accounts, billing, usage, onboarding, brand profiles and generation history
- Stripe Checkout, Customer Portal, and webhook route architecture
- Sitemap, robots, Open Graph image, favicon, apple icon, and structured JSON-LD
- Legal/public pages for features, pricing, about, contact, FAQ, privacy, terms, refund policy
- Admin dashboard shell protected by configured admin emails

## Environment Variables

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5.2
OPENAI_IMAGE_MODEL=gpt-image-1.5
NEXT_PUBLIC_APP_URL=https://getcontentos.co
NEXT_PUBLIC_SITE_URL=https://getcontentos.co
NEXT_PUBLIC_CONTACT_EMAIL=hello@getcontentos.co
NEXT_PUBLIC_SUPPORT_EMAIL=support@getcontentos.co
RESEND_API_KEY=
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://getcontentos.co


STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_CREATOR_PRICE_ID=
STRIPE_PRO_STUDIO_PRICE_ID=
STRIPE_FOUNDER_COUPON_ID=
STRIPE_FOUNDER_PROMOTION_CODE_ID=
STRIPE_LEGACY_PRO_CREATOR_PRICE_IDS=
STRIPE_LEGACY_PRO_STUDIO_PRICE_IDS=

FREE_MONTHLY_GENERATION_LIMIT=3
PRO_CREATOR_MONTHLY_GENERATION_LIMIT=50
PRO_STUDIO_MONTHLY_GENERATION_LIMIT=250

NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_SENTRY_DSN=
ADMIN_EMAILS=
```

## Backend and authentication

ContentOS uses Better Auth in the existing Vercel server runtime and a Neon Free Postgres project. The database automatically sleeps when idle and wakes on real connections; no keep-alive job is used.

Configure only server-side variables:

- `DATABASE_URL`: pooled URL for the restricted application role, with TLS certificate verification.
- `BETTER_AUTH_SECRET`: a strong random secret, different in preview and production.
- `BETTER_AUTH_URL`: `https://getcontentos.co` in production; omit in Vercel previews to use that deployment's URL. Use `http://localhost:3000` for local development.
- `RESEND_API_KEY`: the existing email integration. Verification, reset and deduplicated owner notices share a 100/day and 3,000/month application limit.

Never use a `NEXT_PUBLIC_` prefix for database or authentication secrets. Preview uses a separate database branch. Production users from the previous backend retain their IDs, profiles and entitlements and claim their account with a one-time password reset. Deleted and disabled accounts are not reactivated.

Run versioned SQL migrations with `node scripts/migrations/migrate-postgres.mjs /private/path/owner-url-file`. The application role cannot change schemas or roles. Owner credentials never belong in Vercel or client code.

See [backend migration and rollback](docs/backend-migration.md) for the architecture, limits, data-preservation process and recovery instructions.

## Stripe Products

Pro Creator: AI social content generation for creators, founders and consultants. Includes multi-platform outputs, formatter tools, repurposing packs and saved content library.

Pro Studio: Advanced AI social content workspace for agencies, teams and high-volume creators. Includes multiple brand profiles, advanced workflows and expanded usage limits.

The Founder flow prefers `STRIPE_FOUNDER_COUPON_ID` or `STRIPE_FOUNDER_PROMOTION_CODE_ID`. If neither is configured, it resolves the active `FOUNDING100` promotion code server-side. Founder checkout fails closed unless Stripe returns a £0 Checkout Session; users are never redirected to a payable fallback session.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```
