import { expect, test, type Page } from '@playwright/test';
import { BODY_IDS, SUPPORTED_LANGS, type Lang } from '../../src/data/types';
import { getContent } from '../../src/data/content';

type AppWindow = {
  __app: {
    getState(): { ready: boolean; selected: string | null; view: string; lang: Lang };
    select(id: string): Promise<void>;
    setTimeScale(n: number): void;
    cameraTargetId(): string | null;
    projectBody(id: string): { x: number; y: number } | null;
  };
};

const READY = 40_000;
const POLL = 25_000;

let errors: string[] = [];

test.beforeEach(({ page }) => {
  errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

async function boot(page: Page): Promise<void> {
  await page.goto('./?e2e=1');
  await page.waitForFunction(
    () => (window as unknown as AppWindow).__app?.getState().ready === true,
    null,
    { timeout: READY },
  );
}

const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as AppWindow).__app.getState();
    return { selected: s.selected, view: s.view, lang: s.lang };
  });

test('selecting each clickable body shows its panel title in every language', async ({ page }) => {
  // 11 flights plus language toggles on software GL.
  test.slow();
  test.setTimeout(240_000);
  await boot(page);
  // Flights are frame-bound on software GL (about 1.5 fps); speed the rig up.
  await page.evaluate(() => (window as unknown as AppWindow).__app.setTimeScale(20));
  const title = page.getByTestId('panel').locator('h2');
  for (const id of BODY_IDS) {
    await page.evaluate((i) => {
      void (window as unknown as AppWindow).__app.select(i);
    }, id);
    await expect.poll(async () => (await state(page)).selected, { timeout: POLL }).toBe(id);
    const lang = (await state(page)).lang;
    await expect(title).toHaveText(getContent(id, lang).name, { timeout: POLL });
    // Cycle the language: the open panel retitles. The next body starts in that language.
    const other = SUPPORTED_LANGS[(SUPPORTED_LANGS.indexOf(lang) + 1) % SUPPORTED_LANGS.length]!;
    await page.getByTestId('lang').click();
    await page.getByTestId(`lang-option-${other}`).click();
    await expect(title).toHaveText(getContent(id, other).name, { timeout: POLL });
  }
});

test('tapping Mars then immediately Jupiter ends on Jupiter (Review Focus 2)', async ({ page }) => {
  test.slow();
  await boot(page);
  const hasTouch = Boolean((test.info().project.use as { hasTouch?: boolean }).hasTouch);
  const tap = async (id: string): Promise<void> => {
    const p = await page.evaluate((i) => (window as unknown as AppWindow).__app.projectBody(i), id);
    expect(p).not.toBeNull();
    if (hasTouch) await page.touchscreen.tap(p!.x, p!.y);
    else await page.mouse.click(p!.x, p!.y);
  };
  // A tap can be missed when software GL stalls a frame past the 350 ms tap limit: retry Mars.
  await expect(async () => {
    await tap('mars');
    await expect.poll(async () => (await state(page)).selected, { timeout: 8_000 }).toBe('mars');
  }).toPass({ timeout: 40_000 });
  // The flight to Mars is still running. Labels are hidden in focus view, so the Jupiter label
  // is clicked by dispatching the event, which runs the same handler as a tap.
  await page.locator('.body-label[data-body="jupiter"]').dispatchEvent('click');
  await expect
    .poll(async () => ({ s: (await state(page)).selected, c: await cameraTarget(page) }), {
      timeout: POLL,
    })
    .toEqual({ s: 'jupiter', c: 'jupiter' });
  // The second body's panel is the one shown (Review Focus 2).
  await expect(page.getByTestId('panel').locator('h2')).toHaveText(
    getContent('jupiter', (await state(page)).lang).name,
    { timeout: POLL },
  );
  await page.waitForTimeout(3_000);
  expect((await state(page)).selected).toBe('jupiter');
  expect(await cameraTarget(page)).toBe('jupiter');
  await expect(page.getByTestId('panel').locator('h2')).toHaveText(
    getContent('jupiter', (await state(page)).lang).name,
  );
});

const cameraTarget = (page: Page) =>
  page.evaluate(() => (window as unknown as AppWindow).__app.cameraTargetId());

test('rotating the phone while Saturn is focused keeps it and re-frames it (Review Focus 5)', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'pixel7', 'phone rotation is only exercised on pixel7');
  test.slow();
  await boot(page);
  await page.evaluate(() => (window as unknown as AppWindow).__app.setTimeScale(20));
  await page.evaluate(() => {
    void (window as unknown as AppWindow).__app.select('saturn');
  });
  await expect.poll(async () => (await state(page)).selected, { timeout: POLL }).toBe('saturn');
  await expect.poll(() => cameraTarget(page), { timeout: POLL }).toBe('saturn');
  await expect(page.getByTestId('panel')).toHaveAttribute('data-layout', 'mobile', {
    timeout: POLL,
  });

  await page.setViewportSize({ width: 915, height: 412 });
  const panel = page.getByTestId('panel');
  await expect(panel).toHaveAttribute('data-layout', 'desktop', { timeout: POLL });
  await expect(async () => {
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeLessThan(400);
  }).toPass({ timeout: POLL });
  expect((await state(page)).selected).toBe('saturn');
  // Re-framed: Saturn sits in the right 60 % of the viewport (clear of the left panel).
  await expect(async () => {
    const p = await page.evaluate(() =>
      (window as unknown as AppWindow).__app.projectBody('saturn'),
    );
    expect(p).not.toBeNull();
    expect(p!.x).toBeGreaterThan(915 * 0.4);
    expect(p!.x).toBeLessThan(915);
  }).toPass({ timeout: POLL });
});
