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
- Appwrite Cloud email/password auth for signup, login, logout, account sessions, and dashboard protection
- Appwrite database profile records for account, billing, usage, onboarding, brand profile, and recent generation metadata
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
AUTH_SESSION_SECRET=

NEXT_PUBLIC_APPWRITE_ENDPOINT=
APPWRITE_ENDPOINT=
NEXT_PUBLIC_APPWRITE_PROJECT_ID=
APPWRITE_PROJECT_ID=
APPWRITE_API_KEY=
APPWRITE_DATABASE_ID=
APPWRITE_USERS_COLLECTION_ID=

STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_CREATOR_PRICE_ID=
STRIPE_PRO_STUDIO_PRICE_ID=
STRIPE_LEGACY_PRO_CREATOR_PRICE_IDS=
STRIPE_LEGACY_PRO_STUDIO_PRICE_IDS=

FREE_MONTHLY_GENERATION_LIMIT=3
PRO_CREATOR_MONTHLY_GENERATION_LIMIT=50
PRO_STUDIO_MONTHLY_GENERATION_LIMIT=250

NEXT_PUBLIC_PLAUSIBLE_DOMAIN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_SENTRY_DSN=
ADMIN_EMAILS=
```

## Appwrite Cloud Setup

Create an Appwrite Cloud project and enable Email/Password authentication. Add your production domain and local development URL as Web platforms.

Create a database and a users/account collection, then set these Vercel environment variables from the Appwrite Console:

- `NEXT_PUBLIC_APPWRITE_ENDPOINT`
- `APPWRITE_ENDPOINT`
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_USERS_COLLECTION_ID`

Set `APPWRITE_ENDPOINT` to the same Appwrite endpoint as `NEXT_PUBLIC_APPWRITE_ENDPOINT`, and set `APPWRITE_PROJECT_ID` to the same Appwrite project ID as `NEXT_PUBLIC_APPWRITE_PROJECT_ID`. Server-side Appwrite clients prefer the server-only values and fall back to the public values only for compatibility. The server API key should have permissions for Databases and Users/Account operations. Do not expose `APPWRITE_API_KEY` to the browser.

Set `AUTH_SESSION_SECRET` to a long random server-only value for signing ContentOS session cookies. If it is absent, the app falls back to the Appwrite API key for signing, but a dedicated secret is preferred in production.

The users collection should include these attributes:

- `email` email, required
- `full_name` string, optional
- `plan` string, optional
- `stripe_customer_id` string, optional
- `stripe_subscription_id` string, optional
- `subscription_status` string, optional
- `subscription_current_period_end` datetime/string, optional
- `subscription_cancel_at_period_end` boolean, optional
- `subscription_canceled_at` datetime/string, optional
- `created_at` datetime/string, optional
- `updated_at` datetime/string, optional
- `brand_profiles_json` long text, optional
- `onboarding_json` long text, optional
- `generation_history_json` long text, optional
- `usage_events_json` long text, optional

Add an index on `email` so account/profile lookup remains fast.

## Manual Appwrite User Import

Use the manual import utility for known Appwrite users. This utility imports only the users listed in the local ignored file `scripts/migrations/manual-users.json`.

The real `manual-users.json` file is intentionally gitignored so private user emails are not committed. Use `scripts/migrations/manual-users.example.json` as the committed shape/reference.

The manual import utility:

- defaults to dry-run mode
- requires `--execute` to write to Appwrite
- creates Appwrite Auth users if they do not already exist
- generates secure temporary passwords without printing them
- creates or updates matching Appwrite users collection documents
- matches duplicates by email
- does not overwrite subscription fields unless they are explicitly present in `manual-users.json`
- outputs found, created, skipped, updated, and errors

Existing imported users should use the password reset flow before logging in.

Dry run:

```bash
npm run migrate:manual-appwrite-users
```

Execute:

```bash
npm run migrate:manual-appwrite-users -- --execute
```

Required Appwrite variables:

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=
APPWRITE_ENDPOINT=
NEXT_PUBLIC_APPWRITE_PROJECT_ID=
APPWRITE_PROJECT_ID=
APPWRITE_API_KEY=
APPWRITE_DATABASE_ID=
APPWRITE_USERS_COLLECTION_ID=
```

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
