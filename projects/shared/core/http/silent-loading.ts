/**
 * Marks an HTTP request as background work (polling, prefetch) so the global
 * progress bar and the connection-status banner stay quiet.
 *
 * The header is stripped by the platform progress interceptor before the
 * request leaves the browser; consumers that only read it must leave it in
 * place for downstream interceptors.
 */
export const SILENT_LOADING_HEADER = 'X-Silent-Loading';
