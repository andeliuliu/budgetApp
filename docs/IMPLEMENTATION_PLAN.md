# budgetApp — Implementation Plan

A personal finance tracker: real-time-ish payment tracking via Plaid, category-based
spend organization, budgets + visualizations, and bill-splitting over Venmo.

Built to be (a) genuinely useful day-to-day and (b) a strong full-stack resume artifact.

---

## 1. Reality checks (read this first)

Three features as described collide with real-world platform/regulatory limits. None
are blockers — they just need to be scoped honestly.

| What you wrote | Reality | What we'll actually build |
|---|---|---|
| "Real-time payment tracking" | Plaid is **not** a streaming/real-time feed. Transactions appear when the bank posts them (pending → posted), surfaced to us via webhooks. | Near-real-time: `/transactions/sync` + webhooks → push updates within minutes of the bank posting, plus pull-to-refresh. |
| "Transfers between accounts (Chase ↔ SoFi)" | **Detecting** transfers in your data is trivial. **Initiating** money movement (Plaid Transfer/ACH) requires KYC, a funding source, and heavy compliance — not viable for a solo MVP. | Detect & categorize transfers (so they don't pollute spend). Initiating transfers is explicitly out of scope for v1. |
| "Auto-send a Venmo message to each friend" | Venmo has **no open public API** for programmatic payment requests, and neither iOS nor Android lets an app silently send SMS. | Venmo **deep links** (`venmo://paycharge?...`) pre-filled with handle + amount + note, launched via the system share sheet / prefilled SMS draft. User taps "send" — we do everything up to that tap. |

Everything else (categorization, budgets, charts, split math, contacts, location/time
detail) is fully achievable.

---

## 2. Tech stack (chosen for "useful" + "in-demand")

| Layer | Choice | Why this one (resume + practical) |
|---|---|---|
| Language | **TypeScript (strict)** everywhere | Single language across mobile + backend + shared types. |
| Mobile | **React Native + Expo (managed)**, **Expo Router** | Expo + file-based routing is the modern RN standard; EAS gives you builds/OTA without Xcode pain. |
| Server state | **TanStack Query** | The default for data-fetching/caching in modern React; heavily sought after. |
| Client state | **Zustand** | Minimal, ergonomic; avoids Redux boilerplate while still being a recognized choice. |
| Styling / DS | **Tamagui** + a design-tokens theme | Themeable, high-perf RN UI system with a compiler; deep theming + design-system story. Drives the gender-neutral palette via tokens. |
| Charts | **Victory Native XL** (built on **React Native Skia**) | Skia = high-perf native rendering; great "I built custom data-viz" talking point. (`react-native-gifted-charts` is the simpler fallback.) |
| Auth + DB | **Supabase** (Postgres + Auth + Row-Level Security + Realtime) | Postgres/SQL/RLS are real skills; offloads undifferentiated auth work; "Supabase" is a hot keyword. |
| Plaid service | **Dedicated TS backend — NestJS** (or Fastify) | The security-sensitive integration lives in a real service: token exchange, webhook ingestion, encryption, sync jobs. Strong backend-engineer signal. |
| ORM | **Prisma** | Industry-standard typed ORM; pairs with the shared-types story. |
| Monorepo | **Turborepo** + pnpm workspaces | Shared types between app & backend; "monorepo" is a credible architecture talking point. |
| Device APIs | `expo-contacts`, `expo-sms`, `expo-linking`, `expo-notifications`, `expo-secure-store` | Native integration breadth. |
| Errors/observability | **Sentry** | Production maturity signal. |
| Testing | **Jest + React Native Testing Library**; **Maestro** (E2E); **supertest** (backend) | Maestro is the modern, low-friction RN E2E tool. |
| CI/CD | **GitHub Actions** + **EAS Build/Submit/Update** | Real mobile delivery pipeline. |

**Architecture rationale to say out loud in interviews:** "I used a BaaS (Supabase) for
auth + multi-tenant Postgres with row-level security, and built a focused TypeScript
service for the security-sensitive Plaid integration — webhook-driven sync, encrypted
token storage, idempotent ingestion. Mobile is Expo/RN with TanStack Query, sharing
types with the backend through a Turborepo package."

> **Chosen:** dedicated **NestJS** service for the Plaid integration (token exchange,
> webhooks, encryption, sync jobs). (Alternative considered: Supabase Edge Functions —
> faster to ship, weaker backend-service resume story.)

---

## 3. Repo / monorepo structure

```
budgetApp/
├─ apps/
│  ├─ mobile/                 # Expo RN app (Expo Router)
│  │  ├─ app/                 # routes: (tabs)/, transaction/[id], link, budgets…
│  │  ├─ components/          # design-system + feature components
│  │  ├─ features/            # transactions, budgets, splits, accounts
│  │  ├─ lib/                 # api client, query hooks, formatters (money!)
│  │  └─ theme/               # tokens: color, spacing, type
│  └─ api/                    # NestJS (Plaid integration + split orchestration)
│     ├─ src/plaid/           # link token, public-token exchange, webhooks, sync
│     ├─ src/splits/          # split creation, Venmo link generation
│     └─ src/crypto/          # access-token encryption (AES-GCM / KMS)
├─ packages/
│  ├─ types/                  # shared zod schemas + TS types (Transaction, Split…)
│  ├─ money/                  # integer-cents money helpers (never use floats)
│  └─ config/                 # eslint, tsconfig, tailwind preset
├─ supabase/                  # migrations, RLS policies, seed
├─ docs/
└─ turbo.json, pnpm-workspace.yaml
```

---

## 4. Data model (Postgres)

Money is **always stored as integer cents** (`bigint`), never floats.

- **users** — `id`, `email` (managed by Supabase Auth).
- **plaid_items** — `id`, `user_id`, `institution_name`, `access_token_encrypted`,
  `transactions_cursor`, `status`. One row per linked bank login. *Token never leaves the server.*
- **accounts** — `id`, `item_id`, `user_id`, `plaid_account_id`, `name`, `mask`,
  `type`, `subtype`, `current_balance_cents`, `available_balance_cents`.
- **transactions** — `id`, `account_id`, `user_id`, `plaid_transaction_id` (unique),
  `amount_cents`, `iso_currency`, `date`, `datetime`, `name`, `merchant_name`,
  `pfc_primary`, `pfc_detailed` (Plaid Personal Finance Category), `app_category_id`,
  `lat`, `lon`, `address`, `pending`, `is_transfer`, `personal_share_cents` (nullable).
- **categories** — app-facing buckets: grocery, dining, shopping, investments, savings,
  rent, utilities, subscriptions, loans, transfers, other. Seeded + mapped from Plaid PFC.
- **category_overrides** — `user_id`, `transaction_id` → `app_category_id` (manual recat).
- **budgets** — `user_id`, `category_id`, `period` (month), `limit_cents`.
- **splits** — `id`, `transaction_id`, `created_by`, `type` (`even`|`manual`), `total_cents`.
- **split_participants** — `id`, `split_id`, `display_name`, `venmo_handle`,
  `amount_owed_cents`, `status` (`pending`|`requested`|`settled`).

**"Only show what I owe" logic:** when a split exists,
`personal_share_cents = total_cents − Σ(participants.amount_owed_cents)`. The transaction
row in lists renders `personal_share_cents` when present, else `amount_cents`. Detail view
shows the full breakdown.

---

## 5. Phased roadmap (~12 weeks part-time)

### Phase 0 — Foundations (Week 0–1)
- Turborepo + pnpm, Expo app scaffold, NestJS scaffold, shared `types`/`money` packages.
- GitHub Actions (lint + typecheck + test), Sentry, EAS project.
- Supabase project: schema migrations + **RLS policies** (users see only their rows).
- Auth skeleton (email/OTP + Apple/Google sign-in), tab navigation shell, design tokens.
- Plaid **sandbox** account + keys in secret storage.
- **DoD:** you can sign in, see empty tabs, CI is green.

### Phase 1 — MVP: See your money (Week 2–4)
- Plaid **Link** flow in app → backend `/link/token` + `/item/public_token/exchange`.
- Encrypt + store access token; create `plaid_items` + `accounts`.
- `/transactions/sync` ingestion (added/modified/removed, cursor-based, idempotent).
- Plaid **webhook** endpoint (verify JWT) → trigger sync on `SYNC_UPDATES_AVAILABLE`.
- Category mapping (Plaid PFC → app categories), transaction list, pull-to-refresh.
- Transaction **detail**: location, exact datetime, merchant, raw category.
- **DoD:** connect Chase + SoFi (sandbox), see categorized transactions update near-real-time.

### Phase 2 — Understand your money (Week 5–6)
- Category screen: one tap on a category reveals its payments (the accordion UX you described).
- Budgets per category (set monthly limit) + progress vs. actual.
- Charts: spend-by-category (donut), spend-over-time (line/bar), budget burn-down.
- **DoD:** set a grocery budget, watch the chart + progress update as transactions land.

### Phase 3 — Split your money (Week 7–9)
- Split sheet on a transaction: **even** or **manual** allocation, live remainder validation.
- Contacts: `expo-contacts` (with permission priming UX) → pick friends, attach Venmo handle.
- Generate Venmo deep link (`venmo://paycharge?txn=charge&recipients=&amount=&note=`)
  + prefilled SMS draft / share sheet per participant.
- Persist split + participants; transaction now shows **my share** in lists.
- Mark participant `requested` on send, `settled` manually (v1).
- **DoD:** split a dinner 3 ways, fire off 2 prefilled Venmo requests, list shows only your share.

### Phase 4 — Polish & ship (Week 10–12)
- Transfer detection (Chase↔SoFi) excluded from spend totals.
- Push notifications (budget exceeded, new large transaction).
- Accessibility pass (contrast, dynamic type, VoiceOver labels), empty/error/loading states.
- Maestro E2E happy paths; Sentry release health.
- EAS build → **TestFlight**; App Store privacy disclosures; screenshots/copy.
- **DoD:** installable build on your phone via TestFlight running on real bank data (Plaid Development).

---

## 6. Design direction (simple, convenient, gender-neutral)

- **Palette:** neutral base (warm grays/off-white) + a single non-gendered accent
  (deep teal or indigo) + semantic colors (green=under budget, amber=near, red=over).
  Avoid pink/blue gendered coding entirely.
- **Type:** one clean variable font (e.g. Inter), a tight type scale, generous spacing.
- **Interaction:** category list = tap-to-expand accordion; transaction = tap for detail
  sheet; split = bottom sheet. Big tap targets, minimal chrome, one primary action per screen.
- **Accessibility = design, not afterthought:** WCAG AA contrast, dynamic type, reduced motion.

---

## 7. Security & compliance (non-negotiable for financial data)

- Plaid **access tokens live only server-side**, encrypted at rest (AES-GCM with a KMS-held
  key, or pgcrypto). Never sent to the device, never logged.
- Secrets via env / secret manager — never committed. `.env.example` only in repo.
- **Supabase RLS** enforces per-user data isolation at the database layer.
- **Verify Plaid webhooks** (JWT verification) before acting; ingestion is idempotent.
- Client stores only the session JWT, in `expo-secure-store`.
- No PII/token in logs or Sentry breadcrumbs. Plaid env progression: **sandbox → development → production**.

---

## 8. Resume talking points (what this demonstrates)

- Webhook-driven, cursor-based **data sync architecture** (eventually-consistent ingestion).
- **OAuth-like third-party integration** (Plaid Link) with secure token exchange + encryption.
- **Multi-tenant data isolation** via Postgres Row-Level Security.
- Correct **financial data modeling** (integer-cents money, split allocation math).
- **Monorepo with shared types** end-to-end TypeScript.
- **Custom data-viz** on a native canvas (Skia).
- **Native device integration** (contacts, deep links, SMS, notifications).
- **Mobile CI/CD** with EAS + GitHub Actions, E2E tests, error monitoring.

---

## 9. Decisions (locked)

1. Backend: **dedicated NestJS service** for the Plaid integration.
2. Platforms: **iOS-first** (ship to TestFlight); Android later.
3. Styling: **Tamagui** (design-tokens theming).
