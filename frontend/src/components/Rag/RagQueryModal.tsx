import { useState } from 'react';
import { AlertCircle, Clock, FileText, Loader2, MapPin, Activity, MessageSquareWarning, ScrollText } from 'lucide-react';
import useRagQuery, { Citation } from '../../hooks/useRagQuery';
import { format } from 'date-fns';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

const MAX_VISIBLE_SOURCES = 2;
const MAX_LENGTH = 500;

interface RagQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  schemeId?: string | null;
  onHighlightCitation?: (citation: Citation) => void;
}

const CITATION_ICONS: Record<string, typeof FileText> = {
  'vendor-report': ScrollText,
  'government-scheme': FileText,
  'citizen-report': MessageSquareWarning,
  'sensor-event': Activity,
};

const CITATION_LABELS: Record<string, string> = {
  prediction: 'Impact prediction',
  asset: 'Twin asset',
  unknown: 'Record',
};

function citationTypeLabel(type: string) {
  if (CITATION_LABELS[type]) return CITATION_LABELS[type];
  const label = type.replace(/[-_]/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatGeneratedAt(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : format(date, 'MMM dd, yyyy, HH:mm');
}

export default function RagQueryModal({ isOpen, onClose, schemeId = null, onHighlightCitation }: RagQueryModalProps) {
  const [question, setQuestion] = useState('');
  const [limitToScheme, setLimitToScheme] = useState(!!schemeId);
  const { loading, error, data, runQuery, reset } = useRagQuery();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    await runQuery({
      question: question.trim(),
      scheme_id: limitToScheme && schemeId ? schemeId : null,
      bbox: null,
      max_citations: 5,
    });
  };

  const handleClose = () => {
    reset();
    setQuestion('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      title="Ask a question"
      description="Answers cite the scheme and report records the AI Copilot read to write them."
      onClose={handleClose}
      size="lg"
    >
      <div className="space-y-5 p-5 md:p-6">
        {!data && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="rag-question" className="sr-only">
              Your question
            </label>
            <textarea
              id="rag-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSubmit(e);
              }}
              placeholder="Why is Jal Jeevan Mission delayed? Which water schemes have open citizen reports?"
              rows={4}
              maxLength={MAX_LENGTH}
              disabled={loading}
              autoFocus
              className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none disabled:opacity-60"
            />

            {schemeId && (
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={limitToScheme}
                  onChange={(e) => setLimitToScheme(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
                />
                Only this scheme
              </label>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs tabular-nums text-zinc-400">
                {question.length}/{MAX_LENGTH}
              </span>
              <Button type="submit" disabled={loading || !question.trim()} className="gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Thinking' : 'Ask'}
              </Button>
            </div>
          </form>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-800">Could not get an answer</p>
              <p className="mt-0.5 text-sm text-red-700">{error}</p>
            </div>
            <button onClick={reset} className="text-sm font-medium text-red-700 hover:text-red-900">
              Try again
            </button>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Question</p>
              <p className="mt-1 text-[15px] font-medium text-zinc-900">{question}</p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Answer</p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800">{data.answer}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {data.answerSource === 'database-ranking'
                  ? 'Calculated from scheme records, not written by a language model'
                  : `Written by ${data.model?.modelId ?? 'the AI Copilot'} via Amazon Bedrock`}
                {formatGeneratedAt(data.generatedAt) && ` · generated ${formatGeneratedAt(data.generatedAt)}`}
                {data.cached && ' · saved answer, not regenerated for this request'}
              </p>
            </div>

            {data.citations && data.citations.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Sources · {Math.min(data.citations.length, MAX_VISIBLE_SOURCES)}
                </p>
                <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
                  {data.citations.slice(0, MAX_VISIBLE_SOURCES).map((citation, idx) => {
                    const Icon = CITATION_ICONS[citation.type] ?? FileText;
                    return (
                      <li key={idx} className="space-y-2 p-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Icon size={15} className="shrink-0 text-zinc-500" />
                          <span className="font-medium text-zinc-900">{citationTypeLabel(citation.type)}</span>
                          {typeof citation.score === 'number' && (
                            <span className="ml-auto text-xs tabular-nums text-zinc-500" title="Ranking score from scheme progress, status and budget use">
                              Score {citation.score.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="border-l-2 border-zinc-200 pl-3 text-sm leading-relaxed text-zinc-600">
                          {citation.snippet}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                          <span className="font-mono">{citation.doc_id}</span>
                          {citation.timestamp && (
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {format(new Date(citation.timestamp), 'MMM dd, yyyy')}
                            </span>
                          )}
                          {citation.geo && onHighlightCitation && (
                            <button
                              onClick={() => onHighlightCitation(citation)}
                              className="flex items-center gap-1 font-medium text-zinc-700 hover:text-zinc-900"
                            >
                              <MapPin size={12} />
                              Show on map
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-mono text-[11px] text-zinc-400" title="Trace ID">
                {data.trace_id}
              </span>
              <Button variant="outline" onClick={reset}>
                Ask another
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
