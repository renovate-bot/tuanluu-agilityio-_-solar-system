import { expect, test, type Page } from '@playwright/test';

type AppWindow = {
  __app: {
    getState(): { ready: boolean; selected: string | null; view: string; lang: string };
    select(id: string): Promise<void>;
  };
};

async function boot(page: Page): Promise<void> {
  await page.goto('./?e2e=1');
  await page.waitForFunction(
    () => (window as unknown as AppWindow).__app?.getState().ready === true,
    null,
    { timeout: 40_000 },
  );
}

const select = (page: Page, id: string) =>
  page.evaluate((i) => {
    void (window as unknown as AppWindow).__app.select(i);
  }, id);

test('selecting a body shows the panel in the right place', async ({ page }) => {
  await boot(page);
  await select(page, 'earth');
  const panel = page.getByTestId('panel');
  await expect(panel).toBeVisible({ timeout: 25_000 });
  const box = (await panel.boundingBox())!;
  const vp = page.viewportSize()!;
  const layout = await page.evaluate(() =>
    document.querySelector('[data-testid="panel"]')!.getAttribute('data-layout'),
  );
  if (layout === 'mobile') expect(box.y).toBeGreaterThan(vp.height * 0.4);
  else expect(box.x).toBeLessThan(400);
});

test('switching to Japanese retitles the open panel, keeps it, and back returns to overview', async ({
  page,
}) => {
  // Reload-based and close to the 60 s limit under load on software GL.
  test.slow();
  await boot(page);
  await page.evaluate(() => localStorage.setItem('sse.lang', 'en'));
  await page.reload();
  await page.waitForFunction(
    () => (window as unknown as AppWindow).__app?.getState().ready === true,
    null,
    { timeout: 40_000 },
  );
  await select(page, 'earth');
  const title = page.getByTestId('panel').locator('h2');
  await expect(title).toHaveText('Earth', { timeout: 25_000 });
  await page.getByTestId('lang').click();
  await expect(page.getByTestId('lang-picker')).toBeVisible({ timeout: 25_000 });
  // Opening the picker keeps the panel and the selection.
  await expect(page.getByTestId('panel')).toBeVisible();
  await page.getByTestId('lang-option-ja').click();
  await expect(title).toHaveText('地球', { timeout: 25_000 });
  await expect(page.getByTestId('panel')).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as AppWindow).__app.getState().selected),
  ).toBe('earth');
  await page.getByTestId('back').click();
  await expect(page.getByTestId('panel')).toBeHidden({ timeout: 25_000 });
  expect(await page.evaluate(() => (window as unknown as AppWindow).__app.getState().view)).toBe(
    'overview',
  );
});

test('resizing between layouts keeps the selection and switches the panel', async ({ page }) => {
  await boot(page);
  await select(page, 'mars');
  await expect(page.getByTestId('panel')).toBeVisible({ timeout: 25_000 });
  await page.setViewportSize({ width: 390, height: 664 });
  await expect(page.getByTestId('panel')).toHaveAttribute('data-layout', 'mobile', {
    timeout: 25_000,
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId('panel')).toHaveAttribute('data-layout', 'desktop', {
    timeout: 25_000,
  });
  await expect(page.getByTestId('panel').locator('h2')).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as AppWindow).__app.getState().selected),
  ).toBe('mars');
});

test('the language picker opens over an open mobile panel at 320px and keeps it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await boot(page);
  await select(page, 'mars');
  const panel = page.getByTestId('panel');
  await expect(panel).toHaveAttribute('data-layout', 'mobile', { timeout: 25_000 });
  await expect(panel).toBeVisible({ timeout: 25_000 });
  await page.getByTestId('lang').click();
  const dialog = page.getByTestId('lang-picker').getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 25_000 });
  const box = (await dialog.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(320.5);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(panel).toBeVisible();
  await page.getByTestId('lang').click();
  await page.getByTestId('lang-option-ja').click();
  await expect(panel.locator('h2')).toHaveText('火星', { timeout: 25_000 });
  expect(
    await page.evaluate(() => (window as unknown as AppWindow).__app.getState().selected),
  ).toBe('mars');
});

test('the disclaimer stays clear of the mobile sheet', async ({ page }) => {
  await boot(page);
  await page.setViewportSize({ width: 390, height: 664 });
  await select(page, 'earth');
  const panel = page.getByTestId('panel');
  await expect(panel).toHaveAttribute('data-layout', 'mobile', { timeout: 25_000 });
  await expect(panel).toBeVisible({ timeout: 25_000 });
  const note = page.getByTestId('not-to-scale');
  await expect(async () => {
    const p = (await panel.boundingBox())!;
    const n = (await note.boundingBox())!;
    expect(n.y + n.height).toBeLessThanOrEqual(p.y + 1);
  }).toPass({ timeout: 25_000 });
});

test('switching to German retitles the open panel and keeps the selection', async ({ page }) => {
  test.slow();
  await boot(page);
  await page.evaluate(() => localStorage.setItem('sse.lang', 'en'));
  await page.reload();
  await page.waitForFunction(
    () => (window as unknown as AppWindow).__app?.getState().ready === true,
    null,
    { timeout: 40_000 },
  );
  await select(page, 'earth');
  const title = page.getByTestId('panel').locator('h2');
  await expect(title).toHaveText('Earth', { timeout: 25_000 });
  await page.getByTestId('lang').click();
  await page.getByTestId('lang-option-de').click();
  await expect(title).toHaveText('Erde', { timeout: 25_000 });
  await expect(page.getByTestId('panel')).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as AppWindow).__app.getState().selected),
  ).toBe('earth');
});
