import { useState } from 'react';
import { API_URL, authHeaders } from '../config/api';

interface RagQueryRequest {
  question: string;
  scheme_id?: string | null;
  bbox?: [number, number, number, number] | null;
  max_citations?: number;
}

interface Citation {
  doc_id: string;
  type: string;
  snippet: string;
  /** Only ranking answers have a score; Copilot citations are records the tools read and have none. */
  score: number | null;
  timestamp: string | null;
  geo: { lat: number; lon: number } | null;
}

interface RagQueryResponse {
  answer: string;
  citations: Citation[];
  trace_id: string;
  cached: boolean;
  answerSource?: 'amazon-bedrock' | 'database-ranking';
  model?: { provider: string; modelId: string } | null;
  generatedAt?: string;
}

interface UseRagQueryResult {
  loading: boolean;
  error: string | null;
  data: RagQueryResponse | null;
  runQuery: (params: RagQueryRequest) => Promise<void>;
  reset: () => void;
}

function describeError(status: number, body: { error?: string; message?: string; code?: string; retryable?: boolean }) {
  if (status === 401) return 'Please sign in again to ask questions.';
  if (status === 429 && !body.code) return 'Too many questions. Please wait a minute and try again.';
  const message = body.error || body.message || `Server error (HTTP ${status}).`;
  return body.retryable ? `${message} You can try again shortly.` : message;
}

export default function useRagQuery(): UseRagQueryResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RagQueryResponse | null>(null);

  const runQuery = async (params: RagQueryRequest) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`${API_URL}/api/rag-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          question: params.question,
          scheme_id: params.scheme_id || null,
          bbox: params.bbox || null,
          max_citations: params.max_citations || 5,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(describeError(response.status, body));
      }

      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process query');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLoading(false);
    setError(null);
    setData(null);
  };

  return { loading, error, data, runQuery, reset };
}

export type { RagQueryRequest, RagQueryResponse, Citation };
