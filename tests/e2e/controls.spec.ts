import { expect, test, type Page } from '@playwright/test';
import { UI_STRINGS } from '../../src/i18n/strings';

type AppWindow = {
  __app: { getState(): { ready: boolean; lang: string; muted: boolean; layout: string } };
};

const READY = 40_000;

async function open(page: Page, url = './?e2e=1'): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(
    () => (window as unknown as AppWindow).__app?.getState().ready === true,
    null,
    { timeout: READY },
  );
}

async function hintKey(page: Page): Promise<'hintMobile' | 'hintDesktop'> {
  const layout = await page.evaluate(
    () => (window as unknown as AppWindow).__app.getState().layout,
  );
  return layout === 'mobile' ? 'hintMobile' : 'hintDesktop';
}

test('language toggle switches texts and persists across reload', async ({ page }) => {
  // Reload-based and close to the 60 s limit under load on software GL.
  test.slow();
  await open(page);
  const initial = await page.evaluate(() => document.documentElement.lang);
  const next = initial === 'vi' ? 'en' : 'vi';
  const key = await hintKey(page);
  await expect(page.getByTestId('hint')).toHaveText(UI_STRINGS[initial as 'vi' | 'en'][key]);
  await page.getByTestId('lang').click();
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(next);
  await expect(page.getByTestId('hint')).toHaveText(UI_STRINGS[next as 'vi' | 'en'][key], {
    timeout: 25_000,
  });
  await expect(page.getByTestId('not-to-scale')).toHaveText(
    UI_STRINGS[next as 'vi' | 'en'].notToScale,
  );
  await page.reload();
  await open(page);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(next);
});

test('sound button toggles mute state', async ({ page }) => {
  await open(page);
  const sound = page.getByTestId('sound');
  expect(await page.evaluate(() => (window as unknown as AppWindow).__app.getState().muted)).toBe(
    true,
  );
  await sound.click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as AppWindow).__app.getState().muted), {
      timeout: 25_000,
    })
    .toBe(false);
});

test('credits modal shows a safe support link with an English label across languages', async ({
  page,
}) => {
  // Reload-based and close to the 60 s limit under load on software GL.
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  if ((await page.evaluate(() => document.documentElement.lang)) !== 'en') {
    await page.getByTestId('lang').click();
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('en');
  await page.getByTestId('credits').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 25_000 });
  for (const text of ['Solar System Scope', 'CC BY 4.0', 'NASA', 'Edge TTS']) {
    await expect(dialog).toContainText(text);
  }
  await expect(
    dialog.locator('a[href="https://www.solarsystemscope.com/textures/"]'),
  ).toBeVisible();
  const supportLink = page.getByRole('link', { name: 'Buy me a coffee' });
  await expect(supportLink).toHaveAttribute('href', 'https://me.momo.vn/bbk9x');
  await expect(supportLink).toHaveAttribute('target', '_blank');
  await expect(supportLink).toHaveAttribute('rel', 'noopener noreferrer');
  const desktopBox = await supportLink.boundingBox();
  expect(desktopBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(desktopBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBox = await supportLink.boundingBox();
  expect(mobileBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(mobileBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await dialog.getByTestId('credits-close').click();
  await expect(dialog).toBeHidden();

  if ((await page.evaluate(() => document.documentElement.lang)) !== 'vi') {
    await page.getByTestId('lang').click();
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('vi');
  await page.getByTestId('credits').click();
  await expect(page.getByRole('link', { name: 'Buy me a coffee' })).toBeVisible();
  await page.getByRole('dialog').getByTestId('credits-close').click();
  await expect(dialog).toBeHidden();
});

test('control buttons have a hit area of at least 44x44', async ({ page }) => {
  await open(page);
  for (const id of ['lang', 'sound', 'tour', 'credits']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    expect(box?.width ?? 0, id).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0, id).toBeGreaterThanOrEqual(44);
  }
});

test('hint hides after the first selection', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('hint')).toBeVisible();
  await page.evaluate(() => {
    // Fire and forget: `select` resolves only when the camera flight ends (slow on software GL).
    void (window as unknown as { __app: { select(id: string): Promise<void> } }).__app.select(
      'earth',
    );
  });
  await expect(page.getByTestId('hint')).toBeHidden({ timeout: 25_000 });
});
