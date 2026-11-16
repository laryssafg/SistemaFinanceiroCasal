import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Check, Info } from 'lucide-react';
import { EmptyState } from '../components/ui/FeedbackStates';
import {
  PageHeader,
  SegmentedControl,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { formatDateBR } from '../utils/formatters';

export function AlertasPage() {
  const { alerts, markAlertRead, setActivePage } = useFinance();
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');

  const filtered = alerts.filter((a) => {
    if (filter === 'unread' && a.read) return false;
    if (filter === 'critical' && a.severity !== 'critical') return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Alertas"
        subtitle="Monitoramento de limites de orçamento, vencimentos de faturas, acertos pendentes e metas"
        actions={
          <SegmentedControl
            ariaLabel="Filtrar alertas"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'unread', label: 'Não lidos' },
              { value: 'critical', label: 'Críticos' },
            ]}
          />
        }
      />

      <SurfaceCard padding="none">
        {alerts.length === 0 ? (
          <EmptyState
            title="Nenhum alerta registrado."
            description="Monitoramentos de orçamento, vencimentos de faturas, acertos pendentes e metas aparecerão aqui automaticamente conforme vocês utilizarem o sistema."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum alerta neste filtro"
            description="Todos os avisos correspondentes já foram revisados ou não há alertas críticos ativos."
            actionLabel="Ver todos os alertas"
            onAction={() => setFilter('all')}
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((al) => (
              <div
                key={al.id}
                className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  al.read ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {al.severity === 'info' ? (
                    <Info className="w-5 h-5 text-navy-600 dark:text-navy-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        al.severity === 'critical'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-navy-950 dark:text-slate-100">
                        {al.title}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">
                        · {formatDateBR(al.date)}
                      </span>
                      {!al.read && (
                        <span className="text-[11px] font-medium text-navy-700 dark:text-navy-300">
                          · Novo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                      {al.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!al.read && (
                    <button
                      type="button"
                      onClick={() => markAlertRead(al.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Marcar lido
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActivePage(al.module)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 rounded-lg"
                  >
                    Abrir módulo
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
