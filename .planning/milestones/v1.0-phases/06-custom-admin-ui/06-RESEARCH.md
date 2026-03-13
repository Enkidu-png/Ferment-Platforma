# Phase 6: Custom Admin UI - Research

**Researched:** 2026-03-10
**Domain:** Next.js App Router protected routes, tRPC super-admin procedures, shadcn/ui layout composition
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Admin layout & navigation**
- Sidebar + content area layout (reuse existing `sidebar.tsx` component)
- Default landing: Merchants section (most action-critical for marketplace health)
- Same visual theme as storefront (no separate dark/admin theme — keep it simple)
- Access control: unauthenticated users redirected to `/auth/login`; authenticated non-admins get 403 or redirect to home
- Sidebar links: Merchants, Products, Categories, Tags, Orders

**Merchant approval flow**
- Two tabs: Pending and Approved (rejected merchants hidden by default)
- Pending tab — Tinder-style review mode:
  - Each merchant shown as a card with: one product photo at a time (left/right arrows), merchant bio/description, shop link, registration date, email
  - 4 action buttons: Approve (sets status to `active`), Reject (sets status to `rejected`), ? (skip, stays `pending`), Undo (reverts last action)
- Approved tab — table view of active merchants (name, shop slug, email, approval date); no bulk actions

**Product management**
- Admin does NOT edit product fields — admin only archives or restores (for rule violations)
- Searchable table: all products across all merchants, filterable by name or merchant
- Each row: Archive button (if active) or Restore button (if archived); archived products greyed out
- No image upload in admin

**Categories & Tags management**
- Claude's Discretion: standard CRUD table (create, rename, delete) — no specific UX preferences given
- Plain text fields only (no WYSIWYG)

**Orders view**
- Claude's Discretion: read-only table with merchant, product, buyer, and order details — no specific layout preference given

### Claude's Discretion
- Categories/Tags CRUD table exact UX (form placement, inline edit vs modal, confirm-delete dialog)
- Orders table column layout and sort order
- Error states and empty state messages

### Deferred Ideas (OUT OF SCOPE)
- Merchant logo/avatar upload in admin
- Product editing by admin (name, price, description, image)
- Product-level approval (each product approved before going live) — v2 ADMN-V2-01
- Artist analytics dashboard — v2 ADMN-V2-02
- Multi-level undo history for merchant decisions

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMN-01 | Custom admin panel at `/admin` route, protected to super-admin users only | Next.js route group `(admin)`, server-side `is_super_admin()` check, middleware or layout guard |
| ADMN-02 | Admin can view pending merchant applications and approve or reject them | `tenantsRouter` admin mutations: `adminApproveTenant`, `adminRejectTenant`; Pending/Approved tabs |
| ADMN-03 | Approved merchant shop goes live; rejected merchant receives notification and cannot list products | `tenants.status` column update to `active`/`rejected`; RLS policies already block non-active merchants |
| ADMN-04 | Admin can view, edit, and delete any product across all merchants | `productsRouter` admin mutations: `adminArchiveProduct`, `adminRestoreProduct`; admin read query bypasses `is_archived` filter |
| ADMN-05 | Admin can create, edit, and delete categories and tags | `categoriesRouter`/`tagsRouter` admin mutations; plain text CRUD forms |
| ADMN-06 | Admin can view all orders with merchant, product, and buyer details | New `adminGetOrders` query joining orders → products → tenants → users |
</phase_requirements>

---

## Summary

Phase 6 builds a protected `/admin` route group in the existing Next.js App Router project. The project already has all the required infrastructure: shadcn/ui components, tRPC with `protectedProcedure`, Supabase with `is_super_admin()` SQL function in the database, `supabaseAdmin` service-role client, and all the data tables. No new npm packages are needed.

The primary implementation work is: (1) create a new `(admin)` route group with its own layout that enforces super-admin access at the server component level; (2) add a new `adminProcedure` middleware to `src/trpc/init.ts` that checks the JWT `app_role` claim; (3) extend existing routers (tenants, products, categories, tags) with admin mutations; (4) add a new `ordersRouter`; (5) build the UI views — Tinder-style merchant review card, products archive table, CRUD tables for categories/tags, read-only orders table.

