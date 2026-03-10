# Phase 6: Custom Admin UI - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A protected `/admin` route where a super-admin manages the marketplace. Covers: merchant approval/rejection, product moderation (archive/restore), category and tag management, and order viewing. Does NOT cover merchant self-service features (merchants manage their own products/images through the storefront). No new marketplace features — admin tooling only.

</domain>

<decisions>
## Implementation Decisions

### Admin layout & navigation
- Sidebar + content area layout (reuse existing `sidebar.tsx` component)
- Default landing: Merchants section (most action-critical for marketplace health)
- Same visual theme as storefront (no separate dark/admin theme — keep it simple)
- Access control: unauthenticated users redirected to `/auth/login`; authenticated non-admins get 403 or redirect to home
- Sidebar links: Merchants, Products, Categories, Tags, Orders

### Merchant approval flow
- Two tabs in the Merchants section: **Pending** and **Approved** (rejected merchants are hidden by default to avoid clutter)
- **Pending tab** — Tinder-style review mode:
  - Each merchant shown as a card with: one product photo at a time (left/right arrows to cycle through), merchant bio/description, shop link, registration date, email
  - 4 action buttons: **Approve** (shop goes live), **Reject** (merchant blocked), **?** (skip, stays pending), **Undo** (revert the previous decision)
  - Approve = sets tenant status to `active`; Reject = sets tenant status to `rejected`; ? = leaves as `pending`; Undo = reverts last action
- **Approved tab** — table view of active merchants (name, shop slug, email, approval date); no bulk actions needed

### Product management
- Admin does NOT edit product fields — editing is the merchant's responsibility
- Admin function: search/find a product and archive or restore it (for rule violations)
- Searchable table: all products across all merchants, filterable by name or merchant
- Each row: Archive button (if active) or Restore button (if archived); archived products visually greyed out
- No image upload in admin — out of scope

### Categories & Tags management
- Claude's Discretion: standard CRUD table (create, rename, delete) — no specific UX preferences given
- Plain text fields only (no WYSIWYG — already decided in project requirements)

### Orders view
- Claude's Discretion: read-only table with merchant, product, buyer, and order details — no specific layout preference given

</decisions>

<specifics>
## Specific Ideas

- The Tinder review mode is the primary UX differentiator — the goal is to make it fast to distinguish quality merchants from poor ones by seeing their actual products and bio in one view
- Photo carousel in the merchant card should feel like Tinder: one image at a time, arrow buttons to cycle through product photos
- The ? (question mark) action is important — it lets admin come back to uncertain merchants without committing to approve or reject
- Undo should only revert the immediately previous action (single-level undo, not full history)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/sidebar.tsx`: Existing sidebar component — use directly for admin layout
- `src/components/ui/table.tsx`: shadcn Table — use for all admin list views (merchants, products, orders)
- `src/components/ui/dialog.tsx`: shadcn Dialog — available if needed for confirmations
- `src/components/ui/badge.tsx`: shadcn Badge — use for status labels (Pending, Approved, Rejected, Archived)
- `src/components/ui/button.tsx`: shadcn Button — Approve/Reject/Archive/Restore actions
- `src/components/ui/tabs.tsx`: shadcn Tabs — Pending/Approved tabs in Merchants section
- `src/components/ui/card.tsx`: shadcn Card — use for Tinder merchant card
- `src/components/ui/input.tsx`: shadcn Input — search box in Products table
- `src/lib/supabase/types.ts`: Generated types for tenants, products, orders, categories, tags

### Established Patterns
- tRPC `protectedProcedure` for all admin mutations (auth check via `ctx.supabase`)
- Admin-specific mutations need an additional super-admin role check (read `app_role` from JWT claims)
- All routers follow: `createTRPCRouter({...})` in `src/modules/{feature}/server/procedures.ts`
- React Query via tRPC for all data fetching in admin views

### Integration Points
- `src/modules/tenants/server/procedures.ts`: Add admin mutations to approve/reject tenants (update `status` column)
- `src/modules/products/server/procedures.ts`: Add admin mutations to archive/restore products (`is_archived` column)
- `src/modules/categories/server/procedures.ts`: Already exists — extend with admin create/update/delete
- `src/modules/tags/server/procedures.ts`: Already exists — extend with admin create/update/delete
- No `/admin` route exists yet — create as a new route group, e.g., `src/app/(admin)/admin/`

</code_context>

<deferred>
## Deferred Ideas

- Merchant logo/avatar upload in admin — merchant self-service feature, not admin concern
- Product editing by admin (name, price, description, image) — admin only needs to archive/restore
- Product-level approval (each product approved before going live) — explicitly in v2 requirements (ADMN-V2-01)
- Artist analytics dashboard — v2 (ADMN-V2-02)
- Multi-level undo history for merchant decisions — single-level undo is sufficient for v1

</deferred>

---

*Phase: 06-custom-admin-ui*
*Context gathered: 2026-03-10*
