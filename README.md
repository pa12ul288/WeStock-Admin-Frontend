# WeSTOCK Admin

A web dashboard for **brainwired staff** to view and fix the data farmers enter in the **WeSTOCK** app, a
livestock farm-management app. It covers farmers and farms, livestock, reproduction, milk and feed, health and
vaccines, analytics, and staff with an activity log.

**This is a demo.** It runs entirely in your browser on made-up data: there is no server, no database and no
real farmer information. Every button works, and your changes are kept in this browser only. Supabase is
connected in a later phase without changing the screens. A "Demo" ribbon in the top bar shows when the app
runs in demo mode.

## Try it (for reviewers)

Open the site and sign in with any of these accounts. **Any password of 6 or more characters works.**

| Email | Role |
| --- | --- |
| anjali@brainwired.demo | Super admin |
| priya@brainwired.demo | Support |
| rahul@brainwired.demo | Support |
| fatima@brainwired.demo | Viewer |
| vikram@brainwired.demo | Support (invited; signing in makes them active) |

- The **user menu** (your initials, top of the sidebar or top bar) has a **role switcher** (Super admin,
  Support, Viewer) so you can see what each role may do.
- **Reset demo data** in the same menu throws away every change you made and restores the original data.
- Everyone sees the same farms on every visit; your edits live only in your own browser.

## Run it locally

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env     # optional: the defaults already run the demo
npm run dev              # http://localhost:5173
```

Other commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (production build into
`dist/`), `npx vite preview` (serve that build), `npm run e2e` (Playwright, builds and serves its own copy)
and `npm run shots` (screenshots of every screen at 1440 and 390 px).

## Deploy to Vercel

Framework Vite, build command `npm run build`, output folder `dist`, and the environment variables
`VITE_DATA_SOURCE=demo` and `VITE_APP_ENV=demo`. `vercel.json` already holds the single-page-app rewrite and
the long cache headers for `/assets`. Environment variables are read at build time, so redeploy after
changing them.

## What's inside the repository

| Path | What it is |
| --- | --- |
| `CLAUDE.md` | Project rules Claude Code reads at the start of every session: stack, architecture, design, scope, definition of done |
| `PROMPTS.md` | 14 milestones (M0–M13), each a ready-to-paste prompt with its "done when" checks |
| `.claude/commands/` | `/build-all` builds everything in one go; `/milestone 4` builds one part; `/check` runs every test |
| `.claude/settings.json` | Lets Claude Code run npm and git without asking each time (force-push is blocked) |
| `design/screens/` | Screenshots of the 11 screens at desktop and phone width, plus the main dialogs |
| `design/prototype/` | Source of the clickable prototype, for exact wording and behaviour |
| `docs/product-spec.md` | What each screen does, roles, data model |
| `docs/data-contract.md` | The TypeScript types and data interface the frontend is built on (matches the Supabase schema) |
| `docs/demo-data.md` | What the demo data contains, and the demo sign-in accounts |
| `docs/developer-guide.md` | The full build guide, including the later Supabase phase |
| `docs/backend-later/` | The tested `0005_admin.sql` migration and the app's schema, for the Supabase phase |
| `vercel.json`, `.env.example`, `.gitignore` | Ready for Vercel |

## How to use it (3 steps)

1. **Make a folder and unzip this pack into it.** Copy everything, including the hidden `.claude` folder.
2. **Open that folder in Claude Code.** In the terminal, go into the folder and type `claude`, or open the
   folder in the Claude Code desktop app. If it asks whether to trust the folder, say yes.
3. **Type this one command**, with your GitHub repo link:

   ```text
   /build-all https://github.com/<you>/westock-admin
   ```

   Claude Code builds the whole dashboard on its own, saves its work to GitHub after each part, and keeps a
   progress list in `BUILD_LOG.md`. It takes a while. If it stops for any reason, type `/build-all` again and
   it carries on where it left off.

**Before step 3:** be signed in to GitHub on your laptop (run `gh auth login` once, or sign in to GitHub
Desktop), so Claude Code can push. If you aren't, it still builds everything and tells you at the end how to push.

**Public repo:** the brainwired database files (`docs/backend-later/`) are kept out of the repo
automatically. The app only contains made-up demo data.

## Tips

- If a screen looks off, tell Claude Code which screenshot to compare against, e.g. "the KPI cards on
  /milk-feed don't match design/screens/desktop/08-milk-and-feed.png: fix the spacing and the icon colours".
- To change a rule for the whole project, edit `CLAUDE.md`, not just the prompt.

## Later: connecting Supabase

When user shares the Supabase project (URL, anon key and a test copy), the work is:
1. run `docs/backend-later/0005_admin.sql` on the **test** project
2. ask Claude Code to build `src/data/supabase/adapter.ts`, implementing the same `DataSource` interface
   (the mapping table is in `docs/data-contract.md`, section 6), plus real sign-in and the `admin-invite`
   edge function from `docs/developer-guide.md`
3. set `VITE_DATA_SOURCE=supabase` and the two Supabase variables in Vercel

The screens don't change.