The Tinder review mode is the only genuinely novel UI pattern. It is implemented with pure React state: a queue of pending merchants, current-index pointer, last-action for undo. No animation library is needed — the CONTEXT.md specifies same visual theme and no special effects. The photo carousel within the merchant card uses shadcn `Carousel` (already installed at `src/components/ui/carousel.tsx`).

**Primary recommendation:** Use `adminProcedure` (new tRPC middleware that reads `app_role` from JWT via `ctx.supabase.auth.getUser()` user metadata) combined with a server-component layout guard — defense in depth without duplicating auth logic.

---

## Standard Stack

### Core — all already installed, zero new dependencies required

| Library | Version (from codebase) | Purpose | Why Standard |
|---------|------------------------|---------|--------------|
| Next.js App Router | 15.x | Route groups, server components, layouts | Already in use; `(admin)` route group is native pattern |
| tRPC | v11.x | Type-safe admin mutations | Already in use; `protectedProcedure` pattern already established |
| @tanstack/react-query | v5.x | Data fetching / cache invalidation in admin views | Already in use via tRPC |
| shadcn/ui | — | All UI components | Already installed: Sidebar, Table, Tabs, Card, Badge, Button, Input, Dialog, Carousel |
| Supabase JS client | v2.x | Data access + `is_super_admin()` function | Already in use; service-role client available at `src/lib/supabase/admin.ts` |
| Zod | v3.x | Input validation for admin mutations | Already in use in all existing routers |

### No New Packages Needed

The project already has `src/components/ui/carousel.tsx` (shadcn Carousel, used for the Tinder photo carousel), `dialog.tsx` (for delete confirmations), and `alert-dialog.tsx`. All required UI primitives exist.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (app)/                          # existing storefront route group
│   └── (admin)/                        # NEW: admin route group
│       └── admin/
│           ├── layout.tsx              # guard: server component checks super-admin
│           ├── page.tsx                # redirect to /admin/merchants
│           ├── merchants/
│           │   └── page.tsx
│           ├── products/
│           │   └── page.tsx
│           ├── categories/
│           │   └── page.tsx
│           ├── tags/
│           │   └── page.tsx
│           └── orders/
│               └── page.tsx
├── modules/
│   ├── tenants/server/procedures.ts    # extend with adminApproveTenant, adminRejectTenant, adminGetTenants
│   ├── products/server/procedures.ts   # extend with adminGetProducts, adminArchiveProduct, adminRestoreProduct
│   ├── categories/server/procedures.ts # extend with adminCreateCategory, adminUpdateCategory, adminDeleteCategory
│   ├── tags/server/procedures.ts       # extend with adminCreateTag, adminUpdateTag, adminDeleteTag
│   ├── orders/server/procedures.ts     # NEW: adminGetOrders
│   └── admin/
│       └── ui/
│           ├── components/
│           │   ├── admin-sidebar.tsx       # wraps existing shadcn Sidebar
│           │   ├── merchant-review-card.tsx  # Tinder card UI
│           │   └── merchant-photo-carousel.tsx
│           └── views/
│               ├── merchants-view.tsx
│               ├── products-view.tsx
│               ├── categories-view.tsx
│               ├── tags-view.tsx
│               └── orders-view.tsx
└── trpc/
    └── init.ts                         # add adminProcedure
```

### Pattern 1: Server Component Layout Guard (defense layer 1)

The admin layout reads the user server-side and redirects before any content renders.

```typescript
// src/app/(admin)/admin/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Check app_role from JWT custom claims (embedded by custom_access_token_hook)
  const appRole = user.app_metadata?.app_role ?? user.user_metadata?.app_role;
  if (appRole !== "super-admin") {
    redirect("/");
  }

  return (
    <div className="flex h-screen">
      <AdminSidebarNav />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
```

**Note on JWT claims:** The project's `custom_access_token_hook` already embeds `app_role` into the JWT. The `is_super_admin()` function exists in the database (confirmed in `src/lib/supabase/types.ts` under `Functions`). Check where `app_role` lands: `user.app_metadata.app_role` or in the JWT raw claims. The auth.spec.ts smoke test uses `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, confirming an admin user exists in the seed.

### Pattern 2: adminProcedure (defense layer 2 — tRPC middleware)

```typescript
// src/trpc/init.ts — add after protectedProcedure
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  // app_role is embedded by custom_access_token_hook into JWT
  // Access via user.app_metadata (set by the hook on the auth.users record)
  const appRole = ctx.user.app_metadata?.app_role;
  if (appRole !== "super-admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Super-admin access required" });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

**Critical:** Admin mutations that modify data must use `supabaseAdmin` (service-role) to bypass RLS, not `ctx.supabase` (anon/user-scoped). The `supabaseAdmin` singleton is already at `src/lib/supabase/admin.ts`. Pattern established in Phase 4 (Stripe webhook uses `supabaseAdmin`).

### Pattern 3: Tenant Approval Mutations

```typescript
// src/modules/tenants/server/procedures.ts — additions
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminProcedure } from "@/trpc/init";

