import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { API_URL } from '@/config/api';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';

const SLOW_REQUEST_MS = 2000;
// Free Render web services sleep after 15 idle minutes and take about a minute to wake: https://render.com/docs/free
const IS_RENDER_BACKEND = /\.onrender\.com/i.test(API_URL);

/** `slow` turns true once a request between `start()` and `stop()` has run longer than 2 seconds. */
export function useSlowRequest() {
  const [slow, setSlow] = useState(false);
  const timer = useRef<number>();

  const stop = useCallback(() => {
    window.clearTimeout(timer.current);
    setSlow(false);
  }, []);

  const start = useCallback(() => {
    window.clearTimeout(timer.current);
    setSlow(false);
    timer.current = window.setTimeout(() => setSlow(true), SLOW_REQUEST_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { slow, start, stop };
}

export function ServerWakeNotice({ className }: { className?: string }) {
  const { lang } = useLanguage();
  const tx = (en: string, hiText: string) => (lang === 'hi' ? hiText : en);

  return (
    <p
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600',
        className,
      )}
    >
      <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-zinc-500" />
      <span>
        <span className="font-medium text-zinc-900">
          {IS_RENDER_BACKEND
            ? tx('The server is waking up.', 'सर्वर चालू हो रहा है।')
            : tx('The server is taking longer than usual.', 'सर्वर सामान्य से अधिक समय ले रहा है।')}
        </span>{' '}
        {IS_RENDER_BACKEND
          ? tx(
              'The backend runs on a free Render instance that sleeps when idle, so the first sign-in can take about a minute.',
              'बैकएंड एक मुफ़्त Render इंस्टेंस पर चलता है जो निष्क्रिय होने पर सो जाता है, इसलिए पहले साइन इन में लगभग एक मिनट लग सकता है।',
            )
          : tx('Please keep this page open.', 'कृपया यह पेज खुला रखें।')}
      </span>
    </p>
  );
}
