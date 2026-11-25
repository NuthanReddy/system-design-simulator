import { execFileSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { hostedConfig } from '../learning/account/deployment.js';

const root = process.cwd();
const hosted = hostedConfig({
  siteUrl: process.env.SD_SITE_URL || undefined,
  apiUrl: process.env.SD_API_URL || '',
  enabled: process.env.SD_API_LIVE === '1',
});
execFileSync(process.execPath, ['tools/release.mjs'], {
  cwd: resolve(root, 'learning'),
  env: { ...process.env, ESBUILD_DIR: root, SKIP_PREVIEW_IMAGES: '1' },
  stdio: 'inherit',
});
cpSync(resolve(root, 'learning/dist'), resolve(root, 'dist/learning'), {
  recursive: true,
});
cpSync(resolve(root, 'LICENSE'), resolve(root, 'dist/LICENSE.txt'));
cpSync(resolve(root, 'learning/LICENSE'), resolve(root, 'dist/learning/LICENSE.txt'));

// Generated reading pages keep upstream authorship; only product chrome changes.
function adaptPages(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) adaptPages(file);
    else if (entry.name.endsWith('.html')) {
      const html = readFileSync(file, 'utf8')
        .replace(
          /System Designer(?=,? (?:home|·)|<\/title>|<\/span>)/g,
          'System Design Lab',
        )
        .replace(/https:\/\/systemdesigner\.io\//g, hosted.siteUrl)
        .replace(
          /https:\/\/github\.com\/adityareddy-dev\/system-designer/g,
          'https://github.com/NuthanReddy/system-design-simulator',
        )
        .replace(
          /<nav class="sh-nav" aria-label="Sections">/g,
          `<nav class="sh-nav" aria-label="Sections"><a class="sh-tab" href="${new URL('../', hosted.siteUrl).pathname}">Simulator</a>`,
        )
        .replace(/<a class="sd-signin"[^>]*>Sign in<\/a>/g, (link) =>
          hosted.enabled ? link : '',
        )
        .replace(        /<script[^>]*src="[^"]*assets\/(?:analytics|email-capture)\.js"[^>]*><\/script>/g, '')
        .replace(/<(button|a)\b[^>]*data-cookie-choices[^>]*>[\s\S]*?<\/\1>/g, '')
        .replace(
          '</head>',
          `<script>globalThis.SD_HOSTED=${JSON.stringify(hosted).replace(/</g, '\\u003c')};</script></head>`,
        )
        .replace(
          /<footer class="site-footer">/g,
          `<footer class="site-footer"><p>Adapted from <a href="https://github.com/adityareddy-dev/system-designer">System Designer</a>, MIT, Copyright 2026 Aditya Reddy. ${hosted.enabled ? 'Optional accounts use this deployment&#39;s configured API.' : 'Accounts and public leaderboards are not configured on this site.'}</p>`,
        );
      writeFileSync(file, html);
    }
  }
}
adaptPages(resolve(root, 'dist/learning'));
for (const file of [
  'assets/analytics.js',
  'assets/analytics.css',
  'assets/email-capture.js',
]) {
  rmSync(resolve(root, 'dist/learning', file), { force: true });
}
writeFileSync(
  resolve(root, 'dist/learning/privacy.html'),
  '<!doctype html><html lang="en"><meta charset="UTF-8"><title>Privacy | System Design Lab</title>' +
    '<h1>Privacy</h1><p>Read the policy below for local storage, sharing and any configured optional services.</p>' +
    '<p><a href="../privacy/">Read the privacy and hosting policy for both workbenches</a>.</p></html>',
);
