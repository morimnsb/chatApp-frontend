// src/utils/formatTime.js
// ورودی می‌تواند string (ISO یا با فاصله)، number (ms یا seconds)، یا Date باشد.

function toDate(input) {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input) ? null : input;

  if (typeof input === 'number') {
    // اگر ثانیه بود (کوچکتر از 1e12)، به میلی‌ثانیه تبدیل کن
    const ms = input < 1e12 ? input * 1000 : input;
    const d = new Date(ms);
    return isNaN(d) ? null : d;
  }

  if (typeof input === 'string') {
    // "2025-11-04 12:30:00" -> "2025-11-04T12:30:00"
    const isoish = input.includes(' ') ? input.replace(' ', 'T') : input;
    let d = new Date(isoish);
    if (!isNaN(d)) return d;

    // اگر رشته عددی بود
    const asNum = Number(input);
    if (!Number.isNaN(asNum)) {
      const ms = asNum < 1e12 ? asNum * 1000 : asNum;
      d = new Date(ms);
      if (!isNaN(d)) return d;
    }
  }

  return null;
}

export function formatTime(input, opts = {}) {
  try {
    const d = toDate(input);
    if (!d) return ''; // یا '--' برگردون

    // نمایش ساده و قابل اعتماد
    // اگر امروز است فقط ساعت:دقیقه
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (sameDay) {
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // دیروز؟
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();

    if (isYesterday) {
      const t = d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `Yesterday ${t}`;
    }

    // تاریخ کوتاه + ساعت
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (err) {
    // برای اینکه کنسول پر از خطا نشه
    // console.warn('formatTime failed:', err, input);
    return '';
  }
}

export default formatTime;
