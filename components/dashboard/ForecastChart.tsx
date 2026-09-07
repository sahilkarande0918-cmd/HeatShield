'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Point = {
  t: string;
  apparentC: number;
  humidity: number;
  worstRisk: number;
  medianRisk: number;
};

/**
 * The next 72 hours, as the worst cell against the median cell.
 *
 * The gap between the two lines is the entire argument: a citywide average
 * stays comfortable through an afternoon in which one block is in trouble.
 * Plotting only a city mean would hide exactly what this tool exists to find.
 */
export default function ForecastChart({
  city,
  tempOffset,
  hoursAhead,
  onPickHour,
}: {
  city: string;
  tempOffset: number;
  hoursAhead: number;
  onPickHour: (h: number) => void;
}) {
  const [series, setSeries] = useState<Point[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/forecast?city=${city}&tempOffset=${tempOffset}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setSeries(j.series);
        setError(null);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => ctrl.abort();
  }, [city, tempOffset]);

  if (error) {
    return <p className="mt-sm text-sm text-ink">Forecast trend unavailable: {error}</p>;
  }
  // Honest empty state — no placeholder shape pretending to be data.
  if (!series) {
    return <p className="mt-sm text-sm text-ink-3">Loading the 72-hour trend…</p>;
  }

  const data = series.map((p, i) => ({ ...p, hour: i }));

  return (
    <div className="mt-sm">
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -28 }}
          onClick={(e) => {
            const h = typeof e?.activeLabel === 'number' ? e.activeLabel : Number(e?.activeLabel);
            if (Number.isFinite(h)) onPickHour(Math.max(0, Math.min(72, h)));
          }}
        >
          <XAxis
            dataKey="hour"
            ticks={[0, 24, 48, 72]}
            tickFormatter={(h) => (h === 0 ? 'now' : `+${h}h`)}
            tick={{ fill: 'var(--color-ink-3)', fontSize: 10, fontFamily: 'var(--font-data)' }}
            axisLine={{ stroke: 'var(--color-hairline)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={{ fill: 'var(--color-ink-3)', fontSize: 10, fontFamily: 'var(--font-data)' }}
            axisLine={false}
            tickLine={false}
          />
          {/* The relief threshold is a reference, not a measurement, so it takes
              chrome grey rather than a colour off the heat ramp. */}
          <ReferenceLine y={60} stroke="var(--color-ink-3)" strokeDasharray="3 3" opacity={0.7} />
          <Area
            type="monotone"
            dataKey="worstRisk"
            stroke="var(--color-risk-4)"
            strokeWidth={1.5}
            fill="var(--color-risk-3)"
            fillOpacity={0.14}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="medianRisk"
            stroke="var(--color-ink-2)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <ReferenceLine x={hoursAhead} stroke="var(--color-ink)" strokeWidth={1} />
          <Tooltip
            cursor={{ stroke: 'var(--color-hairline)' }}
            contentStyle={{
              background: 'var(--color-paper)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 8,
              fontFamily: 'var(--font-data)',
              fontSize: 12,
            }}
            labelFormatter={(h) => (h === 0 ? 'now' : `+${h} hours`)}
            formatter={(v, k) => [
              Math.round(Number(v)),
              String(k) === 'worstRisk' ? 'worst cell' : 'median cell',
            ]}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="tabular flex flex-wrap gap-md text-xs text-ink-3">
        <Key color="var(--color-risk-4)">Worst cell</Key>
        <Key color="var(--color-ink-2)">Median cell</Key>
        <span>Dashed line: relief threshold</span>
      </div>
      <p className="mt-xs text-xs text-ink-3">Click the chart to jump to an hour.</p>
    </div>
  );
}

function Key({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2xs">
      <span className="h-[2px] w-[14px]" style={{ background: color }} />
      {children}
    </span>
  );
}
