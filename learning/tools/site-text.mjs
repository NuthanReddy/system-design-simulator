// Text and URL helpers shared by page markup and SEO tags.
import { hostedConfig } from '../account/deployment.js';
export const SITE = hostedConfig({ siteUrl: process.env.SD_SITE_URL || undefined }).siteUrl;
export const clean = value => String(value ?? '').replace(/\u2014/g, ', ').replace(/\s+,/g, ',');
export const esc = value => clean(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const json = obj => JSON.stringify(obj).replace(/</g, '\\u003c');
