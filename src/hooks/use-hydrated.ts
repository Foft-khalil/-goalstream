'use client';

import { useSyncExternalStore } from 'react';

/**
 * Returns false during SSR and the very first client render,
 * then true after the component has mounted on the client.
 *
 * Useful to avoid hydration mismatches when a component uses
 * non-deterministic values (Date.now, Math.random, useId from
 * Radix primitives, etc.) that would differ between server and
 * client renders.
 *
 * Implemented with useSyncExternalStore (React 18+) — this is the
 * canonical, hydration-safe pattern: the server snapshot is `false`,
 * the client snapshot becomes `true` after the first commit, with
 * no setState-in-effect warning.
 *
 * Pattern:
 *   const hydrated = useHydrated();
 *   if (!hydrated) return <Placeholder />;
 *   return <RealComponent />;
 */

// A no-op subscribe (we never emit updates — the snapshot only changes once,
// from `false` on the server to `true` after mount).
const subscribe = () => () => {};

// Server snapshot is always `false`.
const getServerSnapshot = () => false;

// Client snapshot: returns `true` only after the module has been imported
// AND React has mounted — we use a flag set on first read.
let clientMounted = false;
const getClientSnapshot = () => {
  clientMounted = true;
  return true;
};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}
