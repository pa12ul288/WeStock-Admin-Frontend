# Build prompts

**Easiest:** type `/build-all <your GitHub repo link>` once. Claude Code works through every milestone
below on its own, commits and pushes after each one, and keeps a progress log in `BUILD_LOG.md`. If it gets
interrupted, type `/build-all` again and it carries on where it stopped.

**Step by step instead:** type `/milestone 0`, then `/clear` and `/milestone 1`, and so on.

---

## M0 · Scaffold

```text
Read CLAUDE.md, docs/product-spec.md and docs/data-contract.md first.

Set up the project exactly as CLAUDE.md describes:
- Vite + React 18 + TypeScript (strict, noUncheckedIndexedAccess) with the folder layout from CLAUDE.md
- dependencies: react-router-dom@6, @tanstack/react-query@5, react-hook-form, zod, @hookform/resolvers, recharts
- dev: vitest, @testing-library/react, @testing-library/user-event, jsdom, @playwright/test, eslint, prettier
- npm scripts: dev, build (tsc -b && vite build), typecheck, lint, test, e2e, shots
- e2e/shots.spec.ts: visits every phase 1 route at 1440x900 and 390x844, saves full-page screenshots to
  .shots/<route>-<width>.png, and FAILS if document.documentElement.scrollWidth > viewport width
- src/styles/tokens.css with every token from docs/developer-guide.md ("Design tokens and shared components"),
  and global.css (Nunito body 14px, Poppins headings, the Noto fallbacks, page background)
- load fonts from Google Fonts in index.html (Poppins 500/600, Nunito 400-800, Noto Sans Devanagari, Malayalam,
  Gujarati, Tamil)
- vercel.json and .env.example from this repo (already present, keep them)
- .github/workflows/ci.yml: npm ci, typecheck, lint, test, build on every push
- placeholder routes for every phase 1 screen (title only), so navigation works

Done when: all npm scripts run, the build passes, and CI is green. Commit "chore: scaffold".
```

## M1 · Data layer and demo adapter

```text
Read CLAUDE.md, docs/data-contract.md and docs/demo-data.md.

Build src/data/:
- types.ts and source.ts exactly as written in the data contract (copy the types, no renames)
- errors.ts (DataError) and src/lib/errors.ts (code → message table from the contract)
- demo/seed.ts: deterministic generator for everything in docs/demo-data.md, including the featured farms,
  animals and staff with their exact names; all dates relative to today in Asia/Kolkata
- demo/store.ts: in-memory tables, plus a change log persisted to localStorage['westock-admin-demo-v1'] and
  replayed on load; reset; survives a corrupt log
- demo/adapter.ts: implements EVERY DataSource method with 150-300 ms latency, role checks, validation,
  activity-log entries (one per changed record, only changed fields, notes and reasons) and cascades
- index.ts: exports `dataSource`, picked by import.meta.env.VITE_DATA_SOURCE (default 'demo';
  'supabase' throws "not built yet")

Write vitest tests in src/data/demo/__tests__/ for:
- each role's permissions, matching the table in CLAUDE.md
- fixMilk without a reason throws reason_required; with a reason, the log has {litres:{from,to}} and the note
- a duplicate tag throws duplicate_tag
- deleting a farm removes its children and logs exactly one row
- writes survive a "reload" (new store from the same localStorage), and reset clears them
- the seed is deterministic (same seed gives the same first farm, animal and totals)

Done when: tests pass and the typecheck is clean. No UI changes needed. Commit "feat(data): demo adapter".
```

## M2 · App shell and sign-in

```text
Read CLAUDE.md. Look at design/screens/desktop/01-sign-in.png, 02-dashboard.png (for the sidebar and top bar),
design/screens/phone/01-sign-in.png and 02-dashboard.png, plus design/prototype/Login.dc.html, Sidebar.dc.html
and TopBar.dc.html.

Build:
- /login: matches the screenshot. Email and password, show or hide password, "keep me signed in",
  "Forgot password?" dialog with the "check your email" state, inline errors, and a small "Demo accounts" helper
- AuthGate (redirects to /login), RoleGate helper and a useStaff() hook
- AppShell: navy Sidebar with groups and active state, counts where the prototype shows them, and sign out;
  TopBar with breadcrumb, global search (dataSource.search, keyboard navigable, Enter opens the first hit),
  today's date and an alerts bell with a popover (the needs-attention counts, each linking to its screen)
- user menu: name, role, a "Demo" badge, role switcher (Super admin / Support / Viewer), "Reset demo data"
- Toast provider
- phone layout: the sidebar becomes a horizontal scroll strip; breadcrumb and date are hidden

Done when: sign-in works with each demo account; switching role updates the UI immediately; e2e/auth.spec.ts
covers sign-in, a wrong password, forgot password and sign-out; `npm run shots` passes for /login and /.
Commit "feat: app shell and sign-in".
```

