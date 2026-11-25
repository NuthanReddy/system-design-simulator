import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.js';
import { hostedConfig } from '../../account/deployment.js';
import { apiBase, previewHosted } from '../../account/config.js';
import { startApp, client } from './helpers.js';
import { openDb } from '../db.js';

test('static accounts stay off and hosted configuration rejects unsafe endpoints', () => {
  assert.equal(apiBase(new URL('https://nuthanreddy.github.io/system-design-simulator/learning/')), null);
  assert.equal(previewHosted(new URL('https://example.test/?preview=hosted')), false);
  assert.throws(() => hostedConfig({ enabled: true }), /requires SD_API_URL/);
  for (const apiUrl of ['http://api.example.test', 'https://api.example.test/path', 'https://u:p@api.example.test', 'https://api.example.test/?key=x']) {
    assert.throws(() => hostedConfig({ apiUrl, enabled: true }));
  }
  const base = { SESSION_SECRET: 's'.repeat(40), NODE_ENV: 'production' };
  assert.ok(loadConfig({ ...base, SITE_URL: 'http://127.0.0.1:4173/' }).errors.length);
  assert.ok(loadConfig({ ...base, GITHUB_CLIENT_ID: 'Ov23liTestClient01', GITHUB_CLIENT_SECRET: 'testsecret0123456789abcdefghij' }).errors.some(e => e.includes('API_URL')));
});

test('custom-site CORS and OAuth preserve the complete learning base path', async () => {
  const siteUrl = 'https://app.example.test/training/learning/';
  const app = await startApp({
    env: { SITE_URL: siteUrl, API_URL: 'https://api.example.test', GITHUB_CLIENT_ID: 'Ov23liTestClient01', GITHUB_CLIENT_SECRET: 'testsecret0123456789abcdefghij' },
    github: {
      authorizeUrl: state => 'https://github.com/login/oauth/authorize?state=' + state,
      profile: async () => ({ id: 'custom-user', name: 'Custom learner' }),
    },
  });
  try {
    assert.equal(app.config.github.redirectUri, 'https://api.example.test/auth/github/callback');
    const c = client(app.base, { origin: new URL(siteUrl).origin });
    const started = await c.req('GET', '/auth/github/start?return=%23%2Fchallenge');
    const state = new URL(started.headers.get('location')).searchParams.get('state');
    const signed = await c.req('GET', `/auth/github/callback?code=good-code&state=${state}`);
    assert.equal(signed.headers.get('location'), `${siteUrl}?signin=github#/challenge`);
    assert.equal((await c.req('GET', '/me')).json.user.name, 'Custom learner');
    const foreign = client(app.base, { origin: 'https://systemdesigner.io' });
    assert.equal((await foreign.req('OPTIONS', '/progress')).status, 403);
    assert.equal((await foreign.req('POST', '/auth/fake', { body: { id: 'foreign' } })).status, 403);
  } finally { await app.close(); }
});

test('personal server does not queue marketing email or retain it on account deletion', () => {
  const db = openDb(':memory:', { marketing: false });
  try {
    const { userId } = db.signIn({ provider: 'github', subject: 'personal-user', name: 'Personal user', email: 'test@example.test' }, Date.now());
    db.setMarketingOptIn(userId, true, Date.now(), 'US');
    assert.equal(db.marketingJobs(Date.now(), true).length, 0);
    db.deleteUser(userId);
    assert.equal(db.user(userId), null);
    assert.equal(db.marketingJobs(Date.now(), true).length, 0);
  } finally { db.close(); }
});
