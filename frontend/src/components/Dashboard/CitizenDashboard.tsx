import { useState } from 'react';
import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import { useAppStore, type GovernmentScheme } from '../../store/appStore';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { ProgressBar, StatusLabel } from '../Schemes/schemeUi';
import { SchemeFeedbackModal, hasStarted, ratedRecently } from '../Schemes/SchemeFeedbackModal';

const DAY_MS = 24 * 60 * 60 * 1000;

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
}

export default function CitizenDashboard() {
  const schemes = useAppStore((state) => state.schemes);
  const username = useAppStore((state) => state.username);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const setFocusedSchemeId = useAppStore((state) => state.setFocusedSchemeId);
  const { lang } = useLanguage();
  const tx = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const monthYear = (iso: string) => new Date(iso).toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  const dayMonth = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const [feedbackScheme, setFeedbackScheme] = useState<GovernmentScheme | null>(null);

  const now = Date.now();
  const ongoing = schemes
    .filter((s) => s.status !== 'completed' && hasStarted(s, now))
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  const behind = ongoing.filter((s) => s.status === 'delayed' || s.status === 'discrepant').length;
  const avgProgress = ongoing.length > 0 ? Math.round(ongoing.reduce((sum, s) => sum + s.overallProgress, 0) / ongoing.length) : null;
  const reviewCount = schemes.reduce((sum, s) => sum + (s.feedbackCount || 0), 0);
  const avgRating =
    reviewCount > 0 ? schemes.reduce((sum, s) => sum + (s.citizenRating || 0) * (s.feedbackCount || 0), 0) / reviewCount : null;
  const lastUpdated = schemes
    .map((s) => new Date(s.lastUpdated).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  const area = mostCommon(schemes.map((s) => s.area));

  const deadlines = schemes
    .flatMap((s) =>
      s.phases
        .filter((p) => p.status !== 'completed' && Number.isFinite(new Date(p.endDate).getTime()))
        .map((p) => ({ scheme: s, phase: p, due: new Date(p.endDate).getTime() })),
    )
    .sort((a, b) => a.due - b.due)
    .slice(0, 5);

  const openScheme = (scheme: GovernmentScheme) => {
    setFocusedSchemeId(scheme.id);
    setActiveView('schemes');
  };

  const stats = [
    {
      label: tx('Ongoing schemes', 'चल रही योजनाएं'),
      value: ongoing.length,
      hint: tx(`of ${schemes.length} tracked`, `कुल ${schemes.length} में से`),
    },
    {
      label: tx('Behind schedule', 'समय से पीछे'),
      value: behind,
      hint: tx('Delayed or flagged for issues', 'विलंबित या समस्या चिह्नित'),
      alert: behind > 0,
    },
    {
      label: tx('Average progress', 'औसत प्रगति'),
      value: avgProgress === null ? '—' : `${avgProgress}%`,
      hint: tx('Across ongoing schemes', 'चल रही योजनाओं में'),
    },
    {
      label: tx('Citizen rating', 'नागरिक रेटिंग'),
      value: avgRating === null ? '—' : avgRating.toFixed(1),
      suffix: avgRating === null ? undefined : '/ 5',
      hint: reviewCount > 0 ? tx(`From ${reviewCount} reviews`, `${reviewCount} समीक्षाओं से`) : tx('No reviews yet', 'अभी कोई समीक्षा नहीं'),
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-8 p-4 pb-24 md:p-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-zinc-600">{tx('Welcome back', 'फिर से स्वागत है')}</p>
            <h1 className="mt-0.5 text-2xl font-semibold text-zinc-900 md:text-[28px]">
              {area ? tx(`Public works in ${area}`, `${area} में सार्वजनिक कार्य`) : tx('Public works near you', 'आपके पास के सार्वजनिक कार्य')}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-600">
              {tx(
                'See how local projects are progressing and tell officials how the work is going.',
                'देखें कि स्थानीय परियोजनाएं कैसे आगे बढ़ रही हैं और अधिकारियों को बताएं कि काम कैसा चल रहा है।',
              )}
            </p>
          </div>
          <Button size="sm" className="shrink-0 gap-2" onClick={() => setActiveView('schemes')}>
            {tx('Browse all schemes', 'सभी योजनाएं देखें')}
            <ArrowRight size={15} />
          </Button>
        </header>

        <section aria-label={tx('Summary', 'सारांश')}>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white px-4 py-3.5 md:px-5">
                <dt className="text-sm text-zinc-600">{stat.label}</dt>
                <dd className={`mt-1 text-2xl font-semibold tabular-nums ${stat.alert ? 'text-amber-700' : 'text-zinc-900'}`}>
                  {stat.value}
                  {stat.suffix && <span className="ml-1 text-sm font-normal text-zinc-500">{stat.suffix}</span>}
                </dd>
                <dd className="mt-0.5 text-xs text-zinc-600">{stat.hint}</dd>
              </div>
            ))}
          </dl>
          {lastUpdated && (
            <p className="mt-2 text-xs text-zinc-500">
              {tx('From scheme records, last updated', 'योजना रिकॉर्ड से, अंतिम अपडेट')}{' '}
              {new Date(lastUpdated).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2" aria-labelledby="ongoing-heading">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="ongoing-heading" className="text-base font-semibold text-zinc-900">
                {tx('Ongoing projects', 'चल रही परियोजनाएं')}
              </h2>
              <button
                type="button"
                onClick={() => setActiveView('schemes')}
                className="rounded text-sm font-medium text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                {tx('View all', 'सभी देखें')}
              </button>
            </div>

            {ongoing.length === 0 ? (
              <p className="rounded-xl border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-600">
                {tx('No projects are under way right now.', 'अभी कोई परियोजना चल नहीं रही है।')}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {ongoing.slice(0, 5).map((scheme) => {
                  const rated = ratedRecently(scheme, username, now);
                  return (
                    <li key={scheme.id} className="flex items-center gap-2 pr-3 transition-colors hover:bg-zinc-50">
                      <button
                        type="button"
                        onClick={() => openScheme(scheme)}
                        data-no-press
                        className="group flex min-w-0 flex-1 items-center gap-4 py-3.5 pl-4 text-left focus-visible:bg-zinc-50 focus-visible:outline-none md:pl-5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-zinc-900 group-hover:underline group-hover:underline-offset-4">
                            {scheme.name}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-zinc-600">
                            <StatusLabel status={scheme.status} lang={lang} />
                            <span aria-hidden className="text-zinc-300">·</span>
                            {new Date(scheme.endDate).getTime() < now ? (
                              <span className="font-medium text-red-700">
                                {tx('Past due', 'समय सीमा पार')} · {monthYear(scheme.endDate)}
                              </span>
                            ) : (
                              <span>
                                {tx('Due', 'अंतिम तिथि')} {monthYear(scheme.endDate)}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="hidden shrink-0 text-sm sm:block">
                          <ProgressBar value={scheme.overallProgress} status={scheme.status} className="w-20" />
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-zinc-400 group-hover:text-zinc-600" aria-hidden />
                      </button>
                      {rated ? (
                        <span className="inline-flex w-[76px] shrink-0 items-center justify-center gap-1 text-xs text-zinc-600">
                          <Check size={13} aria-hidden />
                          {tx('Rated', 'रेट किया')}
                        </span>
                      ) : (
                        <Button variant="outline" size="sm" className="h-8 w-[76px] shrink-0 px-2.5" onClick={() => setFeedbackScheme(scheme)}>
                          {tx('Rate', 'रेट करें')}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="deadlines-heading">
            <h2 id="deadlines-heading" className="mb-3 text-base font-semibold text-zinc-900">
              {tx('Upcoming phase deadlines', 'आगामी चरण की समय-सीमाएं')}
            </h2>
            {deadlines.length === 0 ? (
              <p className="rounded-xl border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-600">
                {tx('No open phases.', 'कोई खुला चरण नहीं।')}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {deadlines.map(({ scheme, phase, due }) => {
                  const overdue = due < now;
                  const soon = !overdue && due - now < 30 * DAY_MS;
                  return (
                    <li key={`${scheme.id}-${phase.id}`}>
                      <button
                        type="button"
                        onClick={() => openScheme(scheme)}
                        data-no-press
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-900">{phase.name}</p>
                          <p className="mt-0.5 truncate text-xs text-zinc-600">{scheme.name}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-sm tabular-nums ${overdue ? 'font-medium text-red-600' : 'text-zinc-900'}`}>{dayMonth(phase.endDate)}</p>
                          <p className={`mt-0.5 text-xs ${overdue ? 'text-red-600' : soon ? 'text-amber-700' : 'text-zinc-600'}`}>
                            {overdue ? tx('Overdue', 'समय सीमा पार') : soon ? tx('Due soon', 'जल्द देय') : <StatusLabel status={phase.status} lang={lang} />}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {feedbackScheme && <SchemeFeedbackModal scheme={feedbackScheme} onClose={() => setFeedbackScheme(null)} />}
    </div>
  );
}
