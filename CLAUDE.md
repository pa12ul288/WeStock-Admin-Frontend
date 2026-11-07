# WeSTOCK Admin — project guide for Claude Code

## What we are building

A web dashboard for **brainwired staff** to view and fix the data farmers enter in the **WeSTOCK** app
(a Flutter livestock farm-management app backed by Supabase). Scope is "basic farm management only".

**Current phase: frontend only.** The app runs on a built-in demo data layer (no backend) and is
deployed to **Vercel** as a working, clickable demo. Every button works and changes persist in the
browser. Supabase is connected in a later phase by adding a second data adapter. **No screen or
component may change when that happens.**

## Sources of truth (check them in this order)

1. `design/screens/` shows how each screen must look: `desktop/` at 1440 px, `phone/` at 390 px, `dialogs/`.
2. `design/prototype/*.dc.html` gives the exact wording, sample data and interactions. Read the markup for copy and
   layout, and the `class Component … renderVals()` block at the bottom for sample data and behaviour.
   This is a design-tool format: read it, don't run it, don't copy its markup verbatim.
3. `docs/product-spec.md` covers scope, the parts of each screen, roles and permissions.
4. `docs/data-contract.md` has the TypeScript types and the `DataSource` interface. **Never change field names**:
   they mirror the Supabase schema in `docs/backend-later/app-schema/`.
5. `docs/demo-data.md` describes what the demo data must contain.
6. `docs/developer-guide.md` covers the later Supabase phase. Use its screen build sheet for which data each
   screen needs; ignore its SQL and deploy steps for now.

If these disagree, the screenshots win for looks, the prototype wins for wording, and the spec wins for
scope. If something is still unclear, ask instead of inventing.

## Stack (fixed, don't swap)

Vite · React 18 · TypeScript (strict) · React Router 6 · TanStack Query 5 · React Hook Form + Zod ·
Recharts · CSS Modules + CSS variables (`src/styles/tokens.css`) · Vitest + Testing Library · Playwright ·
ESLint + Prettier · npm. No UI kit (no MUI, Chakra, Tailwind or shadcn): components are hand-built to match the design.

## Commands

```bash
npm run dev         # http://localhost:5173
npm run build       # type-check + production build to dist/
npm run typecheck
npm run lint
npm test            # vitest
npm run e2e         # playwright (starts the dev server)
npm run shots       # playwright: screenshot every route at 1440 and 390 into .shots/
```

## Folder layout

```text
src/
  app/          router, AppShell (Sidebar + TopBar), AuthGate, RoleGate, providers
  components/   shared UI: KpiCard, StatusPill, DataTable, Pagination, FilterBar, Modal,
                ConfirmDialog, Toast, Segmented, EmptyState, charts/
  data/         types.ts, source.ts (DataSource interface), index.ts (picks the adapter),
                demo/ (seed.ts, store.ts, adapter.ts), supabase/ (later: adapter.ts)
  features/     one folder per screen: dashboard/ farmers/ farm/ livestock/ animal/
                reproduction/ milk-feed/ health/ analytics/ staff/ auth/
                each with queries.ts (TanStack hooks), components and the route page
  lib/          format.ts (₹, litres, dates in India time), csv.ts, url-state.ts
  styles/       tokens.css, global.css
e2e/            playwright specs, one per screen
```

## Architecture rules

- **Components never touch data directly.** A page calls hooks in `features/<x>/queries.ts`; hooks call
  `dataSource` from `src/data/index.ts`; that picks the adapter from `VITE_DATA_SOURCE` (`demo` now,
  `supabase` later).
- **Demo adapter** (`src/data/demo/`), built exactly as specified in `docs/data-contract.md`:
  - the seed is generated deterministically at startup (fixed random seed), so every visitor sees the same farms
  - writes are stored as a small change log in `localStorage` (`westock-admin-demo-v1`) and replayed on load,
    so edits survive a reload; "Reset demo data" in the user menu clears it
  - 150–300 ms simulated latency on every call
  - **every write appends an activity-log entry** shaped like `admin_audit_log` (who, action, table, record,
    farm, changes `{field: {from, to}}`, note), mimicking the database trigger
  - **enforce roles in the adapter too**, throwing `DataError('not_allowed')`, exactly as the database will
