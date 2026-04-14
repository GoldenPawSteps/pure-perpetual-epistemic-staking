import { useEffect, useRef } from 'react';
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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);

  function clearActivePoint() {
    const container = containerRef.current;
    if (!container) return;

    const eventTargets = [
      container.querySelector('.recharts-surface'),
      container.querySelector('.recharts-wrapper'),
      container,
    ].filter((node): node is Element => node instanceof Element);

    for (const target of eventTargets) {
      target.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    }
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const container = containerRef.current;
      if (!container) return;
      if (container.contains(event.target as Node)) return;
      clearActivePoint();
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

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch) return;

    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchMovedRef.current = false;
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;

    const deltaX = Math.abs(touch.clientX - start.x);
    const deltaY = Math.abs(touch.clientY - start.y);

    if (deltaX > 8 || deltaY > 8) {
      touchMovedRef.current = true;
    }
  }

  function resetAfterScrollGesture() {
    if (!touchMovedRef.current) return;

    touchMovedRef.current = false;
    touchStartRef.current = null;
    clearActivePoint();
  }

  return (
    <div
      ref={containerRef}
      className="price-chart"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={resetAfterScrollGesture}
      onTouchCancel={resetAfterScrollGesture}
    >
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
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="NO"
            stroke="var(--no-color)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
