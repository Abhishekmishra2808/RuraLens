// Login 3 from Hirael <https://hirael.com/blocks/auth/login-03>
// MIT · Mohammad Shehadeh · https://github.com/MohammadShehadeh/hirael
// Adapted for Tailwind 3 (arbitrary sizes, HSL tokens) and framer-motion; content is passed in as props.

import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const ENTER =
  "animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-timing-function:cubic-bezier(0.22,1,0.36,1)] fill-mode-both motion-reduce:animate-none";

export const stagger = (index: number, step = 60): React.CSSProperties => ({
  animationDelay: `${index * step}ms`,
});

const jitter = (i: number) => {
  const value = Math.sin(i + 1) * 10_000;
  return value - Math.floor(value);
};

const FloatingPaths = ({ position }: { position: number }) => {
  const reduceMotion = useReducedMotion();
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full text-primary" fill="none" viewBox="0 0 696 316">
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            initial={{ pathLength: 0.3 }}
            animate={reduceMotion ? undefined : { pathLength: 1, pathOffset: [0, 1, 0] }}
            stroke="currentColor"
            className="opacity-60"
            strokeOpacity={0.1 + path.id * 0.03}
            strokeWidth={path.width}
            transition={{
              duration: 20 + jitter(path.id) * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
};

export interface Login03Props {
  /** Logo and product name, shown top-left (and above the form on small screens). */
  brand: React.ReactNode;
  /** Statement anchored to the bottom of the decorative side panel. */
  aside: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  /** Extra control in the top-right corner (e.g. language switch). */
  topRight?: React.ReactNode;
  children: React.ReactNode;
}

const Login03 = ({ brand, aside, onBack, backLabel = "Home", topRight, children }: Login03Props) => {
  return (
    <section
      data-slot="login"
      className="relative min-h-svh overflow-hidden bg-background text-foreground lg:grid lg:grid-cols-2"
    >
      <aside
        data-slot="login-aside"
        className="relative hidden h-full flex-col overflow-hidden border-e border-border bg-card p-10 lg:flex"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, transparent, transparent, hsl(var(--background)))",
          }}
        />

        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>

        <div className={cn(ENTER, "relative z-10")}>{brand}</div>

        <figure style={stagger(4)} className={cn(ENTER, "relative z-10 mt-auto flex flex-col gap-3")}>
          {aside}
        </figure>
      </aside>

      <div
        data-slot="login-main"
        className="relative flex min-h-svh flex-col justify-center px-8 py-24 lg:min-h-0"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-60">
          <div
            className="absolute end-0 top-0 h-[80rem] w-[35rem] -translate-y-[22rem] rounded-full"
            style={{
              background:
                "radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsl(var(--foreground) / 0.06) 0, hsl(var(--foreground) / 0.02) 50%, hsl(var(--foreground) / 0.01) 80%)",
            }}
          />
          <div
            className="absolute end-0 top-0 h-[80rem] w-60 translate-x-[5%] -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, hsl(var(--foreground) / 0.04) 0, hsl(var(--foreground) / 0.01) 80%, transparent 100%)",
            }}
          />
        </div>

        {onBack && (
          <Button variant="ghost" onClick={onBack} className={cn(ENTER, "absolute start-5 top-7 z-10 gap-1.5")}>
            <ChevronLeft className="size-4 rtl:rotate-180" />
            {backLabel}
          </Button>
        )}

        {topRight && <div className={cn(ENTER, "absolute end-5 top-7 z-10")}>{topRight}</div>}

        <div data-slot="login-panel" className="relative z-10 mx-auto w-full space-y-6 sm:max-w-sm">
          <div className={cn(ENTER, "lg:hidden")}>{brand}</div>
          {children}
        </div>
      </div>
    </section>
  );
};

export default Login03;
