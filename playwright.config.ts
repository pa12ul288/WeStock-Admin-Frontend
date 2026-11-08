import { defineConfig, devices } from '@playwright/test';

// The suite runs against a build of the app (the same code, bundled), served by `vite preview`.
// The dev server compiles ~300 modules on demand, and under four browsers that made the first
// load of a page slower than the timeouts now and then. The e2e mode also keeps the dev-only
// component gallery, which the real build leaves out.
const baseURL = 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Half the cores: the browsers and the server share one machine, and the axe and phone specs
  // are heavy, so more workers only made pages slower than the timeouts.
  workers: process.env.CI ? 2 : 4,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  // Motion is off in every spec, so none waits on an animation and screenshots show the final state.
  // Specs that test motion switch it back on with page.emulateMedia.
  use: { baseURL, reducedMotion: 'reduce' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build:e2e && npx vite preview --port 4173 --strictPort --outDir .e2e-dist',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
