import type { GovernmentScheme } from '../../store/appStore';

export type SchemeStatus = GovernmentScheme['status'];
export type PhaseStatus = GovernmentScheme['phases'][number]['status'];
type AnyStatus = SchemeStatus | PhaseStatus;

export const STATUS_META: Record<AnyStatus, { label: string; hi: string; dot: string }> = {
  'on-track': { label: 'On track', hi: 'समय पर', dot: 'bg-brand-500' },
  completed: { label: 'Completed', hi: 'पूर्ण', dot: 'bg-zinc-400' },
  delayed: { label: 'Delayed', hi: 'विलंबित', dot: 'bg-amber-500' },
  discrepant: { label: 'Discrepant', hi: 'विसंगति', dot: 'bg-red-500' },
  'not-started': { label: 'Not started', hi: 'शुरू नहीं हुई', dot: 'bg-zinc-300' },
};

export const BAR_COLOR: Record<AnyStatus, string> = {
  'on-track': 'bg-brand-500',
  completed: 'bg-zinc-400',
  delayed: 'bg-amber-500',
  discrepant: 'bg-red-500',
  'not-started': 'bg-zinc-300',
};

export function StatusLabel({ status, lang = 'en' }: { status: AnyStatus; lang?: 'en' | 'hi' }) {
  const meta = STATUS_META[status] ?? STATUS_META['not-started'];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-zinc-700">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
      {lang === 'hi' ? meta.hi : meta.label}
    </span>
  );
}

export function ProgressBar({ value, status, className = 'w-24' }: { value: number; status: AnyStatus; className?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`h-1.5 overflow-hidden rounded-full bg-zinc-100 ${className}`}>
        <div className={`h-full rounded-full ${BAR_COLOR[status]}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-9 text-right tabular-nums text-zinc-700">{value}%</span>
    </div>
  );
}
