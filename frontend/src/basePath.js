// basePath.js
//
// TWO PRODUCTS ON ONE DOMAIN (owner, 2026-10-19).
// tnega.app itself is now the structural-engineering review agent, and the
// tokenized-stock product that was the whole site until then lives under
// /finance. Every finance page keeps the path it always had INSIDE the app
// (routePaths.js still says '/stocks', '/sign/<id>', '/docs/...'); only the
// address in the browser carries the prefix. This file is the one place that
// knows about it:
//
//   appPathname()   the address bar's path with /finance taken off, which is
//                   what routePaths.js and every page compare against.
//   fp(url)         an in-app path as the browser should show it.
//   A link that must leave the finance product for the engineering home
//   carries data-site-root and is left alone.
//   installFinanceBase()
//                   called once at boot on a finance page: every
//                   history.pushState/replaceState gets the prefix, and every
//                   internal <a href="/..."> the pages render is rewritten to
//                   it, so no page had to change its links.
//
// OLD ADDRESSES KEEP WORKING. A finance path without the prefix (a bookmark,
// a /sign/<id> link from the MCP server, the Chrome extension's /market and
// /chain/hyperliquid) is moved under /finance by main.jsx before anything
// renders, with replaceState, so Back never returns to the old form.
//
// A plain module, no React, so a headless check can import it.

export const FINANCE_BASE = '/finance';

// Files served as they are from public/, never routed: a link to one must
// not get the prefix. A path with a file extension is a file too.
const STATIC_PREFIXES = ['/receipts/', '/fonts/', '/logos/', '/weekly/', '/agent-hero/', '/town/', '/eval/'];
const isStaticPath = (p) => STATIC_PREFIXES.some((s) => p.startsWith(s)) || /\.[a-z0-9]{2,5}$/i.test(p);

let active = false;

/** Is this browser path one of the finance product's addresses? */
export function isFinancePath(pathname) {
  return pathname === FINANCE_BASE || pathname.startsWith(`${FINANCE_BASE}/`);
}

/** The in-app path for a browser path: '/finance/stocks' -> '/stocks',
 *  '/finance' -> '/'. A path outside /finance comes back unchanged. */
export function appPathname(pathname = (typeof window !== 'undefined' ? window.location.pathname : '/')) {
  if (!isFinancePath(pathname)) return pathname;
  return pathname.slice(FINANCE_BASE.length) || '/';
}

/** An in-app URL as the browser shows it: '/stocks?q=x' -> '/finance/stocks?q=x',
 *  '/' -> '/finance'. Absolute URLs, protocol-relative URLs, hashes, static
 *  files and anything already under /finance pass through unchanged. */
export function fp(url) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return url;
  const path = url.split(/[?#]/)[0];
  if (isFinancePath(path) || isStaticPath(path)) return url;
  if (path === '/') return `${FINANCE_BASE}${url.slice(1)}`;
  return `${FINANCE_BASE}${url}`;
}

/** fp() only while this page load is a finance page; identity otherwise. */
export function publicPath(url) {
  return active ? fp(url) : url;
}

/** '/finance/x' -> '/x' for a URL handed to the app's own navigate(). */
export function stripBase(url) {
  if (typeof url !== 'string') return url;
  const cut = url.search(/[?#]/);
  const path = cut >= 0 ? url.slice(0, cut) : url;
  if (!isFinancePath(path)) return url;
  return (path.slice(FINANCE_BASE.length) || '/') + (cut >= 0 ? url.slice(cut) : '');
}

function fixAnchor(a) {
  if (a.tagName !== 'A' || a.hasAttribute('data-site-root')) return;
  const raw = a.getAttribute('href');
  if (!raw) return;
  const next = fp(raw);
  if (next !== raw) a.setAttribute('href', next);
}

/** Once per finance page load, before the first render. */
export function installFinanceBase() {
  if (active || typeof window === 'undefined') return;
  active = true;
  const { history } = window;
  for (const name of ['pushState', 'replaceState']) {
    const orig = history[name].bind(history);
    history[name] = (state, title, url) => orig(state, title, url == null ? url : fp(String(url)));
  }
  const scan = (root) => {
    if (root.nodeType !== 1) return;
    fixAnchor(root);
    root.querySelectorAll?.('a[href^="/"]').forEach(fixAnchor);
  };
  const start = () => {
    scan(document.body);
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') fixAnchor(r.target);
        else r.addedNodes.forEach(scan);
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}
