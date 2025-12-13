import { useCallback, useEffect, useRef } from 'react';

export default function useDesktopNotify() {
  const audioRef = useRef(null);
  const lastAtRef = useRef(0);
  const primedRef = useRef(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    audioRef.current = new Audio('/sounds/incoming.mp3');
  }, []);

  // کاربر یک بار کلیک کند تا صدا آزاد شود
  useEffect(() => {
    const prime = () => {
      if (primedRef.current) return;
      try {
        audioRef.current.muted = true;
        audioRef.current
          .play()
          .then(() => {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.muted = false;
            primedRef.current = true;
            // console.debug('[notify] audio primed');
          })
          .catch(() => {});
      } catch {}
    };
    window.addEventListener('click', prime, { once: true, capture: true });
    return () => window.removeEventListener('click', prime, { capture: true });
  }, []);

  /**
   * show(title, body, opts)
   * opts:
   *  - always: اگر true باشد حتی وقتی تب visible است هم Notification می‌سازد
   */
  const show = useCallback((title, body, opts = {}) => {
    const { always = false, onClick } = opts;
    try {
      const now = Date.now();
      if (now - lastAtRef.current < 800) return; // rate-limit
      lastAtRef.current = now;

      // صدا
      audioRef.current?.play().catch(() => {});

      // Notification دسکتاپ
      if (
        Notification?.permission === 'granted' &&
        (document.hidden || always)
      ) {
        const n = new Notification(title, { body });
        if (onClick) {
          n.onclick = (e) => {
            e.preventDefault();
            window.focus();
            onClick();
            n.close();
          };
        }
      }
    } catch {}
  }, []);

  return { show };
}
