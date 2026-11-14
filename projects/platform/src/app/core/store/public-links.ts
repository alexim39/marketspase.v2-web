import { environment } from '../../../environments/environment';

/**
 * One source of truth for public storefront links.
 *
 * Store pages (`/:username`, `/:username/product/:id`, `/lead/:username`) are
 * served by the store app, never by the platform dashboard. Building these
 * from `location.origin` or the platform host sends visitors to a 404.
 */
const trimBase = (value: string) => value.replace(/\/+$/, '');

/** Canonical public storefront origin. */
export const publicStoreBaseUrl = (): string => {
  const configured = String((environment as { storeUrl?: string }).storeUrl ?? '').trim();
  return trimBase(configured || 'https://store.marketspase.com');
};

/** Public storefront for a partner handle/slug. */
export const publicStorefrontUrl = (handle: string): string => {
  const slug = String(handle ?? '').trim();
  return slug ? `${publicStoreBaseUrl()}/${encodeURIComponent(slug)}` : publicStoreBaseUrl();
};

/** Public personal lead page for a username. */
export const publicLeadPageUrl = (username: string): string => {
  const handle = String(username ?? '').trim();
  return handle
    ? `${publicStoreBaseUrl()}/lead/${encodeURIComponent(handle)}`
    : publicStoreBaseUrl();
};
