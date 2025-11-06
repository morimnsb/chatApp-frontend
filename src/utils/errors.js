// src/utils/errors.js
export function toErrorMessage(err) {
  if (!err) return null;
  const status = err?.response?.status;
  const msg =
    err?.response?.data?.message || err?.message || 'Unexpected error';
  return status ? `${status} – ${msg}` : msg;
}
