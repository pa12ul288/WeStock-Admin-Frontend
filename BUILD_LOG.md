# Build log

One line per milestone: status (done or partial), what was checked, and anything that doesn't match the design yet.
Choices made where the docs were unclear are noted too.


- M0 scaffold: done. Checked typecheck, lint, test (12), build, e2e and shots (22 screenshots, no sideways scroll; the overflow check was confirmed to fail on a forced 2000 px page). Screens are title-only placeholders with a temporary nav, so nothing matches the design yet (real Sidebar and TopBar come in M2). Choices: TypeScript 6.0 and ESLint 9, because typescript-eslint and the ESLint plugins don't support the newest majors; added only the tooling the stack needs (@types/*, @vitejs/plugin-react, @testing-library/dom, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, globals); pill and milk tokens hold the tint, with a matching `-ink` token for the text colour; shots use `/farms/demo` and `/animals/demo` until seed ids exist; Poppins loads 500/600 as asked, though the prototype's WeSTOCK wordmark uses 700.