## M3 · Shared components

```text
Read CLAUDE.md ("Design rules") and the shared components table in docs/developer-guide.md.
Look at several desktop and phone screenshots to see how cards, tables, pills, filters, dialogs and toasts look.

Build in src/components/: KpiCard, StatusPill (6 tones), DataTable (sticky header, sorting on dated columns,
row links, loading skeleton, empty state with a "Clear filters" action, horizontal scroll inside the card on
phones, hide-on-phone columns), Pagination (20 per page, "Showing 1–20 of 66"), FilterBar (debounced search
plus selects, synced to the URL through lib/url-state.ts), Segmented (aria-pressed), Modal (focus trap,
Escape, opens near the clicked button on desktop, full width with a 16px margin on phones), ConfirmDialog
(destructive variant with type-to-confirm), EmptyState, Skeleton, and chart wrappers (BarChart, LineChart)
on Recharts using the tokens.

Also lib/format.ts (₹ Indian grouping, litres, kg, dates and times in Asia/Kolkata, relative times like
"20 min ago", masked phone) and lib/csv.ts (UTF-8 with a BOM, proper quoting, chunked fetch helper), with
unit tests.

Add a dev-only route /dev/components that shows every component in each state.
Done when: tests pass and the gallery looks right at 1440 and 390. Commit "feat: shared components".
```

## M4 · Farmers & farms, Farm page

```text
Read CLAUDE.md and the "Farmers & farms" and "Farm page" sections of docs/product-spec.md and
docs/developer-guide.md. Match design/screens/desktop/03-farmers-and-farms.png, 04-farm-page.png,
04b-farm-page-sheds-and-members-tab.png, 04c-farm-page-settings-tab.png, the phone versions, and
design/screens/dialogs/delete-farm.png. Take wording from design/prototype/Farmers.dc.html and FarmDetail.dc.html.

/farmers: Farmers and Farms views, totals cards, search, state and language filters, paging, export CSV
(all matching rows), row click opens the farm (for a farmer: their first farm).

/farms/:id: header (name, owner, place, mode, counts) with Edit farm and Add animal; tabs Overview,
Sheds & members, Farm settings.
- Overview: record cards, milk last 7 days, coming up, latest entries
- Sheds & members: add or edit a shed; add a member (phone lookup, with the "ask them to sign up in the app
  first" message when not found); change a member's role
- Farm settings: details form (name, description, district, state, map pin), alerts (fever temperature,
  collar offline minutes, merged into settings), Transfer ownership (pick a member, optional note), Delete farm
  (super admin only, type the farm name)
All writes go through the DataSource, show a toast, and appear in the activity log. Respect roles.

Done when: e2e/farms.spec.ts covers search, filter, export, every dialog and the role gating; shots pass.
Commit "feat: farmers and farm page".
```

## M5 · Livestock and Animal page

```text
Read CLAUDE.md and the "Livestock" and "Animal page" sections of the spec and the developer guide.
Match 05-livestock.png, 06-animal-page.png (desktop and phone) and dialogs/add-animal.png. Wording from
design/prototype/Livestock.dc.html and Animal.dc.html.

/livestock: totals, species-group tabs, search, filters (farm, collar state, breeding stage, status), paging,
export, Add animal dialog (Pashu Aadhaar exactly 12 digits; duplicate_tag shown on the tag field).

/animals/:id: header with status pill; mark sold or deceased (date and note go into the update's note) and
mark active again; Edit animal form; pregnancy and collar cards (collar only when hardware_tag_id is set);
milk for the last 30 days; vaccinations (add, mark given, undo); health history (add, mark resolved, undo);
reproduction history; photos (generated placeholders).

Done when: e2e covers each action and role gating, and shots pass. Commit "feat: livestock and animal page".
```

## M6 · Reproduction

```text
Read CLAUDE.md and the "Reproduction" sections. Match 07-reproduction.png (desktop and phone) and
dialogs/insemination-slip.png. Wording from design/prototype/Reproduction.dc.html.

/reproduction: totals; "golden period now" cards for animals whose golden_end is within 6 hours, with a
countdown; stage tabs In heat, Inseminated and Pregnant with counts; farm filter; tables per stage as in the
spec; View photo opens the slip dialog with Mark verified; the verified switch in the table; Add cycle
dialog (heat or inseminated, with a tube number when inseminated).

Done when: e2e covers tabs, the farm filter, verify, and adding both kinds of cycle; shots pass.
Commit "feat: reproduction".
```

## M7 · Milk & feed

