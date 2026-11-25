export const DEFAULT_SITE_URL = 'https://nuthanreddy.github.io/system-design-simulator/learning/';

export function hostedConfig({ siteUrl = DEFAULT_SITE_URL, apiUrl = '', enabled = false } = {}) {
  const parse = (value, name) => {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
      throw new Error(`${name} must be HTTPS (HTTP is only allowed on loopback), without credentials, query or fragment.`);
    }
    return url;
  };
  const site = parse(siteUrl, 'SD_SITE_URL');
  if (!site.pathname.endsWith('/')) site.pathname += '/';
  const api = apiUrl ? parse(apiUrl, 'SD_API_URL') : null;
  if (api && api.pathname !== '/') throw new Error('SD_API_URL must be an origin, without a path.');
  if (enabled && !api) throw new Error('SD_API_LIVE requires SD_API_URL.');
  return { siteUrl: site.href, siteOrigin: site.origin, apiUrl: api?.origin || '', enabled: !!enabled };
}
