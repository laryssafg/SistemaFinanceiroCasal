import React, { useState } from 'react';
import { Info, Lock, Unlock } from 'lucide-react';
import { EmptyState } from '../components/ui/FeedbackStates';
import {
  MetricBlock,
  PageHeader,
  SegmentedControl,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import {
  computeProportionalPercentages,
  getPartnerName,
  getPartnerShortName,
} from '../services/financeService';
import { formatBRL, formatDateBR, formatPercent } from '../utils/formatters';

export function DivisaoPage() {
  const {
    partners,
    sharedResponsibilities,
    proportionalHistory,
    setActivePage,
  } = useFinance();

  const partnerA = partners.find((p) => p.id === 'partner_a');
  const partnerB = partners.find((p) => p.id === 'partner_b');

  const incomeA = partnerA?.monthlyNetIncomeConfirmed ?? 0;
  const incomeB = partnerB?.monthlyNetIncomeConfirmed ?? 0;

  const [ruleMode, setRuleMode] = useState<'proportional' | 'manual'>('proportional');
  const [manualPartnerAPct, setManualPartnerAPct] = useState<number>(50);

  const computedSplit = computeProportionalPercentages(
    incomeA,
    incomeB,
    manualPartnerAPct,
    ruleMode === 'manual',
  );

  const hasIncomes = incomeA > 0 || incomeB > 0;
  const hasCalculatedPercentages =
    computedSplit.partnerAPercent !== null && computedSplit.partnerBPercent !== null;

  const totalSharedMonth = sharedResponsibilities.reduce(
    (s, item) => s + item.totalAmount,
    0,
  );
  const partnerAPaid = sharedResponsibilities
    .filter((i) => i.paidBy === 'partner_a')
    .reduce((s, i) => s + i.totalAmount, 0);
  const partnerBPaid = sharedResponsibilities
    .filter((i) => i.paidBy === 'partner_b')
    .reduce((s, i) => s + i.totalAmount, 0);

  const partnerAOwed =
    computedSplit.partnerAPercent !== null
      ? (totalSharedMonth * computedSplit.partnerAPercent) / 100
      : 0;
  const partnerBOwed =
    computedSplit.partnerBPercent !== null ? totalSharedMonth - partnerAOwed : 0;

  const partnerADiff = partnerAPaid - partnerAOwed;
  const partnerBDiff = partnerBPaid - partnerBOwed;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Divisão Proporcional de Despesas"
        subtitle="Proporcionalidade baseada na renda líquida recebida · Responsabilidades liquidadas preservadas e percentuais provisórios em mês aberto"
        actions={
          <SegmentedControl
            ariaLabel="Modo de cálculo da divisão"
            value={ruleMode}
            onChange={setRuleMode}
            options={[
              { value: 'proportional', label: 'Automática (Rendas)' },
              { value: 'manual', label: 'Divisão Manual (Sem Renda)' },
            ]}
          />
        }
      />

      <div className="flex items-start gap-3 p-4 rounded-xl bg-navy-50/70 dark:bg-navy-950/50 border border-navy-200/70 dark:border-navy-900 text-xs text-navy-900 dark:text-navy-200">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-navy-700 dark:text-navy-300" />
        <p className="leading-relaxed">
          <strong>Regras de divisão:</strong> Quando ambas possuem renda líquida, a divisão é proporcional; quando apenas uma possui renda, assume 100%; quando ambas estão sem renda, utiliza-se a divisão manual. No mês aberto, percentuais são provisórios e responsabilidades liquidadas por transferência permanecem preservadas.
        </p>
      </div>

      {ruleMode === 'manual' && !hasIncomes && (
        <SurfaceCard padding="sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-navy-950 dark:text-slate-100">
                Configuração Manual (Quando ambas estão sem renda)
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Defina manualmente o percentual para {getPartnerShortName(partners, 'partner_a')} e{' '}
                {getPartnerShortName(partners, 'partner_b')}.
              </p>
            </div>
            <div className="flex items-center gap-3 min-w-[240px]">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={manualPartnerAPct}
                onChange={(e) => setManualPartnerAPct(Number(e.target.value))}
                className="w-full accent-navy-800"
                aria-label="Percentual manual da Titular 1"
              />
              <span className="text-xs font-mono tabular-nums font-semibold shrink-0">
                {manualPartnerAPct}% / {100 - manualPartnerAPct}%
              </span>
            </div>
          </div>
        </SurfaceCard>
      )}

      {!hasIncomes && ruleMode === 'proportional' ? (
        <SurfaceCard padding="none">
          <EmptyState
            title="Cadastrem as receitas recebidas para visualizar a divisão proporcional."
            description="Nenhuma receita líquida confirmada foi registrada neste mês. O sistema não assume percentuais automáticos de 50% / 50% sem receitas cadastradas."
            actionLabel="Registrar Receita"
            onAction={() => setActivePage('movimentacoes')}
          />
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SurfaceCard className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                  {getPartnerName(partners, 'partner_a')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Renda líquida recebida: {formatBRL(incomeA)}
                </p>
              </div>
              <span className="text-2xl font-semibold font-mono tabular-nums text-navy-900 dark:text-navy-300">
                {hasCalculatedPercentages && computedSplit.partnerAPercent !== null
                  ? formatPercent(computedSplit.partnerAPercent, 2)
                  : 'Sem dados'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs">
              <MetricBlock label="Valor Devido" value={formatBRL(partnerAOwed)} />
              <MetricBlock label="Efetivamente Pago" value={formatBRL(partnerAPaid)} />
              <MetricBlock
                label={partnerADiff >= 0 ? 'Crédito a Receber' : 'Saldo a Pagar'}
                value={formatBRL(Math.abs(partnerADiff))}
                tone={
                  partnerADiff > 0 ? 'positive' : partnerADiff < 0 ? 'negative' : 'neutral'
                }
              />
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                  {getPartnerName(partners, 'partner_b')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Renda líquida recebida: {formatBRL(incomeB)}
                </p>
              </div>
              <span className="text-2xl font-semibold font-mono tabular-nums text-navy-700 dark:text-navy-300">
                {hasCalculatedPercentages && computedSplit.partnerBPercent !== null
                  ? formatPercent(computedSplit.partnerBPercent, 2)
                  : 'Sem dados'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs">
              <MetricBlock label="Valor Devido" value={formatBRL(partnerBOwed)} />
              <MetricBlock label="Efetivamente Pago" value={formatBRL(partnerBPaid)} />
              <MetricBlock
                label={partnerBDiff >= 0 ? 'Crédito a Receber' : 'Saldo a Pagar'}
                value={formatBRL(Math.abs(partnerBDiff))}
                tone={
                  partnerBDiff > 0 ? 'positive' : partnerBDiff < 0 ? 'negative' : 'neutral'
                }
              />
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* Lista de Despesas Compartilhadas */}
      <SurfaceCard padding="none">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
            Despesas Compartilhadas do Mês
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Itens já liquidados ficam travados (preservados); itens pendentes acompanham o percentual provisório do mês aberto
          </p>
        </div>
        {sharedResponsibilities.length === 0 ? (
          <EmptyState
            title="Nenhuma despesa compartilhada registrada."
            description="Quando despesas marcadas como compartilhadas forem lançadas, o rateio entre as titulares aparecerá aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Despesa Compartilhada</th>
                  <th className="py-3 px-4">Pago por</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Cota {getPartnerShortName(partners, 'partner_a')}</th>
                  <th className="py-3 px-4 text-right">Cota {getPartnerShortName(partners, 'partner_b')}</th>
                  <th className="py-3 px-4 text-right">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {sharedResponsibilities.map((item) => {
                  const isSettled = item.status === 'settled';
                  const aShare = isSettled
                    ? item.partnerAShare
                    : computedSplit.partnerAPercent !== null
                      ? (item.totalAmount * computedSplit.partnerAPercent) / 100
                      : 0;
                  const bShare = isSettled
                    ? item.partnerBShare
                    : computedSplit.partnerBPercent !== null
                      ? item.totalAmount - aShare
                      : 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-navy-950 dark:text-slate-100">
                          {item.description}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateBR(item.date)} · {item.category}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {getPartnerName(partners, item.paidBy)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-navy-950 dark:text-slate-100">
                        {formatBRL(item.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {hasCalculatedPercentages || isSettled ? formatBRL(aShare) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {hasCalculatedPercentages || isSettled ? formatBRL(bShare) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                            <Lock className="w-3 h-3" />
                            Liquidada (Preservada)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                            <Unlock className="w-3 h-3" />
                            Pendente (Provisório)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {/* Histórico mensal de percentuais */}
      <SurfaceCard padding="none">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
            Histórico Mensal de Percentuais
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Evolução da proporção aplicada nas competências encerradas e no mês aberto
          </p>
        </div>
        {proportionalHistory.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
            Nenhum histórico mensal registrado até o momento.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Competência</th>
                  <th className="py-3 px-4 text-right">Renda {getPartnerShortName(partners, 'partner_a')}</th>
                  <th className="py-3 px-4 text-right">Renda {getPartnerShortName(partners, 'partner_b')}</th>
                  <th className="py-3 px-4 text-right">Proporção</th>
                  <th className="py-3 px-4 text-right">Total Compartilhado</th>
                  <th className="py-3 px-4 text-right">Status do Mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {proportionalHistory.map((row) => (
                  <tr key={row.month} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-medium text-navy-950 dark:text-slate-100">
                      {row.month}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatBRL(row.partnerAIncome)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatBRL(row.partnerBIncome)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-navy-900 dark:text-navy-300">
                      {formatPercent(row.partnerAPercent, 2)} / {formatPercent(row.partnerBPercent, 2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatBRL(row.totalShared)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={
                          row.status === 'closed'
                            ? 'text-slate-600 dark:text-slate-400'
                            : 'text-amber-700 dark:text-amber-400 font-medium'
                        }
                      >
                        {row.status === 'closed' ? 'Fechado' : 'Aberto (Provisório)'}
                      </span>
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
