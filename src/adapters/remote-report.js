/**
 * Secure remote report loading (spec §13.5). Fetches a report from a URL with
 * strict rules: HTTPS only (localhost allowed for dev), credentials omitted, no
 * cookies, no third-party proxy. Arbitrary origins require explicit user
 * confirmation; a small set of documented trusted hosts may load without it.
 * CORS/other failures return an understandable message and the caller falls
 * back to local download + upload.
 */

import { MAX_FILE_BYTES } from '../utils/input-limits.js';

// Documented trusted report hosts (may load without extra confirmation).
export const TRUSTED_REPORT_HOSTS = ['mgifford.github.io'];

/**
 * Validates a report URL and classifies trust. Does NOT fetch.
 * @param {string} rawUrl
 * @returns {{ ok: boolean, url?: URL, trusted?: boolean, error?: string }}
 */
export function classifyReportUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return { ok: false, error: 'That is not a valid URL.' }; }

  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(isLocalhost && url.protocol === 'http:')) {
    return { ok: false, error: 'Only HTTPS report URLs are allowed (localhost may use http for development).' };
  }
  // Reject unsafe schemes defensively (URL() already blocks javascript: as a
  // protocol here, but be explicit).
  if (/^(javascript|data|blob|file):/i.test(rawUrl)) {
    return { ok: false, error: 'Unsafe URL scheme.' };
  }

  const trusted = TRUSTED_REPORT_HOSTS.includes(url.hostname) || isLocalhost;
  return { ok: true, url, trusted };
}

/**
 * Fetches a report over the network with the required safety options.
 * @param {string} rawUrl
 * @param {object} [opts]
 * @param {boolean} [opts.confirmedArbitrary] - the user confirmed a non-trusted origin.
 * @param {typeof fetch} [opts.fetchImpl] - injectable for tests.
 * @param {AbortSignal} [opts.signal] - for cancellation (spec §13.7).
 * @returns {Promise<{ ok: boolean, text?: string, filename?: string, needsConfirmation?: boolean, error?: string }>}
 */
export async function fetchRemoteReport(rawUrl, opts = {}) {
  const cls = classifyReportUrl(rawUrl);
  if (!cls.ok) return { ok: false, error: cls.error };

  if (!cls.trusted && !opts.confirmedArbitrary) {
    return { ok: false, needsConfirmation: true, error: `This report is on ${cls.url.hostname}, which is not a documented trusted host. Confirm you want to fetch it, or download it and upload it here instead.` };
  }

  const doFetch = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!doFetch) return { ok: false, error: 'Network fetch is not available in this environment.' };

  try {
    const res = await doFetch(cls.url.href, {
      method: 'GET',
      credentials: 'omit', // never send cookies (spec §13.5)
      redirect: 'follow',
      signal: opts.signal
    });
    if (!res.ok) {
      return { ok: false, error: `The report host responded with ${res.status}. Download the report and upload it here instead.` };
    }
    // Refuse before consuming the body when the server declares an over-limit
    // size (spec §13.3). Not all servers send Content-Length; the string-size
    // backstop in the loader still applies after consumption.
    const declared = Number(res.headers && res.headers.get && res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) {
      return { ok: false, error: `The report is ${(declared / (1024 * 1024)).toFixed(0)} MB, above the ${MAX_FILE_BYTES / (1024 * 1024)} MB limit. Download and filter it, then upload it here.` };
    }
    const text = await res.text();
    const filename = cls.url.pathname.split('/').pop() || 'report';
    return { ok: true, text, filename };
  } catch (err) {
    if (err && err.name === 'AbortError') return { ok: false, error: 'Fetch cancelled.' };
    // A cross-origin fetch without CORS headers throws a TypeError here.
    return { ok: false, error: 'Could not fetch the report (this is often a CORS restriction on the report host). Download the report and upload it here instead.' };
  }
}

/** Reads a `?report=` URL parameter, if present. */
export function reportUrlFromLocation(search = (typeof location !== 'undefined' ? location.search : '')) {
  try { return new URLSearchParams(search).get('report'); } catch { return null; }
}

/**
 * Given an open-scans summary `report.csv` URL, returns the sibling finding-level
 * `report.json` URL in the same directory (open-scans publishes both per scan).
 * Returns null when the URL is not a `report.csv` we recognize. The trust/scheme
 * classification of the returned URL is still enforced by fetchRemoteReport.
 * @param {string} rawUrl
 * @returns {string | null}
 */
export function reportJsonSiblingUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (!/\/report\.csv$/i.test(url.pathname)) return null;
  url.pathname = url.pathname.replace(/report\.csv$/i, 'report.json');
  return url.href;
}
