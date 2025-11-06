// src/components/BackendPicker.jsx
import React from 'react';

// سعی کن از choice بگیری؛ اگر نبود، از fallback استفاده می‌کنیم
let BACKENDS_FALLBACK = ['laravel', 'django', 'reverb'];
try {
  // import در CRA اگر فایل وجود داشته باشد ولی export نداشته باشد، خطا می‌دهد
  // پس این بلوک را امن نگه می‌داریم.
  // eslint-disable-next-line global-require, import/no-unresolved, @typescript-eslint/no-var-requires
  const choice = require('../backend/choice');
  if (choice?.BACKENDS && Array.isArray(choice.BACKENDS)) {
    BACKENDS_FALLBACK = choice.BACKENDS;
  }
} catch {
  // بی‌خیال؛ از fallback استفاده کن
}

export default function BackendPicker({ value, onChange, options }) {
  const opts = options && options.length ? options : BACKENDS_FALLBACK;

  return (
    <div
      style={{
        padding: '8px 12px',
        background: '#0d6efd10',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <strong style={{ fontSize: 12 }}>Backend:</strong>
      <select
        value={value}
        onChange={onChange}
        style={{ fontSize: 12, padding: '4px 6px' }}
      >
        {opts.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <span style={{ fontSize: 12, opacity: 0.7 }}>
        (با تغییر، صفحه ری‌لود می‌شود)
      </span>
    </div>
  );
}
