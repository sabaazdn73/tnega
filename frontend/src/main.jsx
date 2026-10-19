import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

import { installApiRetry } from './apiRetry';
import { wagmiConfig } from './wagmiConfig';
import App from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import ThemedRainbowKit from './theme/ThemedRainbowKit';
import { SignInProvider } from './wallet/SignInProvider';
import { isSignPath, stripTrailingSlash, resolvePath } from './routePaths';
import { appPathname, fp, installFinanceBase, isFinancePath } from './basePath';
import './index.css';

// WHICH PRODUCT THIS ADDRESS IS (basePath.js). "/" is the structural
// engineering review agent; everything under /finance is the tokenized-stock
// product. A finance address from before the move (/stocks, /sign/<id>,
// /market, "/?agent=<id>") is moved under /finance here, replaced rather than
// pushed, before anything renders. An address that is neither goes to "/".
function bootProduct() {
  const { pathname, search, hash } = window.location;
  const p = stripTrailingSlash(pathname);
  if (isFinancePath(p)) return 'finance';
  if (p === '/' && !/[?&]agent=/.test(search)) return 'engineering';
  const { unknown } = resolvePath(p);
  try {
    window.history.replaceState(window.history.state, '', unknown ? `/${hash}` : `${fp(p)}${search}${hash}`);
  } catch { /* non-fatal */ }
  return unknown ? 'engineering' : 'finance';
}
const PRODUCT = bootProduct();
if (PRODUCT === 'finance') installFinanceBase();

// Installed before anything renders, so every backend call in the app is
// covered rather than only the ones that were remembered. GET/HEAD only --
// see apiRetry.js for why writes are deliberately excluded.
installApiRetry(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000');

const queryClient = new QueryClient();

// The wallet modal follows the site theme (theme/ThemedRainbowKit.jsx).

const root = ReactDOM.createRoot(document.getElementById('root'));

// The site, with its one wallet config.
const renderSite = (fallback = false) => root.render(
  <React.StrictMode>
    {/* Outermost, so every provider and page below it, including the
        wallet modal and the standalone routes, reads one theme. */}
    <ThemeProvider>
    {/* One wallet path: wagmi with RainbowKit's connect modal, for a wallet
        the visitor already has. There is no login provider; see
        docs/deferred.md for what was considered and why it is not built.

        reconnectOnMount is wagmi's default: a previously connected wallet
        is restored after a reload with no extra code here.

        SignInProvider sits inside wagmi and RainbowKit because it reads the
        connected account and opens RainbowKit's connect modal. */}
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ThemedRainbowKit>
            <SignInProvider>
              <App tree={fallback ? 'site-fallback' : 'site'} />
            </SignInProvider>
          </ThemedRainbowKit>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  </React.StrictMode>
);

// A signing link (/sign/<id>) gets its own providers instead of the site's
// (sign/SignRoot.jsx says why), loaded only for such a page load. If that
// code cannot load, the site renders as usual and the page says what it can.
if (PRODUCT === 'engineering') {
  // The engineering home needs no wallet providers; it is loaded on its own.
  import('./engineering/EngineeringHome.jsx').then(({ default: EngineeringHome }) => root.render(
    <React.StrictMode>
      <ThemeProvider>
        <EngineeringHome />
      </ThemeProvider>
    </React.StrictMode>
  ));
} else if (isSignPath(stripTrailingSlash(appPathname()))) {
  import('./sign/SignRoot.jsx').then(({ default: SignRoot }) => root.render(
    <React.StrictMode>
      <ThemeProvider>
        <SignRoot queryClient={queryClient}>
          <App tree="sign" />
        </SignRoot>
      </ThemeProvider>
    </React.StrictMode>
  )).catch(() => renderSite(true));
} else {
  renderSite();
}
