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

async function chooseLang(page: Page, lang: 'vi' | 'en' | 'ja' | 'de'): Promise<void> {
  if ((await page.evaluate(() => document.documentElement.lang)) === lang) return;
  await page.getByTestId('lang').click();
  await page.getByTestId(`lang-option-${lang}`).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(lang);
}

test('language picker switches to Japanese and persists across reload', async ({ page }) => {
  // Reload-based and close to the 60 s limit under load on software GL.
  test.slow();
  await open(page);
  const key = await hintKey(page);
  const initial = (await page.evaluate(() => document.documentElement.lang)) as 'vi' | 'en';
  await page.getByTestId('lang').click();
  const picker = page.getByTestId('lang-picker').getByRole('dialog');
  await expect(picker).toBeVisible({ timeout: 25_000 });
  await expect(picker.getByRole('button')).toHaveText([
    /Tiếng Việt/,
    /English/,
    /日本語/,
    /Deutsch/,
    UI_STRINGS[initial]['lang.close'],
  ]);
  await page.getByTestId('lang-option-ja').click();
  await expect(picker).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('ja');
  await expect(page.getByTestId('hint')).toHaveText(UI_STRINGS.ja[key], { timeout: 25_000 });
  await expect(page.getByTestId('not-to-scale')).toHaveText(UI_STRINGS.ja.notToScale);
  await expect(page.getByTestId('lang')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('sse.lang'))).toBe('ja');
  await page.reload();
  await open(page);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('ja');
  await expect(page.getByTestId('title')).toHaveText(UI_STRINGS.ja.appTitle);
});

test('language picker closes with Escape and the backdrop and returns focus', async ({ page }) => {
  await open(page);
  const before = await page.evaluate(() => document.documentElement.lang);
  const overlay = page.getByTestId('lang-picker');
  await page.getByTestId('lang').click();
  await expect(overlay).toBeVisible({ timeout: 25_000 });
  await expect(page.getByTestId(`lang-option-${before}`)).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(page.getByTestId('lang')).toBeFocused();
  await page.getByTestId('lang').click();
  await expect(overlay).toBeVisible();
  await overlay.click({ position: { x: 5, y: 5 } });
  await expect(overlay).toBeHidden();
  await expect(page.getByTestId('lang')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(before);
});

for (const vp of [
  { name: '320px wide', width: 320, height: 568 },
  { name: 'short landscape', width: 640, height: 320 },
]) {
  test(`language picker fits a ${vp.name} viewport with 44px targets`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);
    await page.getByTestId('lang').click();
    const dialog = page.getByTestId('lang-picker').getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 25_000 });
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
    const noOverflowX = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflowX).toBe(true);
    for (const id of [
      'lang-option-vi',
      'lang-option-en',
      'lang-option-ja',
      'lang-option-de',
      'lang-close',
    ]) {
      const target = page.getByTestId(id);
      await target.scrollIntoViewIfNeeded();
      const b = (await target.boundingBox())!;
      expect(b.width, id).toBeGreaterThanOrEqual(44);
      expect(b.height, id).toBeGreaterThanOrEqual(44);
      expect(b.y, id).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height, id).toBeLessThanOrEqual(vp.height + 0.5);
    }
    await page.getByTestId('lang-option-ja').click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('ja');
  });
}

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
  await chooseLang(page, 'en');
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

  await chooseLang(page, 'vi');
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

test('switching to Japanese during an unmuted narration replays the same stop in Japanese', async ({
  page,
}) => {
  test.slow();
  await open(page);
  await chooseLang(page, 'en');
  await page.getByTestId('sound').click();
  await page.getByTestId('tour').click();
  type TourWindow = { __app: { getState(): { tour: { status: string; index: number } } } };
  const tourState = () =>
    page.evaluate(() => (window as unknown as TourWindow).__app.getState().tour);
  await expect.poll(async () => (await tourState()).status, { timeout: 40_000 }).toBe('narrating');
  const { index } = await tourState();
  const jaClip = page.waitForRequest(/audio\/narration\/[a-z-]+\.ja\.mp3/, { timeout: 25_000 });
  await chooseLang(page, 'ja');
  const request = await jaClip;
  expect(request.url()).toContain(index === 0 ? 'intro.ja.mp3' : '.ja.mp3');
  expect((await tourState()).index).toBe(index);
  await expect(page.getByTestId('subtitles')).toHaveText(
    /[\p{Script=Hiragana}\p{Script=Katakana}]/u,
    {
      timeout: 25_000,
    },
  );
});

test('switching to German during an unmuted narration replays the same stop in German', async ({
  page,
}) => {
  test.slow();
  await open(page);
  await chooseLang(page, 'en');
  await page.getByTestId('sound').click();
  await page.getByTestId('tour').click();
  type TourWindow = { __app: { getState(): { tour: { status: string; index: number } } } };
  const tourState = () =>
    page.evaluate(() => (window as unknown as TourWindow).__app.getState().tour);
  await expect.poll(async () => (await tourState()).status, { timeout: 40_000 }).toBe('narrating');
  const { index } = await tourState();
  const deClip = page.waitForRequest(/audio\/narration\/[a-z-]+\.de\.mp3/, { timeout: 25_000 });
  await chooseLang(page, 'de');
  const request = await deClip;
  expect(request.url()).toContain(index === 0 ? 'intro.de.mp3' : '.de.mp3');
  expect((await tourState()).index).toBe(index);
  await expect(page.getByTestId('subtitles')).not.toHaveText('', { timeout: 25_000 });
  expect(await page.evaluate(() => localStorage.getItem('sse.lang'))).toBe('de');
  await page.reload();
  await open(page);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('de');
});
