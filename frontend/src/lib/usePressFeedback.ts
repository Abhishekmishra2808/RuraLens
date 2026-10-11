import { useEffect } from 'react';

const PRESSABLE = 'button, [role="button"]';
const EASE_FLUID = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** Shrink by at most ~4px per side, so wide rows dip subtly and small icon buttons visibly. */
function pressedScale(el: HTMLElement) {
  const { width, height } = el.getBoundingClientRect();
  return 1 - Math.min(0.04, 8 / Math.max(width, height, 1));
}

function isPressable(el: HTMLElement) {
  return !(
    el.matches(':disabled, [aria-disabled="true"], [data-no-press]') ||
    el.className.toString().includes('active:scale')
  );
}

/**
 * App-wide press feedback: buttons shrink the moment the pointer goes down and spring back on
 * release, starting from whatever scale is on screen so a quick tap never jumps.
 * Animates the standalone CSS `scale` property through the Web Animations API, so it composes with
 * Tailwind transforms and leaves each button's own `transition-*` utilities alone.
 */
export function usePressFeedback(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const running = new WeakMap<HTMLElement, Animation>();
    let pressed: HTMLElement | null = null;

    const animateTo = (el: HTMLElement, to: number, duration: number) => {
      const from = parseFloat(getComputedStyle(el).scale);
      running.get(el)?.cancel();
      const animation = el.animate(
        { scale: [String(Number.isFinite(from) ? from : 1), String(to)] },
        { duration, easing: EASE_FLUID, fill: 'forwards' },
      );
      running.set(el, animation);
      if (to === 1) {
        animation.onfinish = () => {
          if (running.get(el) !== animation) return;
          animation.cancel();
          running.delete(el);
        };
      }
    };

    const release = () => {
      if (!pressed) return;
      animateTo(pressed, 1, 260);
      pressed = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || reducedMotion.matches) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(PRESSABLE);
      if (!el || !isPressable(el)) return;
      release();
      pressed = el;
      animateTo(el, pressedScale(el), 90);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', release);
    return () => {
      release();
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', release);
    };
  }, [enabled]);
}
