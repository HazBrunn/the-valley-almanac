import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the production build (with the service worker) via `vite preview`.
 * Uses the locally installed Google Chrome (channel: 'chrome') so no browser download is needed;
 * set PW_CHANNEL=chromium to use Playwright's bundled Chromium instead.
 */
const channel = process.env.PW_CHANNEL ?? 'chrome';
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4317',
    trace: 'retain-on-failure',
    ...(channel === 'chromium' ? {} : { channel }),
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], ...(channel === 'chromium' ? {} : { channel }) } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: 'npx vite build && npx vite preview --port 4317 --strictPort',
    url: 'http://localhost:4317',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
