import React, { useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { EmptyState } from '../components/ui/FeedbackStates';
import {
  PageHeader,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { getPartnerName } from '../services/financeService';
import { PartnerId } from '../types/finance';
import { formatDateTimeBR } from '../utils/formatters';

export function AuditoriaPage() {
  const { auditLogs, partners } = useFinance();
  const [actorFilter, setActorFilter] = useState<'all' | PartnerId | 'system'>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const modules = useMemo(
    () => Array.from(new Set(auditLogs.map((l) => l.module))).sort(),
    [auditLogs],
  );

  const filtered = useMemo(
    () =>
      auditLogs.filter((log) => {
        if (actorFilter !== 'all' && log.actorId !== actorFilter) return false;
        if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;
        return true;
      }),
    [auditLogs, actorFilter, moduleFilter],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico e Auditoria"
        subtitle="Registro cronológico de alterações financeiras, liquidações, retiradas da reserva e fechamentos mensais"
      />

      <SurfaceCard padding="sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            aria-label="Filtrar por responsável"
            value={actorFilter}
            onChange={(e) =>
              setActorFilter(e.target.value as 'all' | PartnerId | 'system')
            }
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="all">Todos os autores</option>
            <option value="partner_a">{getPartnerName(partners, 'partner_a')}</option>
            <option value="partner_b">{getPartnerName(partners, 'partner_b')}</option>
            <option value="system">Sistema (Automático)</option>
          </select>

          <select
            aria-label="Filtrar por módulo"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="all">Todos os módulos</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </SurfaceCard>

      <SurfaceCard padding="none">
        {auditLogs.length === 0 ? (
          <EmptyState
            title="Nenhuma atividade registrada."
            description="Alterações de perfil, lançamentos, liquidações de acertos, retiradas da reserva e fechamentos mensais serão registrados cronologicamente aqui."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhuma atividade encontrada neste filtro."
            description="Ajuste os filtros de autor ou módulo para visualizar os eventos registrados."
            actionLabel="Limpar filtros"
            onAction={() => {
              setActorFilter('all');
              setModuleFilter('all');
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Autor</th>
                  <th className="py-3 px-4">Módulo</th>
                  <th className="py-3 px-4">Ação e Detalhamento</th>
                  <th className="py-3 px-4 text-right">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTimeBR(log.timestamp)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-navy-950 dark:text-slate-100 whitespace-nowrap">
                      {getPartnerName(partners, log.actorId)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {log.module}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-navy-700 dark:text-navy-400 shrink-0" />
                        {log.action}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {log.details}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {log.ipOrOrigin}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
