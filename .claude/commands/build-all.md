---
description: Build the whole WeSTOCK admin dashboard (M0 to M13) in one go and push it to GitHub
argument-hint: [GitHub repo URL]
disable-model-invocation: true
---
Build the entire project described in PROMPTS.md, milestones M0 to M13, one after another without stopping
between them. GitHub repo to push to: $ARGUMENTS

## Setup (once)
1. Read CLAUDE.md, PROMPTS.md, docs/data-contract.md and docs/demo-data.md.
2. Git:
   - if this folder isn't a git repo yet, run `git init -b main`
   - if a repo URL was given and there's no `origin`, run `git remote add origin <url>`
   - if the remote already has commits (e.g. a README created on GitHub), `git pull origin main --allow-unrelated-histories` first and keep both
   - commit the kickoff pack as it is: "docs: kickoff pack"
3. If BUILD_LOG.md exists, resume from the first milestone not marked done. Otherwise create it.

## For each milestone, in order
- If you can start subagents, hand the milestone's full prompt (plus "Follow CLAUDE.md exactly") to a fresh
  subagent, so your own context stays small. Otherwise do it yourself.
- Do everything the prompt asks, including its "Done when" checks (typecheck, lint, tests, build, e2e, shots).
- Commit with the prompt's commit message, then `git push -u origin main`.
- Add a line to BUILD_LOG.md: milestone, done or partial, what was checked, anything that doesn't match the
  design yet. Commit it with the milestone.
- **Don't stop to ask me questions between milestones.** If something is unclear, pick what's closest to the
  screenshots and the prototype, note the choice in BUILD_LOG.md and carry on.
- If a check still fails after 3 real attempts, note it in BUILD_LOG.md and move on to the next milestone
  (unless that milestone depends on it).

## Pushing
- If the push fails because you're not signed in to GitHub, keep building and committing locally, and at the
  end tell me to run `gh auth login` (or sign in with GitHub Desktop) and then `git push -u origin main`.
  Never ask me for a password or token, and never put one in a file or a URL.
- Never force-push.

## This repo is public
- Never commit `.env` files, keys, tokens or real farmer data. Demo data only.
- `docs/backend-later/` stays out of git (it's in .gitignore). Don't remove that line.

## At the end
1. Run every check one last time and push.
2. Tell me in plain words, briefly:
   - what's built, and the repo link
   - how to run it on my laptop (`npm install`, then `npm run dev`)
   - the Vercel settings: framework Vite, build command `npm run build`, output `dist`, environment
     variables `VITE_DATA_SOURCE=demo` and `VITE_APP_ENV=demo`
   - the demo sign-in accounts
   - anything in BUILD_LOG.md I should look at
