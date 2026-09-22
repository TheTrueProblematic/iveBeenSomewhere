// overlayHost.js — which DOM node app-level overlays (modals) mount into.
//
// Native fullscreen doesn't just resize an element: the browser moves it into
// the TOP LAYER and paints an opaque `::backdrop` behind it. Everything else in
// the document sits behind that backdrop, at any z-index — the top layer is
// above the whole z-index stack by definition. So a modal rendered at the App
// root is invisible while the map is fullscreen, and only "appears" once you
// exit. Raising its z-index cannot fix that; the overlay has to live INSIDE the
// fullscreen element's own subtree.
//
// `useOverlayHost` returns that subtree when something is fullscreen, and
// <body> otherwise — which is exactly where these modals rendered before, so
// the non-fullscreen and CSS-fallback-fullscreen cases are unchanged (the CSS
// fallback in MapTracker is an ordinary in-page element, not a top-layer one,
// and a z-index above it is enough).

import { useEffect, useState } from 'react';

const currentHost = () =>
  document.fullscreenElement || document.webkitFullscreenElement || document.body;

export function useOverlayHost() {
  const [host, setHost] = useState(currentHost);

  useEffect(() => {
    const sync = () => setHost(currentHost());
    // Fullscreen may have changed between render and this effect running.
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  return host;
}
