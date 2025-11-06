export const BACKENDS = ['laravel', 'django', 'reverb'];

const KEY = 'backendChoice';

export function getChosenBackend() {
  return localStorage.getItem(KEY);
}

export function setChosenBackend(value) {
  if (!BACKENDS.includes(value)) return;
  localStorage.setItem(KEY, value);
  // ری‌لود تا همه‌ی فایل‌ها مقدار جدید رو بخونند
  window.location.reload();
}
