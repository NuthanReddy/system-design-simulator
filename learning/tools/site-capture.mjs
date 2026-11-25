import { relative } from './site-template.mjs';

export function captureBox(file) {
  return `<p class="site-note">All reading content is available without email registration.
Email updates are not configured. <a href="${relative(file, 'privacy.html')}">Privacy</a>.</p>`;
}

export function gateReading(file, intro, rest) {
  return `${intro}${captureBox(file)}${rest}`;
}

export const gateData = { isAccessibleForFree: true };
