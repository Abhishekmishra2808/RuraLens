// Based on "Random Letter Swap" from Fancy Components <https://www.fancycomponents.dev>
// MIT · Daniel Petho · https://github.com/danielpetho/fancy
// Adapted: framer-motion import, no lodash, reduced-motion support, word-level swap for Devanagari.

import { useRef } from "react";
import { motion, useAnimate, useReducedMotion, type AnimationOptions } from "framer-motion";

import { cn } from "@/lib/utils";

interface RandomLetterSwapProps {
  label: string;
  /** Letters roll down when true, up when false. */
  reverse?: boolean;
  transition?: AnimationOptions;
  staggerDuration?: number;
  className?: string;
  onClick?: () => void;
}

/** Devanagari letters combine into ligatures, so animate whole words instead of characters. */
function splitLabel(label: string): string[] {
  if (/[\u0900-\u097F]/.test(label)) return label.split(/(\s+)/).filter(Boolean);
  return Array.from(label);
}

export function RandomLetterSwap({
  label,
  reverse = true,
  transition = { type: "spring", duration: 0.8 },
  staggerDuration = 0.02,
  className,
  onClick,
}: RandomLetterSwapProps) {
  const [scope, animate] = useAnimate();
  const running = useRef(false);
  const reduceMotion = useReducedMotion();
  const parts = splitLabel(label);

  const onHoverStart = () => {
    if (running.current || reduceMotion) return;
    running.current = true;

    const order = parts.map((_, i) => i).sort(() => Math.random() - 0.5);
    const runs = order.map((index, step) => {
      const timing = { ...transition, delay: step * staggerDuration };
      return Promise.all([
        animate(`.swap-primary-${index}`, { y: reverse ? "100%" : "-100%" }, timing),
        animate(`.swap-secondary-${index}`, { top: "0%" }, timing),
      ]).then(() => {
        animate(`.swap-primary-${index}`, { y: 0 }, { duration: 0 });
        animate(`.swap-secondary-${index}`, { top: reverse ? "-100%" : "100%" }, { duration: 0 });
      });
    });

    void Promise.all(runs).finally(() => {
      running.current = false;
    });
  };

  return (
    <motion.span
      ref={scope}
      onHoverStart={onHoverStart}
      onClick={onClick}
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
    >
      <span className="sr-only">{label}</span>
      {parts.map((part, i) => (
        <span key={i} aria-hidden className="relative flex whitespace-pre">
          <motion.span className={`swap-primary-${i} relative`} style={{ top: 0 }}>
            {part}
          </motion.span>
          <motion.span className={`swap-secondary-${i} absolute`} style={{ top: reverse ? "-100%" : "100%" }}>
            {part}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

export default RandomLetterSwap;
