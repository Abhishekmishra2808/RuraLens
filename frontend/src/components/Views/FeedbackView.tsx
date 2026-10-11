import { useEffect, useState } from 'react';
import { Loader, Star } from 'lucide-react';
import type { GovernmentScheme } from '../../store/appStore';
import { API_URL } from '../../config/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

interface Feedback {
  id: string;
  schemeId: string;
  rating?: number;
  aiSummary?: string;
  concerns?: string[];
  sentiment?: string;
  categories?: string[];
  urgency?: string;
  isUrgent?: boolean;
  aiProcessed?: boolean;
  createdAt?: string;
}

const SENTIMENT_DOT: Record<string, string> = {
  Positive: 'bg-brand-500',
  Neutral: 'bg-zinc-400',
  Negative: 'bg-amber-500',
  Critical: 'bg-red-500',
};

const URGENCY_TONE: Record<string, string> = {
  Critical: 'font-medium text-red-600',
  High: 'text-red-600',
  Medium: 'text-amber-700',
  Low: 'text-zinc-600',
};

const dateOrDash = (value: unknown) =>
  typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

function topByFrequency(items: string[], limit = 3) {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([item]) => item);
}

function summarise(feedbacks: Feedback[]) {
  const sentimentCounts: Record<string, number> = {};
  const ratings = feedbacks.map((fb) => fb.rating).filter((r): r is number => typeof r === 'number');
  feedbacks.forEach((fb) => {
    if (fb.sentiment) sentimentCounts[fb.sentiment] = (sentimentCounts[fb.sentiment] ?? 0) + 1;
  });

  return {
    avgRating: ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null,
    dominantSentiment: Object.entries(sentimentCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null,
    sentimentBreakdown: sentimentCounts,
    topConcerns: topByFrequency(feedbacks.flatMap((fb) => fb.concerns ?? [])),
    topCategories: topByFrequency(feedbacks.flatMap((fb) => fb.categories ?? [])),
    totalReviews: feedbacks.length,
  };
}

function SentimentLabel({ sentiment }: { sentiment: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-zinc-700">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SENTIMENT_DOT[sentiment] ?? 'bg-zinc-300'}`} aria-hidden />
      {sentiment}
    </span>
  );
}

/** Citizen reviews for one scheme: summary strip plus a table. Shared by the scheme details tab and the admin dialog. */
export function CitizenReviews({ scheme }: { scheme: GovernmentScheme }) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/schemes/${scheme.id}/feedback`);
      if (!response.ok) {
        throw new Error('Failed to fetch feedback');
      }
      const data = await response.json();
      setFeedbacks(data.feedback ?? []);
      setError(null);
    } catch (err) {
      console.error('Error fetching feedback:', err);
      setError('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [scheme.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
        <Loader size={15} className="animate-spin" />
        Loading reviews…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-sm">
        <p role="alert" className="text-red-600">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchFeedback}>
          Try again
        </Button>
      </div>
    );
  }

  if (feedbacks.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">No citizen reviews yet.</p>;
  }

  const summary = summarise(feedbacks);

  return (
    <div className="space-y-6 text-sm">
      <section className="space-y-3">
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200">
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-zinc-500">Average rating</dt>
            <dd className="mt-0.5 text-lg tabular-nums text-zinc-900">
              {summary.avgRating === null ? '—' : summary.avgRating.toFixed(1)}
              {summary.avgRating !== null && <span className="ml-1 text-xs text-zinc-500">/ 5</span>}
            </dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-zinc-500">Reviews</dt>
            <dd className="mt-0.5 text-lg tabular-nums text-zinc-900">{summary.totalReviews}</dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-zinc-500">Overall sentiment</dt>
            <dd className="mt-0.5 text-lg text-zinc-900">
              {summary.dominantSentiment ? <SentimentLabel sentiment={summary.dominantSentiment} /> : '—'}
            </dd>
          </div>
        </dl>

        <dl className="space-y-1.5">
          {Object.keys(summary.sentimentBreakdown).length > 0 && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-zinc-500">Distribution</dt>
              <dd className="text-zinc-700">
                {Object.entries(summary.sentimentBreakdown)
                  .map(([sentiment, count]) => `${sentiment} ${count}`)
                  .join(' · ')}
              </dd>
            </div>
          )}
          {summary.topConcerns.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-zinc-500">Common concerns</dt>
              <dd className="text-zinc-700">{summary.topConcerns.join('; ')}</dd>
            </div>
          )}
          {summary.topCategories.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-zinc-500">Key areas</dt>
              <dd className="text-zinc-700">{summary.topCategories.join(', ')}</dd>
            </div>
          )}
        </dl>

        <p className="text-xs text-zinc-500">
          Reviews are shown as AI-written summaries. Original comments and reviewer identities are not shown.
        </p>
      </section>

      <div className="-mx-5 overflow-x-auto md:-mx-6">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <th scope="col" className="px-5 py-2 font-medium md:px-6">Rating</th>
              <th scope="col" className="px-3 py-2 font-medium">Summary</th>
              <th scope="col" className="px-3 py-2 font-medium">Sentiment</th>
              <th scope="col" className="px-3 py-2 font-medium">Urgency</th>
              <th scope="col" className="px-5 py-2 text-right font-medium md:px-6">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {feedbacks.map((feedback, idx) => (
              <tr key={feedback.id ?? idx} className="align-top">
                <td className="whitespace-nowrap px-5 py-3 md:px-6">
                  {typeof feedback.rating === 'number' ? (
                    <span className="inline-flex items-center gap-1 tabular-nums text-zinc-900">
                      <Star size={13} className="fill-amber-400 text-amber-400" aria-hidden />
                      {feedback.rating}
                      <span className="text-zinc-400">/5</span>
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <p className="leading-relaxed text-zinc-900">{feedback.aiSummary || '—'}</p>
                  {feedback.concerns && feedback.concerns.length > 0 && (
                    <p className="mt-1 text-xs text-zinc-500">Concerns: {feedback.concerns.join('; ')}</p>
                  )}
                  {feedback.categories && feedback.categories.length > 0 && (
                    <p className="mt-0.5 text-xs text-zinc-500">{feedback.categories.join(' · ')}</p>
                  )}
                </td>
                <td className="px-3 py-3">
                  {feedback.sentiment ? <SentimentLabel sentiment={feedback.sentiment} /> : <span className="text-zinc-400">—</span>}
                </td>
                <td className={`whitespace-nowrap px-3 py-3 ${(feedback.urgency && URGENCY_TONE[feedback.urgency]) || 'text-zinc-500'}`}>
                  {feedback.urgency || '—'}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-zinc-600 md:px-6">{dateOrDash(feedback.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FeedbackView({ scheme, onClose }: { scheme: GovernmentScheme; onClose: () => void }) {
  return (
    <Modal size="lg" title="Citizen feedback" description={scheme.name} onClose={onClose}>
      <div className="p-5 md:p-6">
        <CitizenReviews scheme={scheme} />
      </div>
    </Modal>
  );
}
