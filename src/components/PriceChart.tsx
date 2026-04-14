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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const container = containerRef.current;
      if (!container) return;
      if (container.contains(event.target as Node)) return;
      setSelectedIndex(null);
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
    suppressNextClickRef.current = false;
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    const start = touchStartRef.current;
    if (!touch || !start) return;

    const deltaX = Math.abs(touch.clientX - start.x);
    const deltaY = Math.abs(touch.clientY - start.y);

    if (deltaX > 8 || deltaY > 8) {
      suppressNextClickRef.current = true;
      setSelectedIndex(null);
    }
  }

  function handleTouchEnd() {
    touchStartRef.current = null;
  }

  function handleChartClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!suppressNextClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    suppressNextClickRef.current = false;
  }

  function handleChartSelect(nextState: { activeTooltipIndex: number | string | null | undefined }) {
    const nextIndex = nextState.activeTooltipIndex;
    if (nextIndex === undefined || nextIndex === null) {
      setSelectedIndex(null);
      return;
    }

    const parsed = typeof nextIndex === 'number' ? nextIndex : Number(nextIndex);
    if (Number.isNaN(parsed)) {
      setSelectedIndex(null);
      return;
    }

    setSelectedIndex(parsed);
  }

  return (
    <div
      ref={containerRef}
      className="price-chart"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClickCapture={handleChartClickCapture}
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
          onClick={handleChartSelect}
        >
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
            active={selectedIndex !== null}
            defaultIndex={selectedIndex ?? undefined}
            trigger="hover"
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
            activeDot={selectedIndex !== null ? { r: 4 } : false}
          />
          <Line
            type="monotone"
            dataKey="NO"
            stroke="var(--no-color)"
            strokeWidth={2}
            dot={false}
            activeDot={selectedIndex !== null ? { r: 4 } : false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
