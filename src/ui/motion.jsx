// Small reusable motion-graphics primitives used across screens.
import { useEffect, useRef } from 'react';
import { animate, motion, useSpring, useTransform } from 'framer-motion';

export const easeOutExpo = [0.16, 1, 0.3, 1];

// Number that rolls up from 0 to `value` once (stat screens).
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString(), delay = 0, duration = 1.2 }) {
  const ref = useRef(null);
  useEffect(() => {
    const controls = animate(0, value, {
      duration, delay, ease: easeOutExpo,
      onUpdate: (v) => { if (ref.current) ref.current.textContent = format(v); },
    });
    return () => controls.stop();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref}>{format(0)}</span>;
}

// Number that springs toward its latest value (live score).
export function SpringNumber({ value, format = (v) => Math.round(v).toLocaleString() }) {
  const mv = useSpring(value, { stiffness: 140, damping: 22 });
  const text = useTransform(mv, format);
  useEffect(() => { mv.set(value); }, [value, mv]);
  return <motion.span>{text}</motion.span>;
}

// Headline whose letters rise in one after another.
export function StaggerWord({ text, className, delay = 0, outlineFrom = Infinity }) {
  return (
    <span className={className} aria-label={text}>
      {[...text].map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className={i >= outlineFrom ? 'outline' : undefined}
          style={{ display: 'inline-block' }}
          initial={{ y: '55%', opacity: 0, rotateX: -70 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          transition={{ delay: delay + i * 0.055, duration: 0.7, ease: easeOutExpo }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  );
}

// Overlay wrapper with a clip-path wipe in and out.
export function Overlay({ children, className = '', ...rest }) {
  return (
    <motion.section
      className={`overlay ${className}`}
      initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
      exit={{ opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.55, ease: easeOutExpo }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: 0.25 + i * 0.07, duration: 0.5, ease: easeOutExpo } }),
};
