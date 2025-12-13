// src/hooks/useOpenOrCreatePrivateRoom.js
import { useCallback, useState } from 'react';
import axios from 'axios';

export default function useOpenOrCreatePrivateRoom({
  endpoints,
  effectiveKind,
  accessToken,
  handleSelectChat,
}) {
  const [pending, setPending] = useState(false);
  const [lastError, setLastError] = useState(null);

  const openOrCreate = useCallback(
    async (recipientId, content = 'Hi! useOpen') => {
      setLastError(null);

      // 1) اعتبارسنجی ورودی
      const rid = Number(recipientId);
      if (!endpoints?.firstMessage) {
        const e = new Error('firstMessage endpoint تعریف نشده است.');
        setLastError(e);
        return null;
      }
      if (!accessToken) {
        const e = new Error('توکن احراز هویت وجود ندارد.');
        setLastError(e);
        return null;
      }
      if (!Number.isFinite(rid) || rid <= 0) {
        const e = new Error('شناسه‌ی کاربر مقصد نامعتبر است.');
        setLastError(e);
        return null;
      }

      try {
        setPending(true);

        const url = endpoints.firstMessage;

        const payload = { recipient_id: rid, content: String(content ?? '') };

        // لاگ دیباگ
        // eslint-disable-next-line no-console
        console.log('[DM REQUEST]', url, payload);

        const resp = await axios.post(url, payload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          // برای اطمینان در برخی پراکسی‌ها
          transformRequest: [
            (data, headers) => {
              if (!headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
              }
              return JSON.stringify(data);
            },
          ],
          validateStatus: (s) => s >= 200 && s < 500, // تا 422 را هم بگیریم و لاگ کنیم
        });

        // لاگ پاسخ
        console.log('[DM RESPONSE]', resp.status, resp.data);

        if (resp.status === 201 || resp.status === 200) {
          const roomId = resp?.data?.room?.id;
          if (roomId && typeof handleSelectChat === 'function') {
            handleSelectChat(roomId);
          }
          return resp.data ?? null;
        }

        // هندل خطاهای 4xx/5xx
        const status = resp.status;
        const apiMsg =
          resp?.data?.message ||
          resp?.data?.error ||
          (status === 401
            ? 'دسترسی غیرمجاز (توکن نامعتبر یا منقضی).'
            : status === 422
            ? (resp?.data?.errors &&
                Object.entries(resp.data.errors)
                  .map(
                    ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`,
                  )
                  .join(' | ')) ||
              'ورودی نامعتبر (recipient_id یا content).'
            : 'خطای داخلی سرور هنگام ایجاد/باز کردن DM.');

        console.error('[DM] FAIL', status, apiMsg, resp.data || {});
        setLastError(new Error(apiMsg || `HTTP ${status}`));
        return null;
      } catch (err) {
        console.error('[DM] EXCEPTION', err);
        setLastError(new Error('خطای غیرمنتظره هنگام ایجاد/باز کردن DM.'));
        return null;
      } finally {
        setPending(false);
      }
    },
    [endpoints?.firstMessage, accessToken, handleSelectChat],
  );

  return { openOrCreate, pending, lastError };
}