- **Demo sign-in:** the sign-in page accepts the five demo staff accounts in `docs/demo-data.md` with any
  password of 6+ characters. "Forgot password" shows the "check your email" message. A **"Demo" badge** and a
  **role switcher** (Super admin / Support / Viewer) sit in the user menu so reviewers can try each role.
- **Errors:** the adapter throws `DataError` with a code (`not_allowed`, `reason_required`, `not_found`,
  `duplicate_tag`, `validation`). `lib/errors.ts` maps codes to the user messages listed in the data contract.
- **Server state** lives in TanStack Query; after a write, invalidate the affected lists and totals.
  **Filters, tabs and pages** live in the URL query (`lib/url-state.ts`). No global store library.

## Roles (UI and adapter must agree)

| Action | Super admin | Support | Viewer |
| --- | --- | --- | --- |
| See everything, export CSV, see the activity log | yes | yes | yes |
| Add or edit animals, sheds, members, farm details; fix or delete milk and feed; mark vaccines, health, slips; schedules; breeding records; transfer ownership | yes | yes | no |
| Delete a farm | yes | no | no |
| Invite, remove, change staff roles | yes | no | no |

Hide controls a role can't use (don't just disable them), and keep exports and the log visible for everyone.

## Design rules

- Use **only** the CSS variables in `src/styles/tokens.css`; values are in `docs/developer-guide.md` →
  "Design tokens". Navy `#0F1B2D` sidebar, green `#2ED08C` primary buttons with navy text, page `#F4F6F5`.
- Fonts: **Poppins** (titles, numbers with tabular figures) and **Nunito** (everything else, 14 px base),
  with **Noto Sans Devanagari, Malayalam, Gujarati and Tamil** as fallbacks for farmer names and notes.
- Section colours: breeding pink, health red, vaccines blue, milk teal, feed orange. Status pills always say
  their state in words; colour is never the only signal.
- **Phone (≤ 900 px):** sidebar becomes a horizontal scroll strip at the top; cards stack in one column;
  tables scroll sideways **inside their card**; the page itself must never scroll sideways at 390 px.
- **Accessibility:** every input has a label; modals trap focus and close on Escape; segmented controls
  use `aria-pressed`; icon-only buttons have `aria-label`; visible focus ring.
- **Formats:** India time (Asia/Kolkata); dates like `05 Nov 2026`; ₹ with Indian grouping (₹1,23,456);
  litres to 1 decimal; phone numbers shown masked like the prototype (`+91 98220 •••41`).
- **Copy:** take every label, button and message from the prototype. Plain words, no database terms.

## Scope

Phase 1 screens and routes. Build only these:

| Screen | Route |
| --- | --- |
| Sign in, forgot password | `/login` |
| Dashboard | `/` |
| Farmers & farms | `/farmers` (`?view=farmers` or `farms`) |
| Farm page | `/farms/:id` |
| Livestock | `/livestock` |
| Animal page | `/animals/:id` |
| Reproduction | `/reproduction` |
| Milk & feed | `/milk-feed` |
| Health & vaccines | `/health` |
| Analytics | `/analytics` |
| Staff & activity log | `/staff` |

**Out of scope, don't build:** Devices, Support inbox, Notifications, Account requests, Species, Gau,
Weather, and any real backend, email or authentication.

## Definition of done (every screen)

- Matches its desktop and phone screenshots closely: layout, spacing, colours, copy.
- Every button, filter, tab, dialog and export works on demo data, and changes survive a reload.
- Loading (skeletons), empty ("Nothing matches… Clear filters") and error states exist.
- Role gating works for all three roles.
- `npm run typecheck && npm run lint && npm test && npm run build` pass.
- An e2e spec in `e2e/` covers the screen's main flows, and `npm run shots` shows no sideways scroll at 390 px.

## How to work in this repo

- Work through `PROMPTS.md` one milestone at a time: finish, verify, commit. With `/build-all`, push and go straight on
  to the next milestone; with `/milestone N`, stop and summarise.
- The GitHub repo is **public**: never commit secrets, `.env` files or real farmer data, and keep
  `docs/backend-later/` out of git.
- Before saying a milestone is done, run the checks above, run `npm run shots`, open the new screenshots and
  compare them with `design/screens/`. Fix differences you can see.
- Small commits with clear messages (`feat(livestock): add animal dialog`). Never commit `.env*` files except
  `.env.example`.
- Don't add libraries beyond the stack without asking. Don't rename data-contract fields.
- Keep components small and typed; no `any` in `src/data`.
