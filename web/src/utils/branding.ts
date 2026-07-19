// ---------------------------------------------------------------------------
// BRANDING — make the browser tab + installed (PWA) home-screen app reflect the
// logged-in shop's OWN logo + name from Settings. This is how each user gets a
// different icon and app name: the favicon, the apple-touch-icon and a live
// web-app manifest are all rebuilt at runtime from their saved profile.
//
// Note: a packaged APK's launcher icon is fixed at build time and cannot change
// per user — per-user home-screen branding is delivered via "Add to Home
// Screen" / "Install app", which reads the manifest we generate here.
// ---------------------------------------------------------------------------
import type { Settings } from '../types/models';
import { APP_NAME } from '../config/constants';

// Fallback icon (the 🧾 emoji) as an SVG data URL, used until a logo is set.
const DEFAULT_ICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧾</text></svg>";

const THEME_COLOR = '#2563EB';

let lastManifestUrl: string | null = null;

function upsertLink(rel: string, attrs: Record<string, string> = {}): HTMLLinkElement {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
  return el;
}

function upsertMeta(name: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

// Apply the shop's logo + name to the tab, the home-screen icon and the
// installable web-app manifest. Safe to call repeatedly (e.g. after saving).
export function applyBranding(settings?: Settings | null): void {
  const shopName = settings?.shop_name?.trim() || APP_NAME;
  const icon = settings?.logo_url || DEFAULT_ICON;

  // Browser tab.
  document.title = shopName;
  upsertLink('icon', { href: icon });
  upsertLink('apple-touch-icon', { href: icon });
  upsertMeta('theme-color', THEME_COLOR);
  upsertMeta('apple-mobile-web-app-title', shopName);
  upsertMeta('apple-mobile-web-app-capable', 'yes');

  // Live web-app manifest → drives the "Add to Home Screen" icon + name.
  const manifest = {
    name: shopName,
    short_name: shopName.slice(0, 12),
    description: `${shopName} — billing & invoicing`,
    start_url: '.',
    scope: '.',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: THEME_COLOR,
    icons: [
      { src: icon, sizes: '192x192', type: iconMime(icon), purpose: 'any' },
      { src: icon, sizes: '512x512', type: iconMime(icon), purpose: 'any' },
      { src: icon, sizes: '512x512', type: iconMime(icon), purpose: 'maskable' },
    ],
  };

  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  const url = URL.createObjectURL(blob);
  upsertLink('manifest', { href: url });
  if (lastManifestUrl) URL.revokeObjectURL(lastManifestUrl);
  lastManifestUrl = url;
}

function iconMime(src: string): string {
  if (src.startsWith('data:image/png')) return 'image/png';
  if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')) return 'image/jpeg';
  if (src.startsWith('data:image/svg')) return 'image/svg+xml';
  if (src.endsWith('.png')) return 'image/png';
  if (src.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}
