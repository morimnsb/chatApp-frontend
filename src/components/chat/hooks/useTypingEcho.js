import { useRef, useCallback } from 'react';
import useReverbEcho from '@/../../hooks/useReverbEcho';

/** هندلینگ تایپینگ برای Reverb/Echo + فالس‌سِیف ۵ ثانیه‌ای */
export default function useTypingEcho({
  enabled,
  accessToken,
  roomId,
  onPacket,
  onTypingChange,
}) {
  const typingTimeoutRef = useRef(null);

  const { whisperTyping } = useReverbEcho({
    effectiveKind: enabled ? 'reverb' : 'off',
    accessToken,
    roomId,
    onMessage: onPacket, // مستقیماً پاس بدهیم به handler اصلی
    onTyping: (userId, action) => {
      if (!userId) return;
      if (action === 'start') {
        onTypingChange(userId);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => onTypingChange(null), 5000);
      } else if (action === 'stop') {
        onTypingChange(null);
      }
    },
  });

  const emitTyping = useCallback(
    (userId) => {
      if (!enabled) return;
      whisperTyping(userId);
    },
    [enabled, whisperTyping],
  );

  return { emitTyping };
}

