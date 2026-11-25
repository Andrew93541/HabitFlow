import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

function subscribeNetworkStatus(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getNetworkSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export default function OfflineBanner() {
  const isOnline = useSyncExternalStore(
    subscribeNetworkStatus,
    getNetworkSnapshot,
    () => true
  );

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="bg-amber-600 text-white text-xs sm:text-sm font-semibold px-4 py-2 text-center flex items-center justify-center gap-2"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        You appear to be offline. Changes cannot be saved until your connection returns.
      </span>
    </div>
  );
}
