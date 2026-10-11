export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// Distance test between a moving point (segment) and a circle — stops fast bullets tunnelling through enemies.
export function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
  const vx = x1 - x0, vy = y1 - y0, len = vx * vx + vy * vy || 1;
  const t = clamp(((cx - x0) * vx + (cy - y0) * vy) / len, 0, 1);
  const px = x0 + vx * t - cx, py = y0 + vy * t - cy;
  return px * px + py * py < r * r;
}