```text
Read CLAUDE.md and the "Milk & feed" sections. Match 08-milk-and-feed.png (desktop and phone) and
dialogs/fix-milk-entry.png. Wording from design/prototype/MilkFeed.dc.html.

/milk-feed: daily or monthly switch; farm filter; totals; charts (milk by session for 7 days, feed by type
yesterday, milk per month); Milk and Feed tabs with paged tables; Add entry dialog (milk or feed inside);
Fix dialog (reason required, keeps the dialog open on reason_required); Delete confirm; "Fixed by staff"
badge; Download the month's report as CSV.

Done when: e2e covers add, fix (without and with a reason), delete, the badge and the report; shots pass.
Commit "feat: milk and feed".
```

## M8 · Health & vaccines

```text
Read CLAUDE.md and the "Health & vaccines" sections. Match 09-health-and-vaccines.png (desktop and phone) and
dialogs/vaccine-schedule.png. Wording from design/prototype/Health.dc.html.

/health: totals (vaccinations not yet given: overdue, due in 7 days, upcoming; open health issues: sick,
detected, long-term); farm and species filters; Vaccinations and Health issues tabs; Mark given and Undo;
Mark resolved and Undo; Vaccine schedule panel (vaccine, give to all cattle, all buffalo or one animal, farm,
due date, note) whose button reads "Create N reminders" with the live count, then creates them and shows a toast.

Done when: e2e covers filters, mark and undo on both tabs, and creating a schedule; shots pass.
Commit "feat: health and vaccines".
```

## M9 · Staff & activity log

```text
Read CLAUDE.md and the "Staff & activity log" sections. Match 11-staff-and-activity-log.png (desktop and
phone) and dialogs/invite-staff.png. Wording from design/prototype/Staff.dc.html.

/staff: staff list (name, role, last active, status); invite (super admin); change role; remove; cancel an
invite; "What each role can do" card; activity log with filters (staff, action, period), "Load more" by 50,
export CSV, and changes shown as "Litres: 6 → 5.5" with the note. A super admin can't remove or demote
themselves. Support and Viewer see the list and the log, without the management controls.

Done when: e2e covers invite, role change, remove, the filters and load more; shots pass.
Commit "feat: staff and activity log".
```

## M10 · Dashboard

```text
Read CLAUDE.md and the "Dashboard" sections. Match 02-dashboard.png (desktop and phone) and
dialogs/invite-staff-from-dashboard.png. Wording from design/prototype/Main.dc.html.

/: totals with links; period switch (7, 30, 90 days) for milk, feed and vaccines with trends; "Needs
attention today" items linking to the filtered screens; milk per day chart; "Farms needing attention" table
with an issue filter; herd by species; farmers by language; recent staff changes; Invite staff (super admin
only). Everything from dataSource.getOverview.

Done when: e2e covers the period switch, every attention link and invite; shots pass. Commit "feat: dashboard".
```

## M11 · Analytics

```text
Read CLAUDE.md and the "Analytics" sections. Match 10-analytics.png (desktop and phone). Wording and chart
behaviour from design/prototype/Analytics.dc.html.

/analytics: farm picker, whole farm or one animal, 7, 30 or 90 days (5-day and 10-day averages for 30 and 90),
and the five graphs: milk, feed, activity, cattle temperature (with the fever line) and farm temperature for a
chosen day and shed (temperature, humidity, THI). Download the visible numbers as CSV. Manual farms show the
collar graphs as "No collar data on this farm".

Done when: e2e covers every control and the download; shots pass. Commit "feat: analytics".
```

## M12 · QA pass

```text
Read CLAUDE.md ("Definition of done").
1. Run the whole e2e suite three times: as Support, as Viewer (no edit controls anywhere, exports still work)
   and as Super admin.
2. Run npm run shots and compare every screenshot with design/screens. List the differences, then fix them.
3. Check every screen at 390px: no sideways page scroll, every dialog fits, tables scroll inside their card.
4. Accessibility: add @axe-core/playwright (allowed) and fix every serious or critical issue on each route.
5. Check that Hindi, Marathi, Malayalam, Gujarati and Tamil text renders (farmer names, notes).
6. Check that an edit, a reload and a reset each behave correctly on every screen.
Report what you fixed. Commit "chore: qa pass".
```

## M13 · Deploy to Vercel

```text
Prepare the project for Vercel:
- confirm vercel.json (SPA rewrite to index.html, cache headers for /assets)
- README.md for reviewers: what this is, the demo accounts, "Reset demo data", that it's a demo with no
  real data, and how to run it locally
- a small "Demo" ribbon in the top bar when VITE_APP_ENV=demo
- run a production build locally (npm run build && npx vite preview) and click through every screen
Then tell me exactly what to set in Vercel (framework, build command, output folder, environment variables)
and how to connect the GitHub repo. I'll do the Vercel part myself.
Commit "chore: vercel".
```
