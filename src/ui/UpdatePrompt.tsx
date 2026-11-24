import { useEffect, useState } from 'react';

/**
 * Service-worker update flow: when a new version is installed we ask before reloading,
 * so the page never silently swaps code under an open session. Data lives in IndexedDB
 * and is migrated by the profile sanitizer, so updates never strand saved progress.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    let cancelled = false;
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return;
        const fn = registerSW({
          immediate: true,
          onNeedRefresh: () => setNeedRefresh(true),
          onOfflineReady: () => {
            setOfflineReady(true);
            window.setTimeout(() => setOfflineReady(false), 5000);
          },
        });
        setUpdateSW(() => fn);
      })
      .catch(() => {
        /* PWA unavailable (e.g. tests) */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="toast-region" role="status" aria-live="polite" style={{ bottom: 'calc(var(--nav-h) + var(--safe-b) + 70px)' }}>
      <div className="toast">
        <span className="grow">{needRefresh ? 'A new version of the Almanac is ready.' : 'The Almanac is ready to use offline. 🌙'}</span>
        {needRefresh && (
          <button type="button" onClick={() => updateSW?.(true)}>
            Update
          </button>
        )}
        <button type="button" onClick={() => (setNeedRefresh(false), setOfflineReady(false))}>
          {needRefresh ? 'Later' : 'OK'}
        </button>
      </div>
    </div>
  );
}
