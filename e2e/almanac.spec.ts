import { test, expect, type Page } from '@playwright/test';

async function onboard(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/welcome/);
  await page.getByRole('button', { name: 'Let’s begin' }).click();
  await page.getByRole('button', { name: 'Next year' }).click();
  await page.getByRole('button', { name: 'Spring 5, Friday' }).click();
  await page.getByRole('group', { name: 'Weather today' }).getByRole('button', { name: 'Rain' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Farm name').fill('Moonlight Farm');
  await page.getByRole('button', { name: 'Open my almanac' }).click();
  await expect(page.getByText('Spring 5, Year 2')).toBeVisible();
}

test('daily workflow: set day, find villager, discover & watch a fish, next day', async ({ page }) => {
  await onboard(page);
  // Today: rain-only fish and the cart on a rainy Friday
  await expect(page.getByText(/Rain brings 3 rain-only fish out/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Catfish/ }).first()).toBeVisible();
  await expect(page.getByText('Traveling Cart').first()).toBeVisible();

  // Find Sebastian: two random rainy routines
  await page.getByRole('link', { name: /People/ }).first().click();
  await page.getByRole('link', { name: /Sebastian/ }).click();
  await expect(page.getByText(/the game picks a routine at random/)).toBeVisible();
  await expect(page.getByText('Rain (Option 1)')).toBeVisible();
  await expect(page.getByText('Rain (Option 2)')).toBeVisible();

  // Discover Eel and watch it
  await page.goto('/fish/eel');
  await expect(page.getByRole('heading', { name: 'Eel' })).toBeVisible();
  await page.getByRole('button', { name: /Add Eel to watchlist/ }).click();
  await page.goto('/');
  await expect(page.getByRole('region', { name: /For you/ }).or(page.locator('section', { hasText: 'For you' })).getByText('Eel').first()).toBeVisible();

  // Next day: date advances, rain is NOT carried over
  await page.getByRole('button', { name: /^Next day/ }).click();
  await expect(page.getByText('Spring 6, Year 2')).toBeVisible();
  await expect(page.getByRole('group', { name: "Today's weather" }).getByRole('button', { name: 'Not sure' })).toHaveAttribute('aria-pressed', 'true');

  // Persistence across reload
  await page.reload();
  await expect(page.getByText('Spring 6, Year 2')).toBeVisible();
});

test('calendar preview does not change the played day until confirmed', async ({ page }) => {
  await onboard(page);
  await page.goto('/calendar');
  await page.getByRole('button', { name: /Spring 13, Saturday/ }).click();
  await expect(page.getByText('Egg Festival').first()).toBeVisible();
  await page.getByRole('link', { name: 'Preview villagers' }).click();
  await expect(page.getByText('Preview', { exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('Spring 5, Year 2')).toBeVisible();
  await page.goto('/calendar?season=spring&year=2&day=13');
  await page.getByRole('button', { name: 'Make this my current day' }).click();
  await page.goto('/');
  await expect(page.getByText('Spring 13, Year 2')).toBeVisible();
  await expect(page.getByText(/Egg Festival today/).or(page.getByText("It's the Egg Festival today."))).toBeVisible();
});

test('fish timeline lists catchable fish at the cursor and links to profiles', async ({ page }) => {
  await onboard(page);
  await page.goto('/fish/timeline');
  await expect(page.getByRole('heading', { name: /Fish availability — Spring \(Rain\)/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Catchable at 12:00 PM/ })).toBeVisible();
  await page.goto('/fish/catfish');
  await expect(page.getByRole('table')).toContainText('Secret Woods pond');
});

test('no horizontal page scroll on key screens', async ({ page }) => {
  await onboard(page);
  for (const path of ['/', '/people', '/people/sebastian', '/fish', '/fish/timeline', '/fish/catfish', '/calendar', '/journal', '/journal/bundles', '/map', '/settings', '/crops?crop=parsnip']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
});

test('works offline after the first visit', async ({ page, context }) => {
  await onboard(page);
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  // give the service worker time to precache
  await page.waitForTimeout(1500);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Spring 5, Year 2')).toBeVisible();
  await page.goto('/fish/eel');
  await expect(page.getByRole('heading', { name: 'Eel' })).toBeVisible();
  await context.setOffline(false);
});

test('keyboard users can reach the Next day button and skip link', async ({ page }) => {
  await onboard(page);
  await page.reload();
  await expect(page.getByText('Spring 5, Year 2')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByRole('button', { name: /^Next day/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Spring 6, Year 2')).toBeVisible();
});
