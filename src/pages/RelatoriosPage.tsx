import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Info } from 'lucide-react';
import {
  CashFlowBarChart,
  HorizontalDistributionBar,
} from '../components/charts/FinanceCharts';
import { EmptyState } from '../components/ui/FeedbackStates';
import { Modal } from '../components/ui/Modal';
import {
  MetricBlock,
  PageHeader,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { getPartnerName, getPaymentMethodLabel } from '../services/financeService';
import { PartnerId } from '../types/finance';
import { formatBRL, formatDateBR, formatDateTimeBR, formatPercent } from '../utils/formatters';

type ReportModule =
  | 'receitas'
  | 'despesas'
  | 'categorias'
  | 'contas'
  | 'cartoes'
  | 'beneficios'
  | 'divisao'
  | 'acertos'
  | 'investimentos'
  | 'patrimonio'
  | 'dividas'
  | 'metas';

const REPORT_MODULES: { id: ReportModule; label: string }[] = [
  { id: 'receitas', label: 'Receitas' },
  { id: 'despesas', label: 'Despesas' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'contas', label: 'Contas' },
  { id: 'cartoes', label: 'Cartões' },
  { id: 'beneficios', label: 'Benefícios' },
  { id: 'divisao', label: 'Divisão Proporcional' },
  { id: 'acertos', label: 'Acertos' },
  { id: 'investimentos', label: 'Investimentos' },
  { id: 'patrimonio', label: 'Patrimônio' },
  { id: 'dividas', label: 'Dívidas' },
  { id: 'metas', label: 'Metas' },
];

export function RelatoriosPage() {
  const {
    transactions,
    accounts,
    cards,
    benefits,
    budgets,
    proportionalHistory,
    settlements,
    investments,
    debts,
    goals,
    partners,
    summary,
    monthlySeries,
    setActivePage,
  } = useFinance();

  const [selectedReport, setSelectedReport] = useState<ReportModule>('despesas');
  const [partnerFilter, setPartnerFilter] = useState<'all' | PartnerId>('all');
  const [includeBenefitsInConsumption, setIncludeBenefitsInConsumption] = useState(true);
  const [exportNoticeFormat, setExportNoticeFormat] = useState<string | null>(null);

  const filteredTx = useMemo(() => {
    return transactions.filter((t) => {
      if (partnerFilter !== 'all' && t.partnerId !== partnerFilter) return false;
      if (
        !includeBenefitsInConsumption &&
        (t.paymentMethod === 'vr' || t.paymentMethod === 'va')
      ) {
        return false;
      }
      return true;
    });
  }, [transactions, partnerFilter, includeBenefitsInConsumption]);

  const incomeTx = useMemo(
    () => filteredTx.filter((t) => t.type === 'income'),
    [filteredTx],
  );

  const expenseTx = useMemo(
    () => filteredTx.filter((t) => t.type === 'expense'),
    [filteredTx],
  );

  const filteredAccounts = useMemo(
    () => accounts.filter((a) => partnerFilter === 'all' || a.partnerId === partnerFilter),
    [accounts, partnerFilter],
  );

  const filteredCards = useMemo(
    () => cards.filter((c) => partnerFilter === 'all' || c.ownerId === partnerFilter),
    [cards, partnerFilter],
  );

  const filteredBenefits = useMemo(
    () => benefits.filter((b) => partnerFilter === 'all' || b.partnerId === partnerFilter),
    [benefits, partnerFilter],
  );

  const filteredInvestments = useMemo(
    () => investments.filter((i) => partnerFilter === 'all' || i.ownerId === partnerFilter),
    [investments, partnerFilter],
  );

  const hasPatrimonyData =
    accounts.length > 0 || investments.length > 0 || debts.length > 0 || cards.length > 0;

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of expenseTx) {
      map[tx.category] = (map[tx.category] ?? 0) + tx.amount;
    }
    const colors = [
      'bg-navy-900 dark:bg-navy-400',
      'bg-emerald-600 dark:bg-emerald-500',
      'bg-navy-500 dark:bg-navy-300',
      'bg-amber-600 dark:bg-amber-400',
      'bg-slate-500 dark:bg-slate-400',
    ];
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label,
        value,
        colorClass: colors[i % colors.length],
      }));
  }, [expenseTx]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Relatórios"
        subtitle="Análises consolidadas por domínio financeiro · Controles visuais de exportação preparados para integração backend"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setExportNoticeFormat('PDF')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={() => setExportNoticeFormat('Excel (.xlsx)')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar Excel
            </button>
            <button
              type="button"
              onClick={() => setExportNoticeFormat('Dados Estruturados (JSON/CSV)')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Dados Estruturados
            </button>
          </div>
        }
      />

      <SurfaceCard padding="sm" className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {REPORT_MODULES.map((mod) => {
            const active = mod.id === selectedReport;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setSelectedReport(mod.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-navy-900 text-white dark:bg-navy-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-navy-950 dark:hover:text-white'
                }`}
              >
                {mod.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-3">
            <label className="text-slate-500 dark:text-slate-400">Titular:</label>
            <select
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value as 'all' | PartnerId)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="all">Visão Conjunta (Casal)</option>
              <option value="partner_a">{getPartnerName(partners, 'partner_a')}</option>
              <option value="partner_b">{getPartnerName(partners, 'partner_b')}</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeBenefitsInConsumption}
              onChange={(e) => setIncludeBenefitsInConsumption(e.target.checked)}
              className="rounded border-slate-300"
            />
            Incluir consumo de VR/VA nos relatórios de despesas (sem duplicar)
          </label>
        </div>
      </SurfaceCard>

      {selectedReport === 'receitas' && (
        <SurfaceCard className="space-y-4">
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
            Relatório de Receitas Bancárias (Exclui créditos de VR/VA)
          </h2>
          {incomeTx.length === 0 ? (
            <EmptyState
              title="Ainda não existem dados suficientes para gerar relatórios."
              description="Cadastre receitas bancárias nas movimentações para consultar o demonstrativo de entradas."
              actionLabel="Ir para Movimentações"
              onAction={() => setActivePage('movimentacoes')}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <MetricBlock
                  label="Receitas Confirmadas"
                  value={formatBRL(summary.confirmedIncomeMonth)}
                  tone="positive"
                />
                <MetricBlock
                  label="Receitas Estimadas / Pendentes"
                  value={formatBRL(summary.estimatedIncomeMonth)}
                  tone="warning"
                />
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {incomeTx.map((tx) => (
                  <div key={tx.id} className="py-3 flex justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {tx.description}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatDateTimeBR(tx.date)} · {getPartnerName(partners, tx.partnerId)} ·{' '}
                        {tx.status === 'confirmed' ? 'Confirmado' : 'Estimado'}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatBRL(tx.amount, true)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SurfaceCard>
      )}

      {selectedReport === 'despesas' && (
        <div className="space-y-5">
          <SurfaceCard>
            <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-4">
              Fluxo Comparativo Mensal
            </h2>
            <CashFlowBarChart data={monthlySeries} />
          </SurfaceCard>
          <SurfaceCard>
            <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-3">
              Listagem Analítica de Despesas
            </h2>
            {expenseTx.length === 0 ? (
              <EmptyState
                title="Ainda não existem dados suficientes para gerar relatórios."
                description="Nenhuma despesa registrada até o momento para compor a listagem analítica."
                actionLabel="Registrar Movimentação"
                onAction={() => setActivePage('movimentacoes')}
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {expenseTx.map((tx) => (
                  <div key={tx.id} className="py-3 flex justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {tx.description}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatDateTimeBR(tx.date)} · {tx.category} ·{' '}
                        {getPaymentMethodLabel(tx.paymentMethod)} ·{' '}
                        {getPartnerName(partners, tx.partnerId)}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-red-700 dark:text-red-400 shrink-0">
                      {formatBRL(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      {selectedReport === 'categorias' && (
        <SurfaceCard className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
              Consumo por Categoria
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribuição das despesas confirmadas e comprometidas no período
            </p>
          </div>
          {categoryBreakdown.length === 0 && budgets.length === 0 ? (
            <EmptyState
              title="Ainda não existem dados suficientes para gerar relatórios."
              description="Cadastre categorias de orçamento e despesas para visualizar a distribuição por categoria."
              actionLabel="Ir para Orçamento"
              onAction={() => setActivePage('orcamento')}
            />
          ) : (
            <>
              <HorizontalDistributionBar segments={categoryBreakdown} />
              {budgets.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {budgets.map((b) => (
                    <div key={b.id} className="py-2.5 flex justify-between">
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {b.category}
                      </span>
                      <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        Realizado {formatBRL(b.spentConfirmed)} / Orçado {formatBRL(b.monthlyLimit)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </SurfaceCard>
      )}

      {selectedReport === 'contas' && (
        <SurfaceCard>
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-4">
            Posição por Conta Bancária (Sem VR/VA)
          </h2>
          {filteredAccounts.length === 0 ? (
            <EmptyState
              title="Ainda não existem dados suficientes para gerar relatórios."
              description="Nenhuma conta bancária cadastrada para o filtro selecionado."
              actionLabel="Cadastrar Conta"
              onAction={() => setActivePage('contas')}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredAccounts.map((acc) => (
                <div key={acc.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {acc.institution} — {acc.accountName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Titular: {getPartnerName(partners, acc.partnerId)} · Abertura:{' '}
                      {formatBRL(acc.openingBalance)}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-navy-950 dark:text-white">
                    {formatBRL(acc.currentBalance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      )}

      {selectedReport === 'cartoes' && (
        <SurfaceCard>
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-4">
            Resumo de Faturas e Limites de Cartões
          </h2>
          {filteredCards.length === 0 ? (
            <EmptyState
              title="Ainda não existem dados suficientes para gerar relatórios."
              description="Nenhum cartão de crédito cadastrado até o momento."
              actionLabel="Cadastrar Cartão"
              onAction={() => setActivePage('cartoes')}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredCards.map((c) => (
                <div key={c.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {c.name} (Final {c.lastFourDigits})
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Limite: {formatBRL(c.creditLimit)} · Vencimento dia {c.dueDay}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-navy-950 dark:text-white">
                    Fatura: {formatBRL(c.currentInvoiceAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      )}

      {selectedReport === 'beneficios' && (
        <SurfaceCard>
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-4">
            Relatório Independente de Benefícios VR e VA
          </h2>
          {filteredBenefits.length === 0 ? (
            <EmptyState
              title="Ainda não existem dados suficientes para gerar relatórios."
              description="Nenhum benefício VR/VA cadastrado para gerar o demonstrativo independente."
              actionLabel="Ir para Benefícios"
              onAction={() => setActivePage('beneficios')}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredBenefits.map((b) => (
                <div key={b.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {b.providerName} ({b.type})
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Titular: {getPartnerName(partners, b.partnerId)} · Crédito:{' '}
                      {formatBRL(b.monthlyCredit)} · Gasto: {formatBRL(b.spentThisMonth)}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    Saldo: {formatBRL(b.currentBalance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      )}

      {selectedReport === 'divisao' && (
        <SurfaceCard>
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-4">
            Série Histórica de Divisão Proporcional
          </h2>
          {proportionalHistory.length === 0 ? (
            <EmptyState
              title="Ainda não existem dados suficientes para gerar relatórios."
              description="O histórico mensal de divisão proporcional será exibido conforme as competências forem consolidadas."
              actionLabel="Ir para Divisão Proporcional"
              onAction={() => setActivePage('divisao')}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {proportionalHistory.map((h) => (
                <div key={h.month} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{h.month}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Proporção: {formatPercent(h.partnerAPercent, 2)} /{' '}
                      {formatPercent(h.partnerBPercent, 2)}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-navy-950 dark:text-white">
                    {formatBRL(h.totalShared)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      )}

      {selectedReport === 'acertos' && (
        <SurfaceCard>
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-4">
            Relatório de Acertos entre o Casal
          </h2>
          {settlements.length === 0 ? (
            <EmptyState
              title="Ainda não existem dados suficientes para gerar relatórios."
              description="Nenhum acerto entre o casal registrado até o momento."
              actionLabel="Ir para Acertos"
              onAction={() => setActivePage('acertos')}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {settlements.map((s) => (
                <div key={s.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {s.referenceMonth} · {getPartnerName(partners, s.fromPartnerId)} →{' '}
                      {getPartnerName(partners, s.toPartnerId)}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {s.status === 'settled'
                        ? `Liquidado em ${formatDateBR(s.settledDate ?? '')}`
                        : 'Pendente de transferência'}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-navy-950 dark:text-white">
                    {formatBRL(s.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      )}

      {selectedReport === 'investimentos' && (
        <SurfaceCard>
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-4">
            Relatório de Carteira de Investimentos
          </h2>
          {filteredInvestments.length === 0 ? (
            <EmptyState
              title="Ainda não existem dados suficientes para gerar relatórios."
              description="Nenhum ativo de investimento cadastrado para análise de carteira."
              actionLabel="Cadastrar Investimento"
              onAction={() => setActivePage('investimentos')}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredInvestments.map((inv) => (
                <div key={inv.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {inv.name} ({inv.institution})
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {inv.assetClass} · {getPartnerName(partners, inv.ownerId)}
                      {inv.isEmergencyReserve ? ' · Reserva de Emergência' : ''}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-navy-950 dark:text-white">
                    {formatBRL(inv.currentBalance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      )}

      {selectedReport === 'patrimonio' && (
        <SurfaceCard className="space-y-4">
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
            Demonstrativo de Patrimônio Líquido (Sem Dupla Contagem)
          </h2>
          {!hasPatrimonyData ? (
            <EmptyState
              title="Ainda não existem dados suficientes para gerar relatórios."
              description="Cadastre contas bancárias, investimentos ou dívidas para consolidar o patrimônio líquido."
              actionLabel="Cadastrar Conta"
              onAction={() => setActivePage('contas')}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="py-2.5 flex justify-between">
                <span>Saldo em Contas Bancárias (Exclui VR/VA)</span>
                <span className="font-mono tabular-nums font-medium">
                  {formatBRL(summary.totalBankBalance)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span>Investimentos Livres</span>
                <span className="font-mono tabular-nums font-medium">
                  {formatBRL(summary.freeInvestmentsBalance)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span>Reserva de Emergência Conjunta</span>
                <span className="font-mono tabular-nums font-medium">
                  {formatBRL(summary.emergencyReserveBalance)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between text-red-700 dark:text-red-400">
                <span>Passivos (Dívidas + Faturas Abertas)</span>
                <span className="font-mono tabular-nums font-medium">
                  -{formatBRL(summary.totalDebtsBalance + summary.openCreditCardInvoices)}
                </span>
              </div>
              <div className="py-3 flex justify-between text-sm font-semibold text-navy-950 dark:text-white">
                <span>Patrimônio Líquido Consolidado</span>
                <span className="font-mono tabular-nums">{formatBRL(summary.netWorth)}</span>
              </div>
            </div>
          )}
        </SurfaceCard>
      )}

      {selectedReport === 'dividas' && (
        <SurfaceCard>
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-4">
            Relatório de Dívidas e Financiamentos
          </h2>
          {debts.length === 0 ? (
            <EmptyState
              title="Ainda não existem dados suficientes para gerar relatórios."
              description="Nenhuma dívida ou financiamento cadastrado."
              actionLabel="Ir para Dívidas"
              onAction={() => setActivePage('dividas')}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {debts.map((d) => (
                <div key={d.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{d.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {d.creditor} · {d.paidInstallments}/{d.totalInstallments} pagas · Juros{' '}
                      {formatPercent(d.monthlyInterestRate, 2)} a.m.
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-red-700 dark:text-red-400">
                    {formatBRL(d.remainingBalance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      )}

      {selectedReport === 'metas' && (
        <SurfaceCard>
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-4">
            Relatório de Metas Financeiras
          </h2>
          {goals.length === 0 ? (
            <EmptyState
              title="Ainda não existem dados suficientes para gerar relatórios."
              description="Nenhuma meta financeira cadastrada para o relatório."
              actionLabel="Ir para Metas"
              onAction={() => setActivePage('metas')}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {goals.map((g) => (
                <div key={g.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{g.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {g.scope === 'joint' ? 'Conjunta' : 'Individual'} · Prazo{' '}
                      {formatDateBR(g.deadline)}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-navy-950 dark:text-white">
                    {formatBRL(g.currentAmount)} / {formatBRL(g.targetAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      )}

      <Modal
        open={exportNoticeFormat !== null}
        onClose={() => setExportNoticeFormat(null)}
        title={`Exportação em ${exportNoticeFormat ?? ''}`}
        subtitle="Funcionalidade dependente de integração futura no backend"
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Os controles visuais de exportação em <strong>{exportNoticeFormat}</strong> estão preparados na interface. A geração real de arquivos oficiais com assinatura de competência e consultas consolidadas será habilitada após a conexão com o Supabase e Edge Functions no Google Antigravity. Nenhum arquivo fictício foi gerado.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setExportNoticeFormat(null)}
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 rounded-lg"
            >
              Entendido
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