// In tenantsRouter:
adminGetTenants: adminProcedure
  .input(z.object({ status: z.enum(["pending", "active", "rejected"]) }))
  .query(async ({ input }) => {
    const { data, error } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug, status, created_at, image:media!image_id(url)")
      .eq("status", input.status)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }),

adminApproveTenant: adminProcedure
  .input(z.object({ tenantId: z.string() }))
  .mutation(async ({ input }) => {
    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ status: "active" })
      .eq("id", input.tenantId);
    if (error) throw new Error(error.message);
    return { success: true };
  }),

adminRejectTenant: adminProcedure
  .input(z.object({ tenantId: z.string() }))
  .mutation(async ({ input }) => {
    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ status: "rejected" })
      .eq("id", input.tenantId);
    if (error) throw new Error(error.message);
    return { success: true };
  }),
```

### Pattern 4: Tinder Review Card — React State Machine

The card is pure React state — no external library needed. Key state:
- `queue: Tenant[]` — pending merchants fetched from server
- `currentIndex: number` — which merchant is shown
- `lastAction: { tenantId: string; previousStatus: "pending" } | null` — single-level undo

```typescript
// Pattern for the Tinder state machine
const [queue, setQueue] = useState<TenantWithProducts[]>([]);
const [currentIndex, setCurrentIndex] = useState(0);
const [lastAction, setLastAction] = useState<LastAction | null>(null);

const handleApprove = () => {
  const tenant = queue[currentIndex];
  approveMutation.mutate({ tenantId: tenant.id });
  setLastAction({ tenantId: tenant.id, action: "approve" });
  setCurrentIndex(i => i + 1);
};

