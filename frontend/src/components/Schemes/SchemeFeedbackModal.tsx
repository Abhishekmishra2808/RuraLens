import { useState } from 'react';
import { Check, Flag, Loader, Star } from 'lucide-react';
import { useAppStore, type GovernmentScheme } from '../../store/appStore';
import { API_URL } from '../../config/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

const RATED_KEY = 'ruralens_rated_schemes';
/** The backend accepts one review per person per scheme every 21 days. */
const RATING_COOLDOWN_MS = 21 * 24 * 60 * 60 * 1000;

function readRated(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(RATED_KEY) || '{}');
  } catch {
    return {};
  }
}

function markRated(key: string, at = Date.now()) {
  try {
    localStorage.setItem(RATED_KEY, JSON.stringify({ ...readRated(), [key]: at }));
  } catch {
    // Storage unavailable; the backend still enforces the limit.
  }
}

const ratedKey = (schemeId: string, username: string | null) => `${username ?? 'anon'}:${schemeId}`;

/** True when this person rated the scheme from this browser within the backend's cooldown window. */
export function ratedRecently(scheme: GovernmentScheme, username: string | null, now = Date.now()) {
  const last = readRated()[ratedKey(scheme.id, username)];
  return typeof last === 'number' && now - last < RATING_COOLDOWN_MS;
}

/** Work must have started before citizens can rate it. */
export function hasStarted(scheme: GovernmentScheme, now = Date.now()) {
  const start = new Date(scheme.startDate).getTime();
  return !Number.isFinite(start) || start <= now;
}

export function canRateScheme(scheme: GovernmentScheme, username: string | null) {
  return hasStarted(scheme) && !ratedRecently(scheme, username);
}

const RATING_WORDS = {
  en: ['', 'Very dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied'],
  hi: ['', 'बहुत असंतुष्ट', 'असंतुष्ट', 'सामान्य', 'संतुष्ट', 'बहुत संतुष्ट'],
};

export function SchemeFeedbackModal({ scheme, onClose }: { scheme: GovernmentScheme; onClose: () => void }) {
  const username = useAppStore((state) => state.username);
  const fetchSchemes = useAppStore((state) => state.fetchSchemes);
  const { lang } = useLanguage();
  const tx = (en: string, hi: string) => (lang === 'hi' ? hi : en);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [state, setState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState('');

  const submit = async () => {
    if (!rating) return;
    setState('submitting');
    setError('');
    try {
      const userId = username || `anon-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const response = await fetch(`${API_URL}/api/schemes/${scheme.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined, isUrgent, userId }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.status === 429) {
        const nextAllowed = new Date(body.nextAllowedDate).getTime();
        markRated(ratedKey(scheme.id, username), Number.isFinite(nextAllowed) ? nextAllowed - RATING_COOLDOWN_MS : Date.now());
        setError(body.message || tx('You rated this scheme recently.', 'आपने हाल ही में इस योजना को रेट किया है।'));
        setState('idle');
        return;
      }
      if (!response.ok) {
        throw new Error(body.error || 'Failed to submit feedback');
      }

      markRated(ratedKey(scheme.id, username));
      setState('done');
      fetchSchemes().catch(() => {});
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError(tx('Could not send your feedback. Please try again.', 'फीडबैक नहीं भेजा जा सका। कृपया फिर से प्रयास करें।'));
      setState('idle');
    }
  };

  return (
    <Modal title={tx('Rate this scheme', 'इस योजना को रेट करें')} description={scheme.name} onClose={onClose}>
      <div className="p-5 md:p-6">
        {state === 'done' ? (
          <div className="flex flex-col items-center py-4 text-center" role="status">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Check size={20} />
            </span>
            <p className="mt-3 font-medium text-zinc-900">{tx('Thanks for your feedback', 'आपकी प्रतिक्रिया के लिए धन्यवाद')}</p>
            <p className="mt-1 max-w-xs text-sm text-zinc-600">
              {tx(
                'Your rating has been recorded. Officials see a summary of your comment, not your name.',
                'आपकी रेटिंग दर्ज हो गई है। अधिकारी आपकी टिप्पणी का सारांश देखते हैं, आपका नाम नहीं।',
              )}
            </p>
            <Button variant="outline" size="sm" className="mt-5" onClick={onClose}>
              {tx('Done', 'ठीक है')}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <fieldset className="text-center">
              <legend className="mx-auto text-sm text-zinc-700">{tx('How is the work progressing?', 'काम कैसा चल रहा है?')}</legend>
              <div className="mt-2 flex justify-center gap-1" role="radiogroup" aria-label={tx('Rating', 'रेटिंग')}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} / 5`}
                    onClick={() => setRating(star)}
                    className={`rounded-lg p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                      rating >= star ? 'text-amber-400' : 'text-zinc-300 hover:text-zinc-400'
                    }`}
                  >
                    <Star className={`h-8 w-8 ${rating >= star ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>
              <p className="mt-1 h-5 text-sm text-zinc-600">{RATING_WORDS[lang][rating]}</p>
            </fieldset>

            <div className="space-y-1.5">
              <label htmlFor="scheme-feedback-comment" className="text-sm font-medium text-zinc-900">
                {tx('Comments', 'टिप्पणी')} <span className="font-normal text-zinc-500">{tx('(optional)', '(वैकल्पिक)')}</span>
              </label>
              <textarea
                id="scheme-feedback-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={tx('What is working, and what is not?', 'क्या ठीक चल रहा है और क्या नहीं?')}
                rows={4}
                className="w-full resize-none rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 placeholder:text-zinc-500 transition-colors focus:border-zinc-500 focus:outline-none"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 p-3">
              <Flag size={16} className={isUrgent ? 'text-red-600' : 'text-zinc-500'} />
              <span className="flex-1">
                <span className="block text-sm font-medium text-zinc-900">{tx('Urgent', 'तत्काल')}</span>
                <span className="block text-xs text-zinc-600">{tx('Needs attention right away', 'तुरंत ध्यान देने की ज़रूरत है')}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isUrgent}
                onClick={() => setIsUrgent(!isUrgent)}
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                  isUrgent ? 'bg-red-500' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${isUrgent ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
            </label>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <Button onClick={submit} disabled={rating === 0 || state === 'submitting'} className="w-full gap-2">
              {state === 'submitting' && <Loader className="h-4 w-4 animate-spin" />}
              {state === 'submitting' ? tx('Sending…', 'भेजा जा रहा है…') : tx('Send feedback', 'फीडबैक भेजें')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
