/**
 * Small presentational primitives for the twin panel (light theme, zinc + brand).
 */
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SPRING_SNAPPY } from '@/lib/motion';
import { ASSET_TYPE_META } from './twinVisuals';
import type { DataProvenance, TwinAssetType } from '../../types/twin';

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{children}</h3>
      {action}
    </div>
  );
}

type Tone = 'neutral' | 'brand' | 'amber' | 'red';

const TONES: Record<Tone, string> = {
  neutral: 'border-zinc-200 bg-zinc-50 text-zinc-600',
  brand: 'border-brand-200 bg-brand-50 text-brand-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Callout({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs leading-snug ${TONES[tone]}`}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const PROVENANCE: Record<DataProvenance, { label: string; tone: Tone }> = {
  'synthetic-demo': { label: 'Sample data', tone: 'amber' },
  'user-added': { label: 'Added by you', tone: 'brand' },
  verified: { label: 'Verified', tone: 'brand' },
};

export function ProvenanceBadge({ provenance }: { provenance: DataProvenance }) {
  const p = PROVENANCE[provenance];
  return <Badge tone={p.tone}>{p.label}</Badge>;
}

export function StatusDot({ color, className = '' }: { color: string; className?: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`} style={{ background: color }} />;
}

export function AssetIcon({ type, size = 15, boxed = false }: { type: TwinAssetType; size?: number; boxed?: boolean }) {
  const Icon = ASSET_TYPE_META[type].icon;
  if (!boxed) return <Icon size={size} className="shrink-0 text-zinc-500" aria-hidden />;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700" aria-hidden>
      <Icon size={size} />
    </span>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400',
  secondary: 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-zinc-200 disabled:text-zinc-400',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:text-zinc-300',
};

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function IconButton({
  label,
  className = '',
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 ${
        active ? 'bg-zinc-100 text-zinc-900' : ''
      } ${className}`}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  label: string;
}) {
  const thumbId = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-zinc-100 p-0.5">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={selected}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`relative flex-1 rounded-md px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              selected ? 'font-medium text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {selected && (
              <motion.span
                layoutId={thumbId}
                transition={SPRING_SNAPPY}
                className="absolute inset-0 rounded-md bg-white shadow-sm"
                aria-hidden
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const inputClass =
  'h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none';
