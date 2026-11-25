import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.env.SITE_URL ?? 'http://127.0.0.1:4173/system-design-simulator/';
const out = process.env.SMOKE_OUT ?? resolve(tmpdir(), 'system-design-cache-smoke');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1700, height: 1100 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const report = { base, errors: [], failedAssets: [], checks: {} };
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('response', (response) => {
  if (response.url().startsWith(base) && response.status() >= 400) {
    report.failedAssets.push(`${response.status()} ${response.url()}`);
  }
});
const metrics = async () => {
  const rows = await page.locator('.ins-stat').all();
  const values = {};
  for (const row of rows) {
    values[await row.locator('.row-k').innerText()] = await row
      .locator('.row-v')
      .innerText();
  }
  return values;
};
const positive = (value) => Number.parseFloat(value ?? '0') > 0;
try {
  await page.goto(`${base}?example=cache-policies`);
  await page.locator('[data-hit="node"][data-kind="cache"]').waitFor();
  assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
  await page
    .getByRole('button', { name: 'Fit the diagram on screen', exact: true })
    .click();
  await page.locator('[data-hit="node"][data-kind="cache"]').click();
  await page.getByRole('button', { name: 'Hide components', exact: true }).click();
  await page.getByRole('button', { name: 'Hide', exact: true }).click();
  await page
    .getByRole('button', { name: 'Fit the diagram on screen', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'Cache read policy', exact: true })
    .waitFor();
  await page.waitForTimeout(5000);
  report.checks.writeThrough = await metrics();
  assert.ok(positive(report.checks.writeThrough['Read hits']));
  assert.equal(report.checks.writeThrough['Fresh among read hits'], '100%');

  await page
    .getByRole('combobox', { name: 'Cache write policy' })
    .selectOption('write-around');
  await page.waitForTimeout(5000);
  report.checks.writeAround = await metrics();
  assert.ok(positive(report.checks.writeAround['Stale hits']));
  await page
    .getByRole('heading', { name: 'Observed cache problem and remedy' })
    .waitFor();
  await page.getByText('Read hits', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(out, 'cache-stale-before.png') });
  await page
    .getByRole('button', { name: 'Apply immediate invalidation', exact: true })
    .click();
  await page.waitForTimeout(5000);
  report.checks.remedy = await metrics();
  assert.equal(report.checks.remedy['Stale hits'], '0/s');
  assert.equal(report.checks.remedy['Fresh among read hits'], '100%');
  await page.getByText('Read hits', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(out, 'cache-fresh-after.png') });

  await page
    .getByRole('combobox', { name: 'Cache read policy' })
    .selectOption('read-through');
  await page.waitForTimeout(1500);
  report.checks.readThrough = await metrics();
  assert.ok(positive(report.checks.readThrough['Read hits']));
  await page
    .getByRole('combobox', { name: 'Cache read policy' })
    .selectOption('stale-while-revalidate');
  await page.getByRole('spinbutton', { name: 'Cache TTL', exact: true }).fill('100');
  await page.getByRole('spinbutton', { name: 'Cache TTL', exact: true }).press('Tab');
  await page.waitForTimeout(5000);
  report.checks.backgroundRefresh = await metrics();
  assert.ok(positive(report.checks.backgroundRefresh['Background refreshes']));

  await page
    .getByRole('combobox', { name: 'Cache write policy' })
    .selectOption('write-back');
  await page
    .getByRole('slider', { name: 'Writes sit dirty for', exact: true })
    .press('End');
  await page.waitForTimeout(1500);
  report.checks.buffered = await metrics();
  assert.ok(positive(report.checks.buffered['Dirty buffered writes']));
  await page.getByRole('button', { name: 'Crash', exact: true }).click();
  await page.waitForTimeout(500);
  report.checks.crashed = await metrics();
  assert.ok(positive(report.checks.crashed['Failed flushes']));
  await page
    .getByRole('button', { name: 'Apply write-through', exact: true })
    .waitFor();
  await page.screenshot({ path: resolve(out, 'cache-write-back-crash.png') });
  await page.getByRole('button', { name: 'Fix', exact: true }).click();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).first().click();
  const share = await page.locator('input[readonly]').first().inputValue();
  assert.match(share, /#d3\./);
  await page.goto(share);
  await page.reload();
  await page.locator('[data-hit="node"][data-kind="cache"]').click();
  await page
    .getByRole('spinbutton', { name: 'Stale serving window', exact: true })
    .waitFor();
  await page
    .getByRole('slider', { name: 'Writes sit dirty for', exact: true })
    .waitFor();
  report.checks.sharePreservesPolicies = true;
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failedAssets, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  writeFileSync(
    resolve(out, 'cache-smoke-results.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
