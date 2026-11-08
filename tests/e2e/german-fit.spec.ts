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
async function expectFits(page: Page, scope: string, label: string): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    `${label}: page overflow`,
  ).toBe(true);
  const problems = await page.evaluate((sel) => {
    const out: string[] = [];
    const root = document.querySelector(sel);
    if (!root) return [`missing scope ${sel}`];
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
        if (r.width < 43.5 || r.height < 43.5) {
          out.push(`tap ${name}: ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
        }
      }
    }
    return out;
  }, scope);
  expect(problems, label).toEqual([]);
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
    await expectFits(page, '[data-testid="lang"]', 'lang button');
    await expectFits(page, '[data-testid="credits"]', 'credits button');
    await expectFits(page, '[data-testid="sound"]', 'sound button');
    await expectFits(page, '[data-testid="tour"]', 'tour button');

    await page.evaluate(() => {
      void (window as unknown as AppWindow).__app.select('earth');
    });
    await expect(page.getByTestId('panel')).toBeVisible({ timeout: 25_000 });
    await page.waitForTimeout(1500);
    await expectFits(page, '[data-testid="panel"]', 'body panel');

    await page.getByTestId('back').click();
    await expect(page.getByTestId('panel')).toBeHidden({ timeout: 25_000 });

    await page.evaluate(() => (window as unknown as AppWindow).__app.tour({ type: 'START' }));
    await expect(page.getByTestId('tour-progress')).toBeVisible({ timeout: 40_000 });
    await expectFits(page, '.tour-dock', 'tour controls');
    await expectFits(page, '[data-testid="subtitles"]', 'subtitles');
    await page.evaluate(() => (window as unknown as AppWindow).__app.tour({ type: 'EXIT' }));

    await page.getByTestId('lang').click();
    await expect(page.getByTestId('lang-picker').getByRole('dialog')).toBeVisible();
    await expectFits(page, '[data-testid="lang-picker"]', 'language picker');
    await page.keyboard.press('Escape');

    await page.getByTestId('credits').click();
    await expect(page.getByTestId('credits-close')).toBeVisible();
    await expectFits(page, '.credits-overlay', 'credits');
  });
});
