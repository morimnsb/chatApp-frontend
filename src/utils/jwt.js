// src/utils/jwt.js
import { jwtDecode } from 'jwt-decode';

export const isJwt = (t) =>
  typeof t === 'string' &&
  /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(t);

export function decodeUserIdFromToken(token) {
  if (!isJwt(token)) return null;
  try {
    const dec = jwtDecode(token);
    return dec?.user_id ?? dec?.sub ?? null;
  } catch {
    return null;
  }
}
