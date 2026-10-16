/** Time helpers for terminal-style timestamps. */

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 14:22:09 */
export function clockTs(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 14:22:09.481 */
export function clockMs(date = new Date()) {
  return `${clockTs(date)}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

/** 2026-10-15 14:22:09 */
export function stamp(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clockTs(date)}`;
}

/** Short display form for duration in ms. */
export function duration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
