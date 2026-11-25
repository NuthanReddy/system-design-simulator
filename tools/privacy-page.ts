import { SITE_ORIGIN as SITE } from './site.ts';

export function renderPrivacyPage(): string {
  const accounts = process.env.SD_API_LIVE === '1';
  const shortLinks = Boolean(process.env.VITE_SHARE_API);
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy | System Design Simulator</title>
<link rel="canonical" href="${SITE}/privacy/">
<style>body{font:16px/1.6 system-ui;margin:40px auto;padding:0 20px;max-width:720px}a{color:#325cbd}</style>
</head><body><h1>Privacy and hosting</h1>
<p>Advertising, marketing email and analytics are disabled.
${
  accounts
    ? 'An optional account API is configured for sign-in, progress sync and public leaderboards. Provider availability depends on its configuration.'
    : 'No account/progress-sync service or public leaderboard is configured for this build.'
}</p>
<h2>Your designs and progress</h2>
<p>Both workbenches save locally in your browser. They use different design formats
and storage keys. Clearing browser data removes local progress and designs. Export
files or backups before changing browsers.
${
  accounts
    ? 'When signed in, progress is synced to the configured API and eligible finished designs are submitted for server replay and leaderboard scoring. Public boards show your display name, avatar and score; the API stores submitted designs to verify results.'
    : 'Nothing uploads a design automatically.'
}</p>
${accounts ? '<h2>Optional accounts</h2><p>The API stores provider identity, display name/avatar, any verified provider email, progress and submitted results. Session cookies are HttpOnly, Secure and SameSite=Lax. Sign-out revokes the session; deleting the account removes live account/progress/score data. Operator backups may retain it until their retention period ends. No marketing email is sent. The owner must set backup retention with the hosting provider before enabling accounts.</p>' : ''}
<h2>Sharing</h2>
<p>Simulator share links carry the design after the URL's #, which browsers do not
send to the server. These are encoded, not encrypted: anyone with the whole link
can read the design. Links over 2,000 characters require a design file.
${
  shortLinks
    ? 'Optional short links encrypt simulator designs in your browser with AES-GCM. Only ciphertext is uploaded; the key travels in the URL fragment, not to the store. Anyone with the complete link has the key. These links require the store to remain available.'
    : 'Encrypted short-link storage is not configured.'
} Learning workbench share and
challenge links likewise carry their data in the address.</p>
<h2>Network requests</h2>
<p>GitHub Pages serves this site and may retain hosting access logs under GitHub's
privacy policy. The simulator requests the public repository star count from
api.github.com. The learning canvas loads PixiJS from jsDelivr. Fonts and application
content ship with the site. External links take you to their respective sites.</p>
<h2>Source and licenses</h2>
<p>Adapted from <a href="https://github.com/workersio/breakscale">Breakscale</a> and
<a href="https://github.com/adityareddy-dev/system-designer">System Designer</a>,
both MIT-licensed. No upstream hosted API is configured for this deployment.</p>
<p><a href="${SITE}/">Simulator</a> · <a href="${SITE}/learning/">Learning workbench</a> ·
<a href="https://github.com/NuthanReddy/system-design-simulator/issues">Report a problem</a></p>
</body></html>`;
}