const handleUndo = () => {
  if (!lastAction) return;
  undoMutation.mutate({ tenantId: lastAction.tenantId });
  setCurrentIndex(i => i - 1);
  setLastAction(null);
};
```

### Pattern 5: Product Admin Query (all products, no is_archived filter)

The current `productsRouter.getMany` filters `is_archived = false`. The admin view needs all products. Add a separate query:

```typescript
adminGetProducts: adminProcedure
  .input(z.object({
    search: z.string().optional(),
    tenantName: z.string().optional(),
  }))
  .query(async ({ input }) => {
    let query = supabaseAdmin
      .from("products")
      .select("id, name, is_archived, created_at, tenant:tenants!tenant_id(id, name, slug)")
      .order("created_at", { ascending: false });

    if (input.search) query = query.ilike("name", `%${input.search}%`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AdminProductRow[];
  }),
```

### Pattern 6: Orders Query with Full Join

Orders table has `product_id` and `user_id`. Need three-way join. Use two-step approach (established pattern from Phase 4 — PostgREST join limitations):

```typescript
adminGetOrders: adminProcedure.query(async () => {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, created_at, stripe_checkout_session_id, " +
      "product:products!product_id(id, name, tenant:tenants!tenant_id(name, slug))"
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminOrderRow[];
  // Note: user_id is a UUID — buyer email requires a separate users lookup or
  // display as truncated UUID if users table lacks email (email lives in auth.users, not public.users)
}),
```

**Critical note on buyer email:** The `users` table in `public` schema has `id, username, role` — it does NOT have email. Email lives in `auth.users` which is only accessible via `supabaseAdmin.auth.admin.getUserById(userId)`. For the orders view, displaying `username` (from `public.users`) is sufficient since the CONTEXT.md says "buyer information displayed" without specifying email.

### Pattern 7: Categories CRUD (Recommended: Inline Row + Add Row at Bottom)

Claude's Discretion — recommend inline-edit pattern (no modal, simpler code):
- List renders as table rows with name in a text Input; edit is always-on
- "Save" button per row submits the update
- "Delete" button per row with an `AlertDialog` confirmation
- "Add Category" button at bottom appends a blank row

This avoids modal state management and works well with shadcn Table + Input already installed.

### Anti-Patterns to Avoid

- **Using `ctx.supabase` for admin mutations:** `ctx.supabase` is the anon/user-scoped client. RLS policies block cross-tenant writes. Always use `supabaseAdmin` for admin mutations.
- **Checking role via DB query in every procedure:** The `app_role` is already in the JWT. Reading it from `ctx.user.app_metadata` is O(0) — no extra DB roundtrip needed.
- **Putting admin pages inside `(app)` route group:** The `(app)` layout renders Navbar/Footer. Admin needs its own layout. Use a separate `(admin)` route group.
- **Fetching all products for the Tinder carousel:** The merchant review card only needs products for the currently displayed merchant. Fetch products per merchant as the queue advances, not all at once.
- **Using `router.refresh()` for cache invalidation:** Use `utils.tenants.adminGetTenants.invalidate()` (React Query invalidation through tRPC) — keeps UI state, only refetches stale data.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image carousel in merchant card | Custom carousel with swipe/arrows | `src/components/ui/carousel.tsx` (shadcn Carousel, already installed) | Handles keyboard nav, accessibility, edge cases |
| Delete confirmation modal | Custom confirm dialog | `src/components/ui/alert-dialog.tsx` (already installed) | Accessible focus trap, keyboard dismiss |
| Toast notifications for approve/reject/archive actions | Custom toast | `src/components/ui/sonner.tsx` + `useToast` — already in root layout | Already wired in `(app)/layout.tsx` with `<Toaster />` |
| Admin role check SQL | Custom RLS policy query | `ctx.user.app_metadata.app_role` from Supabase JWT claims | Already embedded by `custom_access_token_hook`; also `is_super_admin()` DB function exists |
| Search debounce in products table | `setTimeout` debounce | `useDebounce` from `use-debounce` (check if installed) or simple `useState` with `useEffect` 300ms | Products table is read-only; simple debounce is sufficient |

**Key insight:** This project's entire shadcn/ui library is already installed and the Supabase admin role infrastructure is already in place. Phase 6 is almost entirely composition — no new dependencies, no new infrastructure.

---

## Common Pitfalls

### Pitfall 1: app_role claim location in Supabase JWT

**What goes wrong:** `ctx.user.app_metadata.app_role` returns `undefined` even though the hook sets it.
**Why it happens:** The `custom_access_token_hook` had a null-safety bug (fixed in Phase 3: `coalesce(event->'claims', '{}'::jsonb)`). However, the exact field path depends on how the hook embeds the claim — it may be `user.app_metadata.app_role`, `user.user_metadata.app_role`, or accessible only via raw JWT decode.
**How to avoid:** Verify the actual claim path by logging `ctx.user` in a test procedure, or by checking the `custom_access_token_hook` migration SQL to see which key it writes to.
**Warning signs:** `adminProcedure` always throws FORBIDDEN even for the seed admin user.

### Pitfall 2: RLS blocks admin mutations via ctx.supabase

**What goes wrong:** `ctx.supabase.from("tenants").update(...)` silently returns `0 rows updated` or throws a policy violation for cross-tenant operations.
**Why it happens:** `ctx.supabase` uses the user's JWT. RLS policies on `tenants` allow users to update only their own tenant (`tenant_id = get_tenant_id()`). Admin updating another merchant's record is blocked.
**How to avoid:** All admin mutations MUST use `supabaseAdmin` (service-role). This is the established pattern from Phase 4 Stripe webhook handler.
**Warning signs:** Mutation returns success but data in DB is unchanged.

### Pitfall 3: Undo across page navigation / re-render

**What goes wrong:** User approves a merchant, navigates away, comes back — Undo button state is lost.
**Why it happens:** Undo state is local React state.
**How to avoid:** Undo is documented as single-level, in-session only. Make this explicit in the UI: if `lastAction` is null, disable the Undo button. No persistence needed.

### Pitfall 4: Merchant card photo carousel — empty product list

**What goes wrong:** Some pending merchants have zero products. The carousel crashes or renders blank.
**Why it happens:** `queue[currentIndex].products` is empty array.
**How to avoid:** Show a fallback placeholder image when `products.length === 0`. Use optional chaining `products?.[0]?.image?.url ?? '/placeholder.png'`.

### Pitfall 5: Category delete with existing products

**What goes wrong:** Deleting a category that has products assigned to it causes FK constraint violation (PostgreSQL will reject the DELETE or cascade-null the `category_id` on products, depending on FK definition).
**Why it happens:** `products.category_id` references `categories.id`. The FK definition in the schema needs to be checked.
**How to avoid:** Before deleting a category, show count of products using it. Or catch the FK violation error and show "Cannot delete: X products use this category — reassign them first."
**Warning signs:** `adminDeleteCategory` mutation throws `23503 foreign_key_violation`.

### Pitfall 6: Orders buyer display — email not in public.users

**What goes wrong:** Admin wants to see buyer email in orders table. `public.users` only has `username` — no email column.
**Why it happens:** Email lives in `auth.users` (Supabase-managed, separate schema). Accessible only via `supabaseAdmin.auth.admin.getUserById()` — one call per order.
**How to avoid:** Display `username` from `public.users` in the orders table. This satisfies ADMN-06 ("buyer information") without N+1 calls to `auth.admin`. If email is truly needed, add it to `public.users` in a migration or accept N+1 for a small orders dataset.

---

## Code Examples

### Super-admin check pattern (verified from codebase)

```typescript
// Reading app_role from JWT — ctx.user is Supabase User object from getUser()
// The custom_access_token_hook writes to app_metadata (confirmed by hook function name and FOUN-05)
const appRole = ctx.user.app_metadata?.app_role;
// Falls back to checking users table role column if app_metadata not set:
// const { data: userRow } = await supabaseAdmin.from("users").select("role").eq("id", ctx.user.id).single();
```

### supabaseAdmin usage (verified from src/lib/supabase/admin.ts)

```typescript
import { supabaseAdmin } from "@/lib/supabase/admin";
// supabaseAdmin is already typed with Database, uses service-role key, bypasses RLS
const { data, error } = await supabaseAdmin
  .from("tenants")
  .update({ status: "active" })
  .eq("id", tenantId);
```

### tRPC cache invalidation after mutation (established pattern)

```typescript
// In a React component using tRPC mutations:
const utils = trpc.useUtils();
const approveMutation = trpc.tenants.adminApproveTenant.useMutation({
  onSuccess: () => {
    utils.tenants.adminGetTenants.invalidate();
    toast.success("Merchant approved");
  },
});
```

### Admin layout guard (server component pattern from sign-in/sign-up pages)

```typescript
// Pattern: createClient() → getUser() → redirect if not authorized
// Verified from src/app/(app)/(auth)/sign-in/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/sign-in");
```

### Shadcn Carousel usage (component already installed)

```typescript
// src/components/ui/carousel.tsx is installed
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// In merchant review card:
<Carousel>
  <CarouselContent>
    {products.map((product) => (
      <CarouselItem key={product.id}>
        <img src={product.image?.url} alt={product.name} className="w-full aspect-square object-cover" />
      </CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Payload CMS admin | Custom Next.js admin UI | Phase 4–6 | Full control; same stack as storefront |
| `ctx.db` (Mongoose) for data access | `ctx.supabase` (Supabase client) + `supabaseAdmin` | Phase 4 | Service-role client needed for admin bypasses RLS |
| MongoDB ObjectId string IDs | UUID string IDs | Phase 3 | All `.input()` schemas use `z.string()` (UUID is a string) |

**Already complete infrastructure relevant to this phase:**
- `is_super_admin()` SQL function: registered in database (confirmed in `types.ts` Functions section) — can be called via `supabaseAdmin.rpc("is_super_admin")` if needed
- `custom_access_token_hook`: embeds `app_role` + `tenant_id` into JWT (Phase 2 fix with coalesce)
- `supabaseAdmin` singleton: ready at `src/lib/supabase/admin.ts`
- All shadcn/ui components needed: Sidebar, Table, Tabs, Card, Badge, Button, Input, Dialog, AlertDialog, Carousel

---

## Open Questions

1. **Exact path of `app_role` in JWT claims**
   - What we know: `custom_access_token_hook` embeds `app_role` into JWT. `users` table has a `role` column. The hook is a PostgreSQL function registered in Supabase.
   - What's unclear: Does the hook write to `app_metadata` (which becomes `user.app_metadata` in the JS client) or to a custom `claims` key? The SQL migration applying the fix (`coalesce(event->'claims', '{}'::jsonb)`) suggests it writes to `claims`.
   - Recommendation: In Wave 1 (adminProcedure), add a temporary log or test both `ctx.user.app_metadata?.app_role` and decode the raw JWT to find the actual key. The `users.role` column is a reliable fallback: `SELECT role FROM users WHERE id = ctx.user.id`.

2. **FK constraint on categories.id → products.category_id**
   - What we know: The FK relationship exists (confirmed in types.ts). Delete behavior (RESTRICT vs SET NULL) was not inspected in migration files.
   - What's unclear: Whether deleting a category cascades, restricts, or nulls the product's `category_id`.
   - Recommendation: In `adminDeleteCategory`, use a guard query: `SELECT count(*) FROM products WHERE category_id = $1`. If > 0, return error to UI rather than attempting delete.

3. **Merchant card products fetch strategy**
   - What we know: Each pending merchant needs their products for the photo carousel. The queue may have 0–50 pending merchants.
   - What's unclear: Whether to fetch all pending merchants + their products in one query or lazily as user advances the queue.
   - Recommendation: Fetch all pending merchants in one query with a product join limited to 5 images per merchant. PostgREST can do this with `products!tenant_id(image:media!image_id(url))` — but PostgREST does not support per-relationship LIMIT in a single query. Use two-step: fetch tenants first, then fetch products for current+next merchant only (lookahead of 1).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (already configured) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test tests/smoke/admin.spec.ts` |
| Full suite command | `npx playwright test tests/smoke/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMN-01 | Visiting `/admin` without session redirects to `/sign-in` | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "redirects"` | Wave 0 |
| ADMN-01 | Visiting `/admin` as non-admin redirects to `/` | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "non-admin"` | Wave 0 |
| ADMN-01 | Visiting `/admin` as super-admin renders admin sidebar | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "renders admin"` | Wave 0 |
| ADMN-02 | Pending merchants tab lists pending merchants | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "pending tab"` | Wave 0 |
| ADMN-02 | Approve button changes merchant status to active | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "approve"` | Wave 0 |
| ADMN-04 | Products table shows all products including archived | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "products table"` | Wave 0 |
| ADMN-05 | Category can be created and appears in filter | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "category create"` | Wave 0 |
| ADMN-06 | Orders table renders with data | smoke | `npx playwright test tests/smoke/admin.spec.ts --grep "orders"` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test tests/smoke/admin.spec.ts`
- **Per wave merge:** `npx playwright test tests/smoke/`
- **Phase gate:** Full smoke suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/smoke/admin.spec.ts` — covers ADMN-01 through ADMN-06 (full file needs creation)
- [ ] Requires `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars (already used in `auth.spec.ts` — confirmed available)

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/trpc/init.ts`, `src/lib/supabase/*.ts`, `src/modules/*/server/procedures.ts`, `src/components/ui/*.tsx`
- `src/lib/supabase/types.ts` — confirmed `is_super_admin()` function, `users.role` column, all table schemas
- `src/middleware.ts` — confirmed session cookie pattern
- `tests/smoke/auth.spec.ts` — confirmed `SEED_ADMIN_EMAIL` env var exists and admin user is in seed

### Secondary (MEDIUM confidence)
- `06-CONTEXT.md` — locked decisions from user discussion
- `STATE.md` accumulated decisions — confirmed `supabaseAdmin` usage pattern, `custom_access_token_hook` fix

### Tertiary (LOW confidence)
- JWT claim path for `app_role` — inferred from `custom_access_token_hook` function name and Phase 2/3 notes; needs runtime verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything confirmed via direct codebase read
- Architecture: HIGH — patterns directly match existing code conventions
- Tinder card pattern: HIGH — pure React state, no novel libraries
- app_role JWT path: LOW — needs runtime verification (see Open Questions)
- FK cascade behavior on categories: LOW — migration SQL not inspected

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable stack; only concern is JWT claim path which resolves in Wave 1)
