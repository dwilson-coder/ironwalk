// Keyboard, mouse and touch input. `pressed(code)` is true only on the frame a key went down.
// Global hotkeys: P / Esc pause, M mini map, N mute.
export function createInput(canvas, { onPause, onMute, onMinimap } = {}) {
  const keys = {}, edge = {}, touch = {};
  const mouse = { x: innerWidth * 0.7, y: innerHeight * 0.45, L: false, R: false };

  const kd = (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && e.target === document.body) e.preventDefault();
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!keys[e.code]) edge[e.code] = true;
    keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyP' || e.code === 'Escape') onPause && onPause();
    if (e.code === 'KeyM') onMinimap && onMinimap();
    if (e.code === 'KeyN') onMute && onMute();
  };
  const ku = (e) => { keys[e.code] = false; };
  const blur = () => { for (const k in keys) keys[k] = false; mouse.L = mouse.R = false; };
  const pm = (e) => { if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; } };
  const pd = (e) => {
    if (e.pointerType !== 'mouse') return;
    if (e.button === 0) mouse.L = true;
    if (e.button === 2) { mouse.R = true; edge.rocket = true; }
  };
  const pu = (e) => { if (e.pointerType !== 'mouse') return; if (e.button === 0) mouse.L = false; if (e.button === 2) mouse.R = false; };
  const cm = (e) => e.preventDefault();

  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur);
  addEventListener('pointermove', pm); addEventListener('pointerup', pu);
  canvas.addEventListener('pointerdown', pd); canvas.addEventListener('contextmenu', cm);

  return {
    keys, mouse, touch, edge,
    key: (c) => !!keys[c],
    pressed: (c) => !!edge[c],
    // Called by on-screen touch buttons
    setTouch(name, down) { if (down && !touch[name]) edge['t_' + name] = true; touch[name] = down; },
    endFrame() { for (const k in edge) delete edge[k]; },
    releaseAll: blur,
    dispose() {
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur);
      removeEventListener('pointermove', pm); removeEventListener('pointerup', pu);
      canvas.removeEventListener('pointerdown', pd); canvas.removeEventListener('contextmenu', cm);
    },
  };
}
