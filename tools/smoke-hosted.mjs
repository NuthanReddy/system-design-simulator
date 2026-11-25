import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startApp, ownDesign, payloadFor } from '../learning/api/test/helpers.js';

const site = 'http://127.0.0.1:4173/system-design-simulator/learning/';
const api = await startApp({ env: { SITE_URL: site } });
let browser;
try {
  execFileSync(process.execPath, ['tools/build-learning.mjs'], {
    env: { ...process.env, SD_SITE_URL: site, SD_API_URL: api.base, SD_API_LIVE: '1' },
    stdio: 'ignore',
  });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  const signIn = async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${site}#/settings`);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page
      .getByRole('button', { name: 'Continue as a test player', exact: true })
      .click();
    await page.locator('.ac-me-btn').waitFor();
    return page;
  };
  const first = await signIn();
  const call = (page, method, path, body) =>
    page.evaluate(
      async ({ base, method, path, body }) => {
        const response = await fetch(base + path, {
          method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return { status: response.status, data: await response.json() };
      },
      { base: api.base, method, path, body },
    );
  const progress = {
    problems: {
      'url-shortener': {
        attempts: 2,
        bestScore: 900,
        stars: 2,
        solvedAt: Date.now(),
        lastResultAt: Date.now(),
      },
    },
    lessons: { caching: Date.now() },
  };
  assert.equal((await call(first, 'PUT', '/progress', { progress })).status, 200);
  const second = await signIn();
  await second.reload();
  await second.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await second.waitForFunction(() =>
    document.querySelector('main')?.innerText.includes('1 problems solved'),
  );
  assert.match(await second.locator('main').innerText(), /1 lessons done/);
  assert.equal(
    (await call(second, 'GET', '/progress')).data.progress.problems['url-shortener']
      .bestScore,
    900,
  );

  const problem = api.game.problemById.get('url-shortener');
  const { payload, localScore } = await payloadFor(api.game, {
    problemId: problem.id,
    seed: 'practice',
    graph: ownDesign(problem),
    claim: 1,
  });
  const submitted = await call(first, 'POST', '/results', { payload });
  assert.equal(submitted.status, 200);
  assert.equal(
    submitted.data.score,
    localScore,
    'server measures its own score, not the claimed 1',
  );
  const board = await call(second, 'GET', '/leaderboard?problem=url-shortener');
  assert.equal(board.status, 200);
  assert.ok(board.data.total > 0);
  assert.equal((await call(first, 'POST', '/auth/signout', {})).status, 200);
  assert.equal((await call(first, 'GET', '/progress')).status, 401);
  assert.deepEqual(errors, []);
  console.log(
    'Hosted browser smoke passed: real loopback test-provider session, two-context progress sync, server-replayed public board and session revocation. Real OAuth/cloud deployment not tested.',
  );
} finally {
  await browser?.close();
  await api.close();
  execFileSync(process.execPath, ['tools/build-learning.mjs'], {
    env: process.env,
    stdio: 'ignore',
  });
}
