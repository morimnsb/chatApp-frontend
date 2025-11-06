// src/utils/pairKey.js
export function pairKey(a, b) {
  const s = [String(a), String(b)].sort(); // متقارن
  return `${s[0]}__${s[1]}`;
}
