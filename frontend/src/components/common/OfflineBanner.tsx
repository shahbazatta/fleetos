import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Subtle, non-intrusive PWA offline indicator. Slides up from the bottom;
 *  theme-aware styling lives in .pwa-offline-banner (theme-tokens.css). */
export default function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (!offline) return null;
  return (
    <div className="pwa-offline-banner" role="status" aria-live="polite">
      <WifiOff size={15} />
      <span>{t('pwa.offline', 'You are offline — showing last known data')}</span>
    </div>
  );
}
