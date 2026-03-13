# Plan 03-01 Summary — Seed Script

**Status:** Complete
**Executed:** 2026-03-06

## What was built

- `scripts/seed.ts` — idempotent Supabase seed script, run with `npx tsx --env-file=.env.local --env-file=.env scripts/seed.ts`
- `.env.local` — created with `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ARTIST_PASSWORD`

## Auth users created

- `admin@ferment.com` — role `super-admin` in public.users
- `artist1@test.ferment.com` — tenant `ceramics-by-ana`
- `artist2@test.ferment.com` — tenant `woodworks-jan`
- `artist3@test.ferment.com` — tenant `print-studio-mia`

## Tenant slugs seeded

- `ceramics-by-ana` (status: approved, stripe_account_id: placeholder_ceramics-by-ana)
- `woodworks-jan` (status: approved, stripe_account_id: placeholder_woodworks-jan)
- `print-studio-mia` (status: approved, stripe_account_id: placeholder_print-studio-mia)

## Categories

8 parent categories matching `customOrder` in `src/modules/categories/server/procedures.ts`:
`all`, `clothes`, `jewelery`, `posters`, `pottery`, `tattoos`, `music`, `accessories`
Plus 38 subcategories.

## Products

20 products: 7 for ceramics-by-ana (pottery), 6 for woodworks-jan (accessories), 7 for print-studio-mia (posters).

## Run command

```bash
npx tsx --env-file=.env.local --env-file=.env scripts/seed.ts
```

## Verification

- First run: all CREATE lines, exit 0
- Second run: all SKIP lines, exit 0 (idempotent confirmed)

## Deviations / surprises

- Woodworks Jan products use the parent `accessories` slug rather than a subcategory — the accessory subcategories are furniture/homewares not a perfect fit, but acceptable for test data
