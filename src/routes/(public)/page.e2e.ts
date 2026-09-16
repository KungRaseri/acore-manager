import { expect, test } from '@playwright/test';

/**
 * Replaces the scaffold's `/demo/playwright` test, which pointed at a route that
 * no longer exists. The public landing page is the one page an anonymous visitor
 * always gets, so it is the natural smoke test for the app booting.
 */
test('the public landing page offers sign-in', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
});
