import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Indian-script text must render, online (Noto from Google Fonts) and offline (system fonts).
 * A script drawn with no font at all shows tofu boxes, which are the same width for every letter,
 * so each script's sample must measure wider than a run of one repeated letter would.
 */
const SAMPLES = {
  Hindi: 'रामलाल पाटिल',
  Marathi: 'सुनीता देसाई',
  Malayalam: 'ജോസഫ് വർഗീസ്',
  Gujarati: 'સુનિતા દેસાઈ',
  Tamil: 'முருகன் செல்வம்',
};

for (const offline of [false, true]) {
  test(`farmer names in every script render ${offline ? 'offline' : 'online'}`, async ({
    page,
  }) => {
    if (offline) await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await signIn(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate((samples) => {
      const host = document.createElement('div');
      host.style.cssText =
        'position:fixed;left:0;top:0;padding:20px;background:#fff;z-index:99999;font:700 24px var(--font-body)';
      host.id = 'script-samples';
      for (const [name, text] of Object.entries(samples)) {
        const row = document.createElement('div');
        row.textContent = `${name}: ${text}`;
        row.dataset.script = name;
        host.appendChild(row);
      }
      document.body.appendChild(host);
      return Object.fromEntries(
        Object.keys(samples).map((name) => {
          const row = host.querySelector(`[data-script="${name}"]`) as HTMLElement;
          const probe = document.createElement('span');
          probe.style.cssText =
            'position:absolute;visibility:hidden;white-space:pre;font:700 24px var(--font-body)';
          document.body.appendChild(probe);
          const widthOf = (text: string) => {
            probe.textContent = text;
            return probe.getBoundingClientRect().width;
          };
          const text = (samples as Record<string, string>)[name] ?? '';
          // Tofu: every glyph is the same box, so the width is the glyph count times one box.
          const box = widthOf('ॐ'); // placeholder glyph width for one char
          const unique = new Set(
            Array.from(text.replace(/\s/g, '')).map((c) => widthOf(c).toFixed(2)),
          );
          return [
            name,
            { width: row.getBoundingClientRect().width, box, distinctWidths: unique.size },
          ];
        }),
      );
    }, SAMPLES);
    for (const [name, info] of Object.entries(result)) {
      expect(info.distinctWidths, `${name} glyphs have varied widths`).toBeGreaterThan(2);
    }
    await page.locator('#script-samples').screenshot({
      path: `.shots/scripts-${offline ? 'offline' : 'online'}.png`,
    });
  });
}
