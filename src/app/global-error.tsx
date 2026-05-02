'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GoalStream] Global error:', error);

    // Auto-recover from ChunkLoadError by reloading the page
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to load chunk') ||
      error?.message?.includes('Loading CSS chunk');

    if (isChunkError) {
      console.warn('[GoalStream] ChunkLoadError in global boundary, auto-reloading...', error.message);
      const timer = setTimeout(() => {
        window.location.reload();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <html lang="fr" className="dark">
      <body className="bg-background text-foreground antialiased">
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-lg font-bold mb-2">Une erreur est survenue</h2>
          <p className="text-sm text-muted-foreground/60 mb-1 max-w-md">
            GoalStream a rencontré un problème. La page va se recharger automatiquement.
          </p>
          {error.message && (
            <p className="text-xs text-muted-foreground/40 mb-4 max-w-sm">
              {error.message}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Recharger la page
          </button>
        </div>
      </body>
    </html>
  );
}
