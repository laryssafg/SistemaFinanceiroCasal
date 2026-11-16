import React, { useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { MonthlySeriesPoint } from '../../types/finance';
import { formatBRL, formatBRLCompact } from '../../utils/formatters';

function ChartEmptyPlaceholder({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}) {
  return (
    <div className="h-52 flex flex-col items-center justify-center text-center px-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
      <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500 mb-2" />
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
        {message}
      </p>
    </div>
  );
}

export function CashFlowBarChart({ data }: { data: MonthlySeriesPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <ChartEmptyPlaceholder
        icon={BarChart3}
        message="Sem dados financeiros suficientes para exibir o gráfico de receitas e despesas."
      />
    );
  }

  const maxValue = Math.max(
    ...data.flatMap((d) => [d.income, d.expenses]),
    1,
  );
  const chartHeight = 190;
  const chartWidth = 560;
  const paddingLeft = 56;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;
  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const stepWidth = usableWidth / data.length;
  const barWidth = Math.min(20, stepWidth * 0.28);

  const gridTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-500 inline-block" />
            Receitas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-navy-800 dark:bg-navy-400 inline-block" />
            Despesas
          </span>
        </div>
        {hoveredIdx !== null && data[hoveredIdx] ? (
          <div className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
            {data[hoveredIdx].month}: +{formatBRL(data[hoveredIdx].income)} · -
            {formatBRL(data[hoveredIdx].expenses)}
          </div>
        ) : (
          <div className="text-xs text-slate-400 dark:text-slate-500">
            Passe o cursor para detalhar
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-52 min-w-[380px]"
          role="img"
          aria-label="Gráfico de receitas e despesas mensais"
        >
          {gridTicks.map((ratio) => {
            const y = paddingTop + usableHeight * (1 - ratio);
            const val = maxValue * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={paddingLeft}
                  x2={chartWidth - paddingRight}
                  y1={y}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="1"
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
                >
                  {ratio === 0 ? '0' : formatBRLCompact(val).replace('R$ ', '')}
                </text>
              </g>
            );
          })}

          {data.map((point, idx) => {
            const centerX = paddingLeft + stepWidth * idx + stepWidth / 2;
            const incHeight = (point.income / maxValue) * usableHeight;
            const expHeight = (point.expenses / maxValue) * usableHeight;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={point.month}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <rect
                  x={centerX - stepWidth / 2}
                  y={paddingTop}
                  width={stepWidth}
                  height={usableHeight}
                  fill={isHovered ? 'rgba(15, 34, 62, 0.04)' : 'transparent'}
                  rx="4"
                />
                <rect
                  x={centerX - barWidth - 2}
                  y={paddingTop + usableHeight - incHeight}
                  width={barWidth}
                  height={incHeight}
                  rx="3"
                  className="fill-emerald-600 dark:fill-emerald-500 transition-opacity"
                  opacity={hoveredIdx !== null && !isHovered ? 0.55 : 1}
                />
                <rect
                  x={centerX + 2}
                  y={paddingTop + usableHeight - expHeight}
                  width={barWidth}
                  height={expHeight}
                  rx="3"
                  className="fill-navy-800 dark:fill-navy-400 transition-opacity"
                  opacity={hoveredIdx !== null && !isHovered ? 0.55 : 1}
                />
                <text
                  x={centerX}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  className={`text-[11px] font-medium ${
                    isHovered
                      ? 'fill-navy-950 dark:fill-white'
                      : 'fill-slate-500 dark:fill-slate-400'
                  }`}
                >
                  {point.month}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function PatrimonyEvolutionChart({
  data,
}: {
  data: MonthlySeriesPoint[];
  includeProjection?: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <ChartEmptyPlaceholder
        icon={TrendingUp}
        message="Sem séries históricas cadastradas. A evolução patrimonial será exibida após os primeiros registros."
      />
    );
  }

  const minValue = Math.min(...data.map((d) => d.netWorth)) * 0.9;
  const maxValue = Math.max(...data.map((d) => d.patrimony)) * 1.04;
  const range = Math.max(maxValue - minValue, 1);

  const chartHeight = 200;
  const chartWidth = 580;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 18;
  const paddingBottom = 28;
  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  const coords = data.map((d, i) => {
    const x =
      paddingLeft +
      (data.length === 1 ? usableWidth / 2 : (i / (data.length - 1)) * usableWidth);
    const yPat =
      paddingTop + usableHeight - ((d.patrimony - minValue) / range) * usableHeight;
    const yNet =
      paddingTop + usableHeight - ((d.netWorth - minValue) / range) * usableHeight;
    return { ...d, x, yPat, yNet };
  });

  const patRealPath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.yPat}`)
    .join(' ');
  const netRealPath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.yNet}`)
    .join(' ');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-navy-800 dark:bg-navy-400 inline-block" />
            Patrimônio Bruto
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-600 dark:bg-emerald-400 inline-block" />
            Patrimônio Líquido
          </span>
        </div>
        {hoveredIdx !== null && coords[hoveredIdx] ? (
          <div className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
            {coords[hoveredIdx].month}: Bruto {formatBRL(coords[hoveredIdx].patrimony)} · Líquido{' '}
            {formatBRL(coords[hoveredIdx].netWorth)}
          </div>
        ) : (
          <div className="text-xs text-slate-400 dark:text-slate-500">
            Sem dupla contagem de reserva
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-52 min-w-[400px]"
          role="img"
          aria-label="Evolução patrimonial do casal"
        >
          {[0, 0.33, 0.66, 1].map((r) => {
            const y = paddingTop + usableHeight * (1 - r);
            const val = minValue + range * r;
            return (
              <g key={r}>
                <line
                  x1={paddingLeft}
                  x2={chartWidth - paddingRight}
                  y1={y}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
                >
                  {formatBRLCompact(val).replace('R$ ', '')}
                </text>
              </g>
            );
          })}

          <path
            d={patRealPath}
            fill="none"
            className="stroke-navy-800 dark:stroke-navy-400"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d={netRealPath}
            fill="none"
            className="stroke-emerald-600 dark:stroke-emerald-400"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {coords.map((c, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g
                key={c.month}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <rect
                  x={c.x - 24}
                  y={paddingTop}
                  width={48}
                  height={usableHeight}
                  fill="transparent"
                />
                <circle
                  cx={c.x}
                  cy={c.yPat}
                  r={isHovered ? 5 : 3.5}
                  className="fill-navy-800 dark:fill-navy-400 stroke-white dark:stroke-slate-900"
                  strokeWidth="1.5"
                />
                <circle
                  cx={c.x}
                  cy={c.yNet}
                  r={isHovered ? 5 : 3.5}
                  className="fill-emerald-600 dark:fill-emerald-400 stroke-white dark:stroke-slate-900"
                  strokeWidth="1.5"
                />
                <text
                  x={c.x}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  className="text-[10px] font-medium fill-slate-600 dark:fill-slate-400"
                >
                  {c.month}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function HorizontalDistributionBar({
  segments,
}: {
  segments: { label: string; value: number; colorClass: string }[];
}) {
  if (segments.length === 0) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
        Sem dados cadastrados para distribuição.
      </p>
    );
  }

  const total = segments.reduce((s, item) => s + item.value, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
        {segments.map((seg) => {
          const pct = (seg.value / total) * 100;
          return (
            <div
              key={seg.label}
              style={{ width: `${pct}%` }}
              className={`${seg.colorClass} h-full border-r border-white/60 dark:border-slate-900/60 last:border-r-0`}
              title={`${seg.label}: ${formatBRL(seg.value)} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
        {segments.map((seg) => {
          const pct = (seg.value / total) * 100;
          return (
            <div
              key={seg.label}
              className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800/70"
            >
              <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 truncate">
                <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${seg.colorClass}`} />
                <span className="truncate">{seg.label}</span>
              </span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100 shrink-0">
                {formatBRL(seg.value)} ({pct.toFixed(1).replace('.', ',')}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
