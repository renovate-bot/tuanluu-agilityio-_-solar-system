import { expect, test, type Page } from '@playwright/test';

type AppWindow = {
  __app: {
    getState(): { ready: boolean; lang: string };
    select(id: string): Promise<void>;
    tour(e: { type: string }): void;
  };
};

async function openGerman(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('sse.lang', 'de');
    localStorage.setItem('sse.tourSeen', 'true');
  });
  await page.goto('./?e2e=1');
  await page.waitForFunction(
    () => (window as unknown as AppWindow).__app?.getState().ready === true,
    null,
    { timeout: 40_000 },
  );
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('de');
}

/** No horizontal page overflow; no visible text clipped; every visible button/link at least 44x44. */
async function expectFits(
  page: Page,
  scope: string,
  label: string,
  opts: { buttons?: boolean } = {},
): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    `${label}: page overflow`,
  ).toBe(true);
  const result = await page.evaluate((sel) => {
    const out: string[] = [];
    const root = document.querySelector(sel);
    if (!root) return { out: [`missing scope ${sel}`], texts: 0, buttons: 0 };
    const rootBox = root.getBoundingClientRect();
    if (
      rootBox.width <= 0 ||
      rootBox.height <= 0 ||
      getComputedStyle(root).visibility === 'hidden'
    ) {
      return { out: [`scope not visible ${sel}`], texts: 0, buttons: 0 };
    }
    let texts = 0;
    let buttons = 0;
    const els = [root, ...root.querySelectorAll('*')].filter((n): n is HTMLElement => {
      if (!(n instanceof HTMLElement)) return false;
      const r = n.getBoundingClientRect();
      const st = getComputedStyle(n);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    });
    for (const el of els) {
      const name = `${el.tagName.toLowerCase()}[${el.dataset['testid'] ?? el.className}] "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      const hasText = [...el.childNodes].some(
        (c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? '').trim() !== '',
      );
      if (hasText) texts++;
      if (el.tagName === 'BUTTON') buttons++;
      const st = getComputedStyle(el);
      const scrollsOnPurpose = st.overflowX === 'auto' || st.overflowX === 'scroll';
      if (hasText && !scrollsOnPurpose && el.scrollWidth > el.clientWidth + 1) {
        out.push(`clipped ${name}: ${el.scrollWidth} > ${el.clientWidth}`);
      }
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 0.5 || r.left < -0.5) out.push(`off-screen ${name}`);
      // The attribution link inside a credits list item is inline text (pre-existing, any locale).
      const inlineCitation = el.tagName === 'A' && el.closest('li') !== null;
      if ((el.tagName === 'BUTTON' || el.tagName === 'A') && !inlineCitation) {
        // 43.5 rather than 44 absorbs subpixel rounding of a 44px target.
        if (r.width < 43.5 || r.height < 43.5) {
          out.push(`tap ${name}: ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
        }
      }
    }
    return { out, texts, buttons };
  }, scope);
  expect(result.out, label).toEqual([]);
  expect(result.texts, `${label}: no text measured`).toBeGreaterThan(0);
  if (opts.buttons) expect(result.buttons, `${label}: no button measured`).toBeGreaterThan(0);
}

test.describe('German layout fit', () => {
  test('control bar, body panel, tour UI, language picker and credits fit', async ({
    page,
  }, info) => {
    test.slow();
    if (info.project.name === 'desktop') await page.setViewportSize({ width: 320, height: 568 });
    await openGerman(page);

    await expectFits(page, '[data-testid="hint"]', 'hint');
    await expectFits(page, '[data-testid="not-to-scale"]', 'disclaimer');
    await expectFits(page, '[data-testid="lang"]', 'lang button', { buttons: true });
    await expectFits(page, '[data-testid="credits"]', 'credits button', { buttons: true });
    await expectFits(page, '[data-testid="sound"]', 'sound button', { buttons: true });
    await expectFits(page, '[data-testid="tour"]', 'tour button', { buttons: true });

    await page.evaluate(() => {
      void (window as unknown as AppWindow).__app.select('earth');
    });
    await expect(page.getByTestId('panel')).toBeVisible({ timeout: 25_000 });
    await expect
      .poll(
        async () => {
          const a = await page.getByTestId('panel').boundingBox();
          await page.waitForTimeout(250);
          const b = await page.getByTestId('panel').boundingBox();
          return (
            a !== null &&
            b !== null &&
            a.x === b.x &&
            a.y === b.y &&
            a.width === b.width &&
            a.height === b.height
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    await expectFits(page, '[data-testid="panel"]', 'body panel', { buttons: true });

    await page.getByTestId('back').click();
    await expect(page.getByTestId('panel')).toBeHidden({ timeout: 25_000 });

    await page.evaluate(() => (window as unknown as AppWindow).__app.tour({ type: 'START' }));
    await expect(page.getByTestId('tour-progress')).toBeVisible({ timeout: 40_000 });
    await expectFits(page, '.tour-dock', 'tour controls', { buttons: true });
    await expect(page.getByTestId('subtitles')).not.toHaveText('', { timeout: 40_000 });
    await expectFits(page, '[data-testid="subtitles"]', 'subtitles');
    await page.evaluate(() => (window as unknown as AppWindow).__app.tour({ type: 'EXIT' }));

    await page.getByTestId('lang').click();
    await expect(page.getByTestId('lang-picker').getByRole('dialog')).toBeVisible();
    await expectFits(page, '[data-testid="lang-picker"]', 'language picker', { buttons: true });
    await page.keyboard.press('Escape');

    await page.getByTestId('credits').click();
    await expect(page.getByTestId('credits-close')).toBeVisible();
    await expectFits(page, '.credits-overlay', 'credits', { buttons: true });
  });
});
