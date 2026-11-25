import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.env.SITE_URL ?? 'http://127.0.0.1:4173/system-design-simulator/';
const out = process.env.SMOKE_OUT ?? resolve(tmpdir(), 'system-design-network-smoke');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({
  viewport: { width: 1700, height: 1100 },
  reducedMotion: 'reduce',
});
const report = { base, errors: [], failedAssets: [], checks: {} };
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('response', (response) => {
  if (response.url().startsWith(base) && response.status() >= 400)
    report.failedAssets.push(response.url());
});
const input = (name) => page.getByRole('spinbutton', { name, exact: true });
try {
  await page.goto(`${base}?example=network-geography`);
  await page.locator('[data-hit="node"][data-kind="db"]').waitFor();
  await page.getByRole('button', { name: 'Hide components', exact: true }).click();
  await page.getByRole('button', { name: 'Hide', exact: true }).click();
  await page
    .getByRole('button', { name: 'Fit the diagram on screen', exact: true })
    .click();
  await page.locator('[data-hit="node"][data-kind="service"]').click();
  await input('Cross-region one-way delay').fill('150');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: resolve(out, 'network-cross-region.png') });
  report.checks.callerProfile = await input('Cross-region one-way delay').inputValue();
  assert.equal(report.checks.callerProfile, '150');
  const wirePoint = await page
    .locator('[data-hit="edge"]')
    .last()
    .evaluate((path) => {
      const bounds = path.getBoundingClientRect();
      return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    });
  await page.mouse.click(wirePoint.x, wirePoint.y);
  await input('Reply delay override').fill('250');
  await input('Link jitter override').fill('5');
  await page.waitForTimeout(1500);
  report.checks.link = await page
    .getByText(/Observed mean request crossing:/)
    .innerText();
  assert.match(report.checks.link, /Call round trip:/);
  assert.doesNotMatch(report.checks.link, /request crossing: no samples/);
  await page.screenshot({ path: resolve(out, 'network-link-observed.png') });
  await input('Reply loss').fill('100');
  await page.waitForTimeout(5000);
  report.checks.asymmetric = await page.locator('.ins-scroll').innerText();
  assert.match(report.checks.asymmetric, /Reply crossing: no samples/);
  await input('Reply loss').fill('0');
  await page.waitForTimeout(5000);
  report.checks.recovered = await page
    .getByText(/Observed mean request crossing:/)
    .innerText();
  assert.doesNotMatch(report.checks.recovered, /Reply crossing: no samples/);
  await page.locator('[data-hit="node"][data-kind="db"]').click();
  await input('Region ID').fill('0');
  await input('Region ID').blur();
  assert.equal(await input('Region ID').inputValue(), '0');
  await page
    .locator('[data-hit="node"][data-kind="db"] .cv-placement')
    .filter({ hasText: 'Region 0 / Zone 1' })
    .waitFor();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: resolve(out, 'network-placement.png') });
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).first().click();
  const share = await page.locator('input[readonly]').first().inputValue();
  assert.match(share, /#d3\./);
  await page.goto(share);
  await page.reload();
  await page.locator('[data-hit="node"][data-kind="db"]').click();
  assert.equal(await input('Region ID').inputValue(), '0');
  await page.locator('[data-hit="node"][data-kind="service"]').click();
  assert.equal(await input('Cross-region one-way delay').inputValue(), '150');
  report.checks.sharePreservesNetwork = true;
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failedAssets, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  writeFileSync(
    resolve(out, 'network-smoke-results.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
