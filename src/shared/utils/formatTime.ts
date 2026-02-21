// chatApp-frontend\src\shared\utils\formatTime.ts

type DateInput = string | number | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input == null) return null;

  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "number") {
    // اگر ثانیه بود (کوچکتر از 1e12)، به میلی‌ثانیه تبدیل کن
    const ms = input < 1e12 ? input * 1000 : input;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === "string") {
    // "2025-11-04 12:30:00" -> "2025-11-04T12:30:00"
    const isoish = input.includes(" ") ? input.replace(" ", "T") : input;

    let d = new Date(isoish);
    if (!isNaN(d.getTime())) return d;

    // اگر رشته عددی بود
    const asNum = Number(input);
    if (!Number.isNaN(asNum)) {
      const ms = asNum < 1e12 ? asNum * 1000 : asNum;
      d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

export function formatTime(
  input: DateInput,
  opts?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = toDate(input);
    if (!d) return "";

    const now = new Date();

    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (sameDay) {
      return d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        ...opts,
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();

    if (isYesterday) {
      const t = d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        ...opts,
      });
      return `Yesterday ${t}`;
    }

    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      ...opts,
    });
  } catch {
    return "";
  }
}

export default formatTime;