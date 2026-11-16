import React from 'react';

interface SurfaceCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function SurfaceCard({
  children,
  className = '',
  padding = 'md',
}: SurfaceCardProps) {
  const paddingClass =
    padding === 'none'
      ? ''
      : padding === 'sm'
        ? 'p-4'
        : padding === 'lg'
          ? 'p-6 sm:p-7'
          : 'p-5 sm:p-6';

  return (
    <section
      className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl transition-colors ${paddingClass} ${className}`}
    >
      {children}
    </section>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-navy-950 dark:text-slate-50 text-balance">
          {title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          {subtitle}
        </p>
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (val: T) => void;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Filtro',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200/70 dark:border-slate-700/60 overflow-x-auto max-w-full"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 ${
              active
                ? 'bg-white dark:bg-slate-900 text-navy-950 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface MetricBlockProps {
  label: string;
  value: string;
  meta?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning';
}

export function MetricBlock({
  label,
  value,
  meta,
  tone = 'neutral',
}: MetricBlockProps) {
  const valueColor =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-red-700 dark:text-red-400'
        : tone === 'warning'
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-navy-950 dark:text-slate-50';

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={`text-xl sm:text-2xl font-semibold tracking-tight font-mono tabular-nums ${valueColor}`}
      >
        {value}
      </p>
      {meta && (
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {meta}
        </p>
      )}
    </div>
  );
}
