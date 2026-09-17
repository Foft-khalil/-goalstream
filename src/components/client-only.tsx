'use client';

import { ReactNode } from 'react';
import { useHydrated } from '@/hooks/use-hydrated';

/**
 * Renders children only after the component has mounted on the client.
 * During SSR and the first client render, returns `fallback` instead
 * (defaults to null). Use this to wrap components that produce non-
 * deterministic HTML during SSR (e.g. Radix popovers/dialogs whose
 * auto-generated IDs differ between Turbopack SSR and CSR in dev).
 *
 * The fallback MUST have the same dimensions as the children to avoid
 * layout shift.
 */
export default function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const hydrated = useHydrated();
  return hydrated ? <>{children}</> : <>{fallback}</>;
}
