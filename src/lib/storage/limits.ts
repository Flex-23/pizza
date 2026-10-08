/**
 * Largest body a server action will accept, mirroring
 * `experimental.serverActions.bodySizeLimit` in next.config.ts.
 *
 * Client-side only as a guard rail: a file over this never reaches the action,
 * it is rejected by the framework with an error the form cannot translate. The
 * real policy limit is MAX_UPLOAD_MB, enforced server-side in lib/storage.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
