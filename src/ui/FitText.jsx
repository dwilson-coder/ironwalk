// Keeps a headline on one line at every screen size.
// CSS sizes the text from its container width (cqi units); this component is the safety net:
// if the text still overflows (fallback font, old browser, very narrow screen) it shrinks the font to fit.
import { useLayoutEffect, useRef } from 'react';

export default function FitText({ as: Tag = 'span', className = '', children, ...rest }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement) return undefined;
    let frame = 0;
    const fit = () => {
      el.style.fontSize = ''; // back to the CSS size, then measure
      const avail = el.parentElement.clientWidth;
      const need = el.scrollWidth;
      if (avail > 0 && need > avail) {
        const px = parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = `${Math.floor(px * (avail / need) * 0.98)}px`;
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(el.parentElement);
    document.fonts?.ready.then(schedule);
    return () => { cancelAnimationFrame(frame); ro?.disconnect(); };
  }, []);

  return <Tag ref={ref} className={`fit-text ${className}`} {...rest}>{children}</Tag>;
}
