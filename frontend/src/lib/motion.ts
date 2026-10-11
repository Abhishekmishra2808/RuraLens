import type { Transition } from 'framer-motion';

/**
 * Motion vocabulary for the signed-in app, after Apple's "Designing Fluid Interfaces" (WWDC18).
 * Springs are critically damped (`bounce: 0`): nothing here is flicked, so nothing should overshoot.
 * `visualDuration` plays the role of Apple's "response".
 * Docs: https://motion.dev/docs/react-transitions#spring
 */
export const SPRING: Transition = { type: 'spring', bounce: 0, visualDuration: 0.35 };

/** Small surfaces (menus, selection indicators) settle faster. */
export const SPRING_SNAPPY: Transition = { type: 'spring', bounce: 0, visualDuration: 0.25 };

/** Same curve as `.transition-fluid` in index.css, for CSS-driven layout changes. */
export const EASE_FLUID = [0.32, 0.72, 0, 1] as const;
