// تست کاندیدهای WS و برگرداندن اولین URL سالم
export async function findWorkingWS(candidates, token, timeoutMs = 2000) {
  // توکن را به Query اضافه می‌کنیم (هر دو بک‌اند از query می‌خوانند)
  const makeUrl = (base) => {
    if (!base) return null;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}token=${encodeURIComponent(token || '')}`;
  };

  for (const base of candidates) {
    const url = makeUrl(base);
    if (!url) continue;
    const ok = await probeWS(url, timeoutMs);
    if (ok) return url;
  }
  return null;
}

function probeWS(url, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try {
          ws.close();
        } catch {}
        resolve(false);
      }, timeoutMs);

      ws.onopen = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          ws.close();
        } catch {}
        resolve(true);
      };
      ws.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          ws.close();
        } catch {}
        resolve(false);
      };
      ws.onclose = () => {
        /* نادیده بگیر */
      };
    } catch {
      resolve(false);
    }
  });
}
