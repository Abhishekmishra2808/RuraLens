import { useEffect, useId, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SPRING } from '@/lib/motion';

const SIZES = {
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

/**
 * Light dialog for the signed-in app: dimmed backdrop, white surface, title row with close.
 * Escape and backdrop click close it. Body scrolls inside; header and footer stay put.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  actions,
  size = 'md',
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra controls placed before the close button. */
  actions?: ReactNode;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[6vh] md:p-6 md:pt-[8vh]">
      <motion.div
        className="absolute inset-0 bg-zinc-950/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={SPRING}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={SPRING}
        className={cn(
          'surface-raised relative flex max-h-[86vh] w-full flex-col overflow-hidden rounded-2xl outline-none',
          SIZES[size],
          className,
        )}
      >
        <header className="flex shrink-0 items-start gap-4 border-b border-zinc-200/80 px-5 py-4 md:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
              {title}
            </h2>
            {description && <div className="mt-0.5 text-sm text-zinc-500">{description}</div>}
          </div>
          {actions}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="shrink-0 border-t border-zinc-200/80 px-5 py-3 md:px-6">{footer}</footer>}
      </motion.div>
    </div>
  );
}
