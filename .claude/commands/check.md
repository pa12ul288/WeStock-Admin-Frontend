---
description: Run every check (types, lint, unit tests, build, e2e, screenshots)
---
Run, in order, and stop at the first failure to fix it before continuing:
1. npm run typecheck
2. npm run lint
3. npm test
4. npm run build
5. npm run e2e
6. npm run shots (fails if any page scrolls sideways at 390px)
Report the result of each step in one line.
