'use client';

import { useCallback, useState } from 'react';

type Result = {
  area: string;
  body: string;
  source: 'gemini' | 'template';
  cached: boolean;
};

/**
 * Drafts an advisory for one area on demand.
 *
 * Not fetched automatically: a ward officer asks for a draft, and generating
 * one for every cell a judge happens to click would be both slow and wasteful.
 * The result always says what wrote it and that a human should check it before
 * it goes anywhere.
 */
export default function AdvisoryPanel({
  city,
  cellId,
  at,
  tempOffset,
}: {
  city: string;
  cellId: number;
  at: Date | null;
  tempOffset: number;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const draft = useCallback(async () => {
    if (!at) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/advisory?city=${city}&cell=${cellId}&at=${encodeURIComponent(at.toISOString())}` +
          `&tempOffset=${tempOffset}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      setResult(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [city, cellId, at, tempOffset]);

  const copy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy — select the text and copy manually.');
    }
  }, [result]);

  return (
    <div className="border-t border-hairline pt-lg">
      {!result && (
        <>
          <button
            onClick={() => void draft()}
            disabled={busy || !at}
            className="rounded-pill bg-accent px-md py-2xs text-sm font-medium whitespace-nowrap text-accent-ink transition-transform duration-[var(--dur-fast)] ease-out hover:-translate-y-[1px] active:translate-y-[1px] disabled:opacity-50"
          >
            {busy ? 'Drafting…' : 'Draft an advisory for this area'}
          </button>
          <p className="mt-sm text-xs text-ink-3">
            Writes a short, plain-language notice a ward officer could forward to health workers.
          </p>
        </>
      )}

      {/* Chrome, not data: a failed request is not a heat risk. */}
      {error && <p className="mt-sm text-sm text-ink">{error}</p>}

      {result && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-sm">
            <p className="tabular text-xs uppercase tracking-[0.2em] text-ink-3">
              Advisory · {result.area}
            </p>
            <p className="tabular text-xs text-ink-3">
              {result.source === 'gemini' ? 'Drafted by Gemini' : 'Templated (no model)'}
              {result.cached ? ' · cached' : ''}
            </p>
          </div>

          <div className="mt-sm rounded-md border border-hairline bg-paper p-md">
            {result.body.split('\n\n').map((para, i) => (
              <p key={i} className={i > 0 ? 'mt-sm text-sm' : 'text-sm'}>
                {para}
              </p>
            ))}
          </div>

          <div className="mt-sm flex flex-wrap gap-xs">
            <button
              onClick={() => void copy()}
              className="tabular rounded-pill border border-hairline px-sm py-2xs text-xs uppercase tracking-[0.14em] text-ink-2 transition-colors duration-[var(--dur-fast)] hover:text-ink"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => {
                setResult(null);
                setError(null);
              }}
              className="tabular rounded-pill border border-hairline px-sm py-2xs text-xs uppercase tracking-[0.14em] text-ink-3 transition-colors duration-[var(--dur-fast)] hover:text-ink"
            >
              Clear
            </button>
          </div>

          <p className="mt-sm text-xs text-ink-3">
            Machine-drafted from this cell&rsquo;s numbers. Read it before sending it anywhere — it
            is not an official IMD warning.
          </p>
        </div>
      )}
    </div>
  );
}
