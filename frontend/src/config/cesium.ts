/**
 * Cesium ion configuration. VITE_* values are compiled into the client bundle,
 * so the token is a public client credential: scope it to the required assets
 * and allowed domains in the Cesium ion dashboard. Never log it.
 */
const raw = import.meta.env.VITE_CESIUM_ION_TOKEN;
const trimmed = typeof raw === 'string' ? raw.trim() : '';

/** ion access tokens are JWTs: three base64url segments (header.payload.signature). */
function isJwtShaped(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p));
}

export type CesiumTokenStatus = 'ok' | 'missing' | 'malformed';

export const CESIUM_TOKEN_STATUS: CesiumTokenStatus = !trimmed ? 'missing' : isJwtShaped(trimmed) ? 'ok' : 'malformed';

/** Only a well-formed token is passed to Cesium; a malformed one would just fail every ion request. */
export const CESIUM_ION_TOKEN: string | undefined = CESIUM_TOKEN_STATUS === 'ok' ? trimmed : undefined;

export const HAS_CESIUM_TOKEN = CESIUM_TOKEN_STATUS === 'ok';
