# WeSTOCK Admin: kickoff pack for Claude Code

This pack has everything Claude Code needs to build the WeSTOCK admin dashboard: the **frontend only**,
running on built-in demo data and hosted on **Vercel**. Supabase gets connected in a later phase without
rewriting the screens.

## What's inside

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

**When it's done:** in Vercel, go to Add New → Project and import the repo. Choose framework **Vite**, add two
environment variables, `VITE_DATA_SOURCE=demo` and `VITE_APP_ENV=demo`, and click Deploy. Anyone with the
link can then try the dashboard.

**Public repo:** the brainwired database files (`docs/backend-later/`) are kept out of the repo
automatically. The app only contains made-up demo data.

## Demo sign-in (on the deployed site)

| Email | Role |
| --- | --- |
| anjali@brainwired.demo | Super admin |
| priya@brainwired.demo | Support |
| fatima@brainwired.demo | Viewer |

Any password of 6+ characters works. The user menu has a role switcher and "Reset demo data".

## Tips

- If a screen looks off, tell Claude Code which screenshot to compare against, e.g. "the KPI cards on
  /milk-feed don't match design/screens/desktop/08-milk-and-feed.png: fix the spacing and the icon colours".
- To change a rule for the whole project, edit `CLAUDE.md`, not just the prompt.
- Before sharing the Vercel link, run M12 (the QA pass).

## Later: connecting Supabase

When user shares the Supabase project (URL, anon key and a test copy), the work is:
1. run `docs/backend-later/0005_admin.sql` on the **test** project
2. ask Claude Code to build `src/data/supabase/adapter.ts`, implementing the same `DataSource` interface
   (the mapping table is in `docs/data-contract.md`, section 6), plus real sign-in and the `admin-invite`
   edge function from `docs/developer-guide.md`
3. set `VITE_DATA_SOURCE=supabase` and the two Supabase variables in Vercel

The screens don't change.
