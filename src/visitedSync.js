// visitedSync.js — the pure decision logic guarding a user's visited list.
//
// Extracted from `src/store.js` after a bug wiped a live account: the sign-in
// snapshot handler treated a cache-only "document does not exist" event as a
// first sign-in and merged `visitedCount: 0` / `visitedPlaces: []` over real
// data. The rules below are the ones that must never regress, so they live here
// — dependency-free and unit-tested — rather than inline in a Firebase callback.
//
// The invariant every function serves: NEVER persist anything derived from a
// visited list we have not actually read from the server.

/**
 * May we initialize a user's documents as a brand-new account?
 *
 * Only when the SERVER says the doc is absent. `onSnapshot` raises an event
 * from the local cache before the server answers, and with nothing cached the
 * SDK reports the document as non-existent with `metadata.fromCache === true` —
 * indistinguishable from a real new account unless you check that flag.
 */
export function shouldInitializeUserDocs({ exists, fromCache, deletingAccount }) {
  if (exists) return false;
  if (fromCache) return false; // unproven absence — never write on this
  if (deletingAccount) return false; // would resurrect the doc being deleted
  return true;
}

/**
 * Is a private-doc snapshot authoritative enough to become local state?
 *
 * A cached "not found" must not mark the list as loaded, or the empty
 * placeholder would look like the user's real (empty) list.
 */
export function isAuthoritativeVisitedSnapshot({ exists, fromCache }) {
  return exists || !fromCache;
}

/**
 * May a toggle be written back to Firestore?
 *
 * Requires a signed-in user AND a list already loaded from the server —
 * otherwise the write would persist a one-item list over everything they had.
 */
export function shouldPersistToggle({ hasUser, visitedLoaded }) {
  return !!hasUser && !!visitedLoaded;
}

/**
 * Combine a legacy public visited list with whatever the private doc holds.
 *
 * A union, never a replace: whichever copy is ahead, no place is dropped.
 */
export function mergeLegacyVisited(current, legacy) {
  return Array.from(new Set([...(current || []), ...(legacy || [])]));
}
