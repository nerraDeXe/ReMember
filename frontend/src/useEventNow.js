import { useEffect, useState } from 'react';

export function useEventNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setNow(new Date()); };
    const timer = setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  return now;
}
