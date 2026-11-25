import { hostedConfig } from './deployment.js';

const deployment = hostedConfig({
  siteUrl: typeof __SD_SITE_URL__ === 'string' ? __SD_SITE_URL__ : undefined,
  apiUrl: typeof __SD_API_URL__ === 'string' ? __SD_API_URL__ : '',
  enabled: typeof __SD_API_LIVE__ === 'boolean' && __SD_API_LIVE__,
});
export const SITE = deployment.siteOrigin;
export const API = deployment.apiUrl;
export const API_LIVE = deployment.enabled;

export const DEV_API_PORT = 8792;

// The service address for this page, or null when accounts are off here (forks, previews, plain local runs).
// A local copy on port 8765 opts in with ?api (port 8792) or ?api=<port>.
export function apiBase(loc = globalThis.location) {
  if (!loc) return null;
  if (loc.origin === SITE && API_LIVE &&
      (loc.pathname || '/').startsWith(new URL(deployment.siteUrl).pathname)) return API;
  if ((loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') &&
      ['8765', '4173', '5173'].includes(loc.port) && loc.protocol === 'http:') {
    const q = new URLSearchParams(loc.search || '').get('api');
    if (q === null) return null;
    const port = /^\d{2,5}$/.test(q) ? Number(q) : DEV_API_PORT;
    return port > 0 && port < 65536 ? `http://${loc.hostname}:${port}` : null;
  }
  return null;
}

export function previewHosted() {
  return false;
}
