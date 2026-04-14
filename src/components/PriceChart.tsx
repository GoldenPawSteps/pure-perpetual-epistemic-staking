import { useEffect, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { PricePoint } from '../types';

interface Props {
  history: PricePoint[];
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PriceChart({ history }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [suppressTooltip, setSuppressTooltip] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const container = containerRef.current;
      if (!container) return;

      if (container.contains(event.target as Node)) {
        setSuppressTooltip(false);
        return;
      }

      setSuppressTooltip(true);
    }

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, []);

  if (history.length < 2) {
    return (
      <div className="chart-empty">
        <p>No price history yet. Make a trade to see price movement.</p>
      </div>
    );
  }

  const data = history.map(pt => ({
    YES: +pt.yesPrice.toFixed(4),
    NO: +pt.noPrice.toFixed(4),
    ts: pt.timestamp,
  }));

  return (
    <div ref={containerRef} className="price-chart">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            tickFormatter={formatTimestamp}
            minTickGap={32}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            tickFormatter={v => v.toFixed(2)}
          />
          <Tooltip
            active={suppressTooltip ? false : undefined}
            labelFormatter={(value) => formatTimestamp(Number(value))}
            formatter={(value) => {
              const num = typeof value === 'number' ? value : Number(value);
              return [num.toFixed(4), 'price'] as [string, string];
            }}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '13px', paddingTop: '8px' }}
          />
          <Line
            type="monotone"
            dataKey="YES"
            stroke="var(--yes-color)"
            strokeWidth={2}
            dot={false}
            activeDot={suppressTooltip ? false : { r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="NO"
            stroke="var(--no-color)"
            strokeWidth={2}
            dot={false}
            activeDot={suppressTooltip ? false : { r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
