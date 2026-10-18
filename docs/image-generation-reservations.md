# Image Reservation Release Notes

Image generation uses the existing profile row lock. Admission atomically records
the request fingerprint, a pending monthly-credit hold, and an attempt charge.
New IDs consume an attempt even if generation later fails or returns a free SVG
fallback. The budgets are six attempts per rolling ten minutes and 100 per UTC
day. Two image requests may be active at once. Attempt and concurrency denials
include `Retry-After`; these headers do not initiate automatic client retries.

The client sends a UUID `requestId` and `X-ContentOS-Account`. Identical retries
reuse the ID and payload. A confirmed response adds `creditCharged`; only a
retained AI-background result consumes an image credit. Monthly usage reporting
takes the maximum of durable counters and legacy events, separately for text and
images, before computing the total. The UI uses the previous image-specific
excerpt limits (2,600 characters of output and bounded brand fields), preserving
the full original text and composer preferences. Direct oversized API inputs
remain rejected rather than silently changed by the server.

## Bounded Profile Storage Tradeoff

- One serialized response is capped at 4,000,000 UTF-8 bytes.
- Retained replay entries are capped at 10,000,000 bytes and eight results per
  account, and expire after 24 hours. There is no object-storage service.
- Pending holds expire after 15 minutes into terminal identities, never into
  permission to rerun the same ID. Lost completion acknowledgements can replay
  committed results; rolled-back completion retains the pending hold.
- Evicted, failed, and expired IDs remain as compact SHA-256-keyed tombstones.
  At 10,000 total identities, new admissions fail closed. Do not delete these
  identities to reclaim capacity: that would permit old IDs to spend again.
  A future versioned request namespace or durable separate ledger is needed
  before relaxing this lifetime bound.

Read-only `document()` and email profile lookups now remove the image and text
reservation/tombstone fields in the SQL SELECT, before rows cross the database
connection. Profile, workspace, brand, and usage readers keep their required
fields, including history, durable counters, attempt budgets, and entitlements.
No projected object is written back: every mutation still re-reads the full row
under `FOR UPDATE`, preserving replay and terminal-ID protection.

This is bounded, not cheap: PostgreSQL still processes the full JSONB value to
produce that projection, and locked mutations fetch and rewrite the full document.
An account can add close to 10 MB of image replay data plus approximately 2 MB of
image identity metadata to mutation transfer, in addition to text replay storage.
The change reduces read response payload, not underlying storage or mutation
amplification. Replay expiry is
compacted on image mutations, not by a background cleanup job, so dormant profile
rows may retain expired bodies within the same hard cap. A separate replay table
or object store would avoid this amplification, but is outside this release.

Large or unusable provider backgrounds fall back to a free SVG. URL-only provider
responses are not fetched. The provider may still have incurred cost; releasing
an application credit is not a provider refund. There are no automatic provider
retries. These limits and fixture tests do not establish live image quality,
successful provider latency, or measured AI cost.

## Isolated Database Check

`node tests/image-isolated.mjs` uses the actual repository and PostgreSQL row
locks, with synthetic profiles only. It accepts only the already-verified
`br-divine-term-b2rihbxv` isolated branch's pinned direct/pooler host and
`contentos` database. Set `CONTENTOS_ISOLATED_BRANCH` to that exact branch and
provide its `DATABASE_URL` through the approved in-memory launcher, with SSL
required and OpenAI, Stripe, and Resend credentials absent. Never place secrets
in a shell command, committed file, or test output. `--validate-only` validates
these constraints without opening a connection.

The script checks concurrent last-credit and attempt admission, same-ID and
same-payload dedupe, concurrent completion, failure release, forced SQL rollback,
lost acknowledgement replay, account isolation, and terminal crash expiry. An
additional phase creates one bounded one-million-character synthetic SVG and
measures the full document and actual projected SQL results before public profile
mapping. It prints `readMetrics` with serialized JSON byte counts and single-read
elapsed milliseconds for profile, email, workspace, brand, and usage reads. It
requires at least 95 percent payload reduction for this synthetic fixture and
checks that a subsequent workspace write retains both ledgers and tombstones,
including successful image replay and pending/failed text protections. These
are JSON payload measurements, not TCP/TLS wire bytes, database billing, or a
representative latency benchmark; compression and warm-cache effects differ.

Parent-reported isolated run on 2026-10-18: all nine checks passed, including
projection and replay preservation; all eight synthetic profiles were cleaned up.
The bounded fixture returned 1,002,064 serialized JSON bytes for the full read
(175.15 ms), versus 662 bytes for each projected read (17.08-19.50 ms). These are
single synthetic reads, not representative latency or cost measurements. The
result demonstrates reduced returned JSON payload for this fixture; it does not
remove PostgreSQL JSONB processing or full-document mutation amplification.

The script deletes only its UUID-prefixed, marker-scoped synthetic profiles in `finally`.
If externally killed, its printed fixture prefix identifies records needing
manual isolated-branch cleanup. It does not modify schema or auth records and
does not call an AI, billing, or email provider. The script is opt-in, outside
the default unit-test glob; the result above records the parent's actual run,
not a claim of live AI quality or production performance.
