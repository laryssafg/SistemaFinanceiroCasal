import React from 'react';
import { AlertTriangle, Inbox, RefreshCw, User } from 'lucide-react';

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label="Carregando dados">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-11 w-full rounded-lg bg-slate-100 dark:bg-slate-800/70 animate-pulse"
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-3">
        <Inbox className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-navy-950 dark:text-slate-100">
        {title}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Não foi possível carregar este módulo',
  description = 'Tente recarregar os dados novamente.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 rounded-xl">
      <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mb-2.5" />
      <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
        {title}
      </h3>
      <p className="text-xs text-red-700 dark:text-red-300 max-w-md mt-1 leading-relaxed">
        {description}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-900 dark:text-red-100 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function PartnerAvatar({
  src,
  name,
  size = 'md',
}: {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass =
    size === 'sm' ? 'w-7 h-7 text-[11px]' : size === 'lg' ? 'w-14 h-14 text-base' : 'w-9 h-9 text-xs';
  const trimmed = (name ?? '').trim();
  const initials = trimmed
    ? trimmed
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';
  const hasPhoto = Boolean(src && src.trim());

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 text-navy-900 dark:text-slate-200 flex items-center justify-center font-semibold border border-slate-200 dark:border-slate-700`}
    >
      {hasPhoto ? (
        <img
          src={src}
          alt={trimmed || 'Foto da titular'}
          className="w-full h-full object-cover"
        />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <User className={size === 'lg' ? 'w-6 h-6 text-slate-400' : 'w-4 h-4 text-slate-400'} />
      )}
    </div>
  );
}
