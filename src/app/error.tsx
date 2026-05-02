'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Auto-recover from ChunkLoadError by reloading the page
    // This happens when Turbopack cache is stale/corrupted
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to load chunk') ||
      error?.message?.includes('Loading CSS chunk');

    if (isChunkError) {
      console.warn('[GoalStream] ChunkLoadError detected, auto-reloading...', error.message);
      // Small delay to avoid infinite reload loop
      const timer = setTimeout(() => {
        window.location.reload();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-background">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <h2 className="text-lg font-bold mb-2">Erreur de chargement</h2>
      <p className="text-sm text-muted-foreground/60 mb-1 max-w-md">
        Une erreur s&apos;est produite lors du chargement. Réessayez ou rechargez la page.
      </p>
      {error.message && (
        <details className="mt-2 mb-4 text-left max-w-lg">
          <summary className="text-xs text-muted-foreground/40 cursor-pointer">Détails</summary>
          <pre className="mt-1 p-3 bg-muted/30 rounded-lg text-[10px] text-muted-foreground/50 overflow-auto max-h-32">
            {error.message}
          </pre>
        </details>
      )}
      <button
        onClick={() => window.location.reload()}
        className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Recharger la page
      </button>
    </div>
  );
}
