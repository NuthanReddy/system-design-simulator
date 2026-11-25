import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
import { problems } from '../learning/content/problems/index.js';
import { estimateUnit } from '../learning/ui/play/estimate-units.js';

const base = process.env.SITE_URL ?? 'http://127.0.0.1:4173/system-design-simulator/';
const out = process.env.SMOKE_OUT ?? resolve(tmpdir(), 'system-design-smoke');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const report = { base, errors: [], failedAssets: [], checks: {}, simulation: {} };
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('response', (response) => {
  if (response.url().startsWith(base) && response.status() >= 400) {
    report.failedAssets.push(`${response.status()} ${response.url()}`);
  }
});
try {
  await page.goto(`${base}?example=single-server`);
  await page.locator('[data-hit="node"]').first().waitFor();
  assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
  assert.equal(await page.locator('[data-hit="node"]').count(), 3);
  await page.waitForTimeout(2000);
  report.simulation.baseline = await page.locator('.traffic-headline').innerText();
  const slider = page.locator('.traffic-load-track input');
  await slider.focus();
  await slider.press('End');
  await page.waitForTimeout(6000);
  report.simulation.overload = await page.locator('.traffic-headline').innerText();
  assert.notEqual(report.simulation.overload, report.simulation.baseline);
  assert.match(report.simulation.overload, /Failing/);
  report.checks.offeredLoad = await page.locator('.traffic-multiple').innerText();
  await slider.press('Home');
  await page.getByRole('button', { name: 'Reset simulation', exact: true }).click();
  await page.locator('[data-hit="node"][data-kind="db"]').click();
  await page.getByRole('button', { name: 'Crash', exact: true }).click();
  await page.waitForTimeout(1500);
  assert.equal(
    await page.getByRole('button', { name: 'Crashed', exact: true }).count(),
    1,
  );
  report.simulation.crash = await page.locator('.traffic-headline').innerText();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).first().click();
  const shareField = page.locator('input[readonly]').first();
  await shareField.waitFor();
  const share = await shareField.inputValue();
  assert.ok(share.startsWith(base));
  assert.match(share, /#d3\./);
  await page.goto(share);
  await page.locator('[data-hit="node"]').first().waitFor();
  assert.equal(await page.locator('[data-hit="node"]').count(), 3);
  await page.reload();
  await page.locator('[data-hit="node"]').first().waitFor();
  assert.equal(await page.locator('[data-hit="node"]').count(), 3);
  report.checks.shareAndReload = true;
  await page.keyboard.press('Shift+P');
  assert.equal(await page.locator('.app.is-presenting').count(), 1);
  report.checks.presentation = true;
  await page.getByRole('button', { name: 'Stop presenting', exact: true }).click();
  await page.screenshot({ path: resolve(out, 'simulator.png') });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page
    .getByRole('menuitem', { name: 'Learn and practise interviews', exact: true })
    .click();
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await page.goto(`${base}learning/#/practice`);
  await page.getByRole('heading', { name: 'Problem bank', exact: true }).waitFor();
  assert.match(await page.locator('main').innerText(), /82 problems/);
  report.checks.practiceCatalog = 82;
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('button', { name: 'Medium', exact: true }).click();
  assert.match(await page.locator('main').innerText(), /Filters \(1\)/);
  report.checks.practiceFilters = true;
  await page.goto(`${base}learning/#/learn`);
  await page.getByRole('heading', { name: 'One idea at a time' }).waitFor();
  assert.equal(
    await page.getByRole('img', { name: '0 of 41 lessons done' }).count(),
    1,
  );
  report.checks.lessons = 41;
  await page.goto(`${base}learning/#/practice/url-shortener`);
  await page.getByRole('heading', { name: 'URL shortener', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Continue to numbers', exact: true }).click();
  await page.getByRole('button', { name: 'Start drawing', exact: true }).click();
  const problem = problems.find((p) => p.id === 'url-shortener');
  assert.ok(problem);
  const run = async (build = false, model = problem) =>
    page.evaluate(
      async ({ graph, build }) => {
        if (!build) window.__game.reset();
        let state = window.__game.getState();
        const ids = new Map(state.nodes.map((n) => [n.id, n.id]));
        for (const node of build ? graph.nodes : []) {
          if (ids.has(node.ref)) continue;
          const id = window.__game.placeComponent(node.type, node.x, node.y);
          if (!id) throw new Error(`Could not place ${node.type}`);
          ids.set(node.ref, id);
          for (const key of ['units', 'zones', 'region', 'tier']) {
            if (node[key] != null) window.__game.setKnob(id, key, node[key]);
          }
          for (const [key, value] of Object.entries(node.knobs ?? {})) {
            window.__game.setKnob(id, key, value);
          }
        }
        for (const edge of build ? graph.edges : []) {
          const [from, to] = Array.isArray(edge) ? edge : String(edge).split('>');
          if (!window.__game.connect(ids.get(from), ids.get(to))) {
            throw new Error(`Connection refused ${from}>${to}`);
          }
        }
        window.__game.startTraffic();
        state = window.__game.step(86400000);
        return {
          score: state.score,
          phase: state.phase,
          cost: state.cost,
          errors: state.errors,
        };
      },
      { graph: model.editorial.designs[0].graph, build },
    );
  report.simulation.learningWarmup = await run(true);
  report.simulation.learning = await run();
  report.simulation.learningReplay = await run();
  assert.deepEqual(
    report.simulation.learning.score,
    report.simulation.learningReplay.score,
  );
  assert.deepEqual(
    report.simulation.learning.cost,
    report.simulation.learningReplay.cost,
  );
  assert.ok(report.simulation.learning.score);
  assert.equal(report.simulation.learning.phase, 'done');
  assert.deepEqual(report.simulation.learning.errors, []);
  await page.screenshot({ path: resolve(out, 'learning.png') });
  const medium = problems.find((p) => p.difficulty === 'Medium');
  await page.goto(`${base}learning/#/practice/${medium.id}?interview=1`);
  await page.locator('.pl-root[data-interview="true"]').waitFor();
  await page
    .getByLabel('What would you ask?', { exact: true })
    .fill(
      'How many users and peak requests per second? What latency, failure and data safety targets apply?',
    );
  await page.getByRole('button', { name: 'Commit questions', exact: true }).click();
  await page.getByRole('button', { name: 'Write requirements', exact: true }).click();
  await page
    .getByLabel(
      'What will you build, exclude, and measure? State your target numbers.',
      { exact: true },
    )
    .fill(
      'Build a regional API with bounded retries and admission limits. Measure peak requests, p99 latency and failed requests; exclude unrelated reporting.',
    );
  await page.getByRole('button', { name: 'Commit requirements', exact: true }).click();
  await page
    .getByRole('button', { name: 'Estimate the workload', exact: true })
    .click();
  const estimates = page.locator('.pl-defense-field input[type="number"]');
  assert.equal(await estimates.count(), medium.numbers.length);
  for (let i = 0; i < medium.numbers.length; i++) {
    await estimates.nth(i).fill(String(estimateUnit(medium.numbers[i]).value));
  }
  await page.getByRole('button', { name: 'Commit estimates', exact: true }).click();
  await page.getByRole('button', { name: 'Start drawing', exact: true }).click();
  assert.match(await page.locator('.pl-interview-clock').innerText(), /Interview/);
  report.checks.interviewPreparation = true;
  report.simulation.interview = await run(true, medium);
  assert.equal(report.simulation.interview.phase, 'done');
  assert.deepEqual(report.simulation.interview.errors, []);
  const defenses = page.locator('.pl-defense-card');
  assert.ok((await defenses.count()) > 0);
  for (let i = 0; i < (await defenses.count()); i++) {
    const defense = defenses.nth(i);
    await defense
      .getByLabel('Your answer', { exact: true })
      .fill(
        'Bound retries and queues; compare measured latency, failed traffic, durable writes and monthly cost with the requirements, and test failure claims against the same workload.',
      );
    await defense
      .getByRole('button', { name: 'Reveal the model answer', exact: true })
      .click();
    await defense.getByRole('combobox').first().selectOption('fail');
    await defense
      .getByLabel('Commit prediction and replay', { exact: true })
      .first()
      .check();
  }
  await page
    .getByRole('button', { name: 'Save interview report', exact: true })
    .click();
  assert.equal(
    await page
      .getByRole('button', { name: 'Interview report saved', exact: true })
      .isDisabled(),
    true,
  );
  assert.match(
    await page.locator('.pl-interview-report').innerText(),
    /Saved on this device/,
  );
  report.checks.interviewReport = true;
  await page.screenshot({ path: resolve(out, 'interview.png') });
  await page.goto(`${base}learning/#/settings`);
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  report.checks.learningSettings = await page.locator('main').innerText();
  assert.equal(
    await page.getByRole('button', { name: 'Sign in', exact: true }).count(),
    0,
  );
  for (const path of [
    'glossary/',
    'privacy/',
    'learning/guides/two-week-system-design-plan/',
  ]) {
    const response = await page.goto(`${base}${path}`);
    assert.equal(response.status(), 200);
    assert.ok((await page.locator('h1').innerText()).length > 0);
  }
  const readingContext = await browser.newContext({ javaScriptEnabled: false });
  const reading = await readingContext.newPage();
  await reading.goto(`${base}learning/guides/two-week-system-design-plan/`);
  assert.equal(await reading.locator('.sd-gated[hidden]').count(), 0);
  assert.equal(await reading.getByLabel('Email address', { exact: true }).count(), 0);
  assert.ok((await reading.locator('main').innerText()).length > 2500);
  report.checks.accountFreeReadingWithoutJavaScript = true;
  await readingContext.close();
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failedAssets, []);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failure = error.message;
  report.lastScreen = await page.locator('body').innerText();
  await page.screenshot({ path: resolve(out, 'smoke-failure.png') });
  throw error;
} finally {
  writeFileSync(resolve(out, 'smoke-results.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
