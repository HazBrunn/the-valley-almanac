import { test, expect } from '@playwright/test';

/**
 * Captures representative screenshots for docs/screenshots (run: npx playwright test e2e/screenshots.spec.ts --project=desktop).
 * Seeds a profile through the UI so the shots show a rainy Spring 5, Year 2 at 2 PM.
 */
const SHOTS = process.env.SHOTS === '1';
test.skip(!SHOTS, 'Set SHOTS=1 to capture documentation screenshots');

const pages: [string, string][] = [
  ['today', '/'],
  ['people', '/people'],
  ['villager', '/people/sebastian'],
  ['fish-timeline', '/fish/timeline'],
  ['fish-detail', '/fish/catfish'],
  ['calendar', '/calendar'],
  ['journal-bundles', '/journal/bundles'],
  ['map', '/map'],
];

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`screens at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Let’s begin' }).click();
    await page.getByRole('button', { name: 'Next year' }).click();
    await page.getByRole('button', { name: 'Spring 5, Friday' }).click();
    await page.getByRole('group', { name: 'Weather today' }).getByRole('button', { name: 'Rain' }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Open my almanac' }).click();
    await page.getByText('Set a time of day').click();
    await page.getByRole('button', { name: '3:00 PM' }).click();
    for (const [name, path] of pages) {
      if (width !== 390 && width !== 1440 && !['today', 'fish-timeline', 'calendar'].includes(name)) continue;
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).not.toContainText('Turning the page');
      await page.screenshot({ path: `docs/screenshots/${width}-${name}.png`, fullPage: width === 390 });
    }
  });
}
