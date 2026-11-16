import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Landmark,
  Scale,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import {
  CashFlowBarChart,
  PatrimonyEvolutionChart,
} from '../components/charts/FinanceCharts';
import { PartnerAvatar } from '../components/ui/FeedbackStates';
import {
  MetricBlock,
  PageHeader,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { getCurrentReferenceMonthLabel } from '../data/mockData';
import {
  computeProportionalPercentages,
  getPartnerName,
  getPartnerShortName,
} from '../services/financeService';
import { formatBRL, formatDateBR, formatPercent } from '../utils/formatters';

export function DashboardPage() {
  const {
    partners,
    accounts,
    benefits,
    investments,
    summary,
    monthlySeries,
    emergencyConfig,
    budgets,
    goals,
    alerts,
    settlements,
    cards,
    transactions,
    setActivePage,
  } = useFinance();

  const partnerA = partners.find((p) => p.id === 'partner_a');
  const partnerB = partners.find((p) => p.id === 'partner_b');

  const split = computeProportionalPercentages(
    partnerA?.monthlyNetIncomeConfirmed ?? 0,
    partnerB?.monthlyNetIncomeConfirmed ?? 0,
  );

  const reservePercent =
    emergencyConfig.isConfigured && emergencyConfig.targetAmount > 0
      ? Math.min(100, (emergencyConfig.currentAmount / emergencyConfig.targetAmount) * 100)
      : 0;

  const budgetTotalPercent =
    summary.budgetLimitTotal > 0
      ? ((summary.budgetUsedConfirmed + summary.budgetCommittedPending) /
          summary.budgetLimitTotal) *
        100
      : 0;

  const unreadAlerts = alerts.filter((a) => !a.read);
  const pendingSettlements = settlements.filter((s) => s.status === 'pending');
  const isInitialEmpty =
    partners.length === 0 && accounts.length === 0 && transactions.length === 0;

  const currentMonthLabel = getCurrentReferenceMonthLabel();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão Geral do Casal"
        subtitle={`Competência ${currentMonthLabel} · Separação estrita entre saldo bancário e benefícios VR/VA`}
        actions={
          <button
            type="button"
            onClick={() => setActivePage('movimentacoes')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Nova Movimentação
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        }
      />

      {isInitialEmpty && (
        <SurfaceCard className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-navy-50/50 dark:bg-navy-950/40 border-navy-200/80 dark:border-navy-900">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-navy-950 dark:text-slate-50">
              Bem-vindas ao Sistema Financeiro do Casal
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Configurem seus perfis e cadastrem suas contas para começar.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setActivePage('configuracoes')}
              className="px-3.5 py-2 text-xs font-medium text-navy-950 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Configurar perfis
            </button>
            <button
              type="button"
              onClick={() => setActivePage('contas')}
              className="px-3.5 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 rounded-lg transition-colors whitespace-nowrap"
            >
              Cadastrar conta
            </button>
          </div>
        </SurfaceCard>
      )}

      {/* Bloco 1: Saldos Bancários vs Benefícios VR/VA (Regra de Separação) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <SurfaceCard className="lg:col-span-8 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Saldo Livre em Contas Bancárias (Confirmado)
              </p>
              <p className="text-3xl sm:text-[34px] font-semibold tracking-tight font-mono tabular-nums text-navy-950 dark:text-white mt-1">
                {formatBRL(summary.totalBankBalance)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {accounts.length === 0
                  ? 'Nenhuma conta bancária cadastrada · Não inclui VR/VA'
                  : 'Soma exclusiva de contas correntes, poupança e contas digitais · Não inclui VR/VA'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('contas')}
              className="text-xs font-medium text-navy-700 dark:text-navy-300 hover:underline whitespace-nowrap shrink-0"
            >
              Ver contas
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            <div className="flex items-center gap-3.5">
              <PartnerAvatar src={partnerA?.photoDataUrl} name={partnerA?.name} size="md" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {getPartnerName(partners, 'partner_a')}
                </p>
                <p className="text-lg font-semibold font-mono tabular-nums text-navy-950 dark:text-slate-100">
                  {partnerA?.name.trim() || accounts.some((a) => a.partnerId === 'partner_a')
                    ? formatBRL(summary.partnerABankBalance)
                    : 'Não configurado'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <PartnerAvatar src={partnerB?.photoDataUrl} name={partnerB?.name} size="md" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {getPartnerName(partners, 'partner_b')}
                </p>
                <p className="text-lg font-semibold font-mono tabular-nums text-navy-950 dark:text-slate-100">
                  {partnerB?.name.trim() || accounts.some((a) => a.partnerId === 'partner_b')
                    ? formatBRL(summary.partnerBBankBalance)
                    : 'Não configurado'}
                </p>
              </div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="lg:col-span-4 flex flex-col justify-between bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                <Utensils className="w-3.5 h-3.5 text-navy-700 dark:text-navy-300" />
                Benefícios VR e VA (Saldo Separado)
              </div>
              <p className="text-2xl font-semibold font-mono tabular-nums text-navy-950 dark:text-slate-50 pt-1">
                {formatBRL(summary.totalBenefitsBalance)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('beneficios')}
              className="text-xs font-medium text-navy-700 dark:text-navy-300 hover:underline whitespace-nowrap shrink-0"
            >
              Detalhar
            </button>
          </div>

          <div className="space-y-2 pt-4 mt-4 border-t border-slate-200/80 dark:border-slate-800 text-xs">
            {benefits.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">
                Nenhum benefício cadastrado.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    {getPartnerShortName(partners, 'partner_a')}
                  </span>
                  <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-200">
                    {formatBRL(summary.partnerABenefitsBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    {getPartnerShortName(partners, 'partner_b')}
                  </span>
                  <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-200">
                    {formatBRL(summary.partnerBBenefitsBalance)}
                  </span>
                </div>
              </>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              Compras em VR/VA não reduzem o saldo livre bancário.
            </p>
          </div>
        </SurfaceCard>
      </div>

      {/* Bloco 2: Fluxo do Mês (Confirmado vs Estimado) & Cartões */}
      <SurfaceCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          <div className="pt-2 sm:pt-0 sm:pr-4">
            <MetricBlock
              label="Receitas Recebidas no Mês"
              value={formatBRL(summary.confirmedIncomeMonth)}
              tone={summary.confirmedIncomeMonth > 0 ? 'positive' : 'neutral'}
              meta={
                summary.confirmedIncomeMonth === 0 && summary.estimatedIncomeMonth === 0
                  ? 'Aguardando cadastro de receitas'
                  : `Confirmado em conta · +${formatBRL(summary.estimatedIncomeMonth)} estimado`
              }
            />
          </div>
          <div className="pt-4 sm:pt-0 sm:px-4">
            <MetricBlock
              label="Despesas Realizadas"
              value={formatBRL(summary.confirmedExpensesMonth)}
              tone={summary.confirmedExpensesMonth > 0 ? 'negative' : 'neutral'}
              meta="Consumo confirmado (exclui quitação de faturas)"
            />
          </div>
          <div className="pt-4 sm:pt-0 sm:px-4">
            <MetricBlock
              label="Despesas Pendentes / Agendadas"
              value={formatBRL(summary.pendingExpensesMonth)}
              tone={summary.pendingExpensesMonth > 0 ? 'warning' : 'neutral'}
              meta="Valores comprometidos ou estimados no mês"
            />
          </div>
          <div className="pt-4 sm:pt-0 sm:pl-4">
            <MetricBlock
              label="Faturas de Cartões Abertas"
              value={formatBRL(summary.openCreditCardInvoices)}
              meta={
                cards.length === 0
                  ? 'Nenhum cartão cadastrado'
                  : `${cards.length} cartão(ões) ativo(s)`
              }
            />
          </div>
        </div>
      </SurfaceCard>

      {/* Bloco 3: Patrimônio, Investimentos, Reserva e Divisão */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <SurfaceCard>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Landmark className="w-3.5 h-3.5 text-navy-700 dark:text-navy-300" />
              Patrimônio Total e Líquido
            </span>
            <button
              type="button"
              onClick={() => setActivePage('investimentos')}
              className="text-navy-700 dark:text-navy-300 hover:underline"
            >
              Detalhes
            </button>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-navy-950 dark:text-slate-50">
            {formatBRL(summary.netWorth)}
          </p>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Patrimônio bruto</span>
              <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {formatBRL(summary.grossPatrimony)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Passivos (dívidas + faturas)</span>
              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                {formatBRL(summary.totalDebtsBalance + summary.openCreditCardInvoices)}
              </span>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Investimentos (Sem Dupla Contagem)
            </span>
            <button
              type="button"
              onClick={() => setActivePage('investimentos')}
              className="text-navy-700 dark:text-navy-300 hover:underline"
            >
              Carteira
            </button>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-navy-950 dark:text-slate-50">
            {formatBRL(summary.totalInvestmentsNoDoubleCount)}
          </p>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
            {investments.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">
                Nenhum investimento cadastrado.
              </p>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Investimentos livres</span>
                  <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    {formatBRL(summary.freeInvestmentsBalance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Alocado em reserva</span>
                  <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    {formatBRL(summary.emergencyReserveBalance)}
                  </span>
                </div>
              </>
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-navy-700 dark:text-navy-300" />
              Reserva de Emergência
            </span>
            <button
              type="button"
              onClick={() => setActivePage('reserva')}
              className="text-navy-700 dark:text-navy-300 hover:underline"
            >
              Configurar
            </button>
          </div>
          {!emergencyConfig.isConfigured ? (
            <div className="space-y-1.5">
              <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
                Não configurada
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A reserva de emergência ainda não foi configurada.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xl font-semibold font-mono tabular-nums text-navy-950 dark:text-slate-50">
                {formatBRL(emergencyConfig.currentAmount)}
              </p>
              <div className="mt-2.5 space-y-1.5">
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-navy-800 dark:bg-navy-400 rounded-full"
                    style={{ width: `${reservePercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{formatPercent(reservePercent, 0)} de {emergencyConfig.targetMonths} meses</span>
                  <span className="font-mono tabular-nums">
                    Meta {formatBRL(emergencyConfig.targetAmount)}
                  </span>
                </div>
              </div>
            </>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Scale className="w-3.5 h-3.5 text-navy-700 dark:text-navy-300" />
              Divisão & Acertos Pendentes
            </span>
            <button
              type="button"
              onClick={() => setActivePage('divisao')}
              className="text-navy-700 dark:text-navy-300 hover:underline"
            >
              Abrir
            </button>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-navy-950 dark:text-slate-50">
            {split.partnerAPercent !== null && split.partnerBPercent !== null
              ? `${formatPercent(split.partnerAPercent, 1)} / ${formatPercent(split.partnerBPercent, 1)}`
              : 'Sem dados'}
          </p>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Proporção</span>
              <span className="text-slate-700 dark:text-slate-300">
                {split.mode === 'unconfigured'
                  ? 'Aguardando receitas'
                  : `${getPartnerShortName(partners, 'partner_a')} / ${getPartnerShortName(partners, 'partner_b')}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Acertos pendentes</span>
              <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
                {pendingSettlements.length > 0
                  ? formatBRL(summary.pendingSettlementsTotal)
                  : 'Nenhum acerto pendente'}
              </span>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* Bloco 4: Gráficos Interativos (ou Estado Vazio) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SurfaceCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                Receitas vs. Despesas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fluxo consolidado do casal em contas bancárias e cartões
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('relatorios')}
              className="text-xs font-medium text-navy-700 dark:text-navy-300 hover:underline shrink-0"
            >
              Relatórios
            </button>
          </div>
          <CashFlowBarChart data={monthlySeries} />
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                Evolução Patrimonial
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Patrimônio bruto vs. patrimônio líquido consolidado
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('investimentos')}
              className="text-xs font-medium text-navy-700 dark:text-navy-300 hover:underline shrink-0"
            >
              Investimentos
            </button>
          </div>
          <PatrimonyEvolutionChart data={monthlySeries} />
        </SurfaceCard>
      </div>

      {/* Bloco 5: Orçamento Utilizado, Metas Financeiras e Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SurfaceCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                Orçamento Mensal
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {budgets.length === 0
                  ? 'Nenhuma categoria configurada'
                  : `${formatPercent(budgetTotalPercent, 1)} comprometido de ${formatBRL(summary.budgetLimitTotal)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('orcamento')}
              className="text-xs font-medium text-navy-700 dark:text-navy-300 hover:underline"
            >
              Abrir
            </button>
          </div>
          {budgets.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              Adicione categorias de orçamento para acompanhar limites mensais.
            </p>
          ) : (
            <div className="space-y-3.5">
              {budgets.slice(0, 4).map((b) => {
                const total = b.spentConfirmed + b.committedPending;
                const pct = Math.min(100, (total / b.monthlyLimit) * 100);
                const isHigh = pct >= 90;
                return (
                  <div key={b.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2">
                        {b.category}
                      </span>
                      <span
                        className={`font-mono tabular-nums shrink-0 ${
                          isHigh
                            ? 'text-red-700 dark:text-red-400 font-medium'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {formatBRL(total)} / {formatBRL(b.monthlyLimit)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isHigh
                            ? 'bg-red-600 dark:bg-red-500'
                            : 'bg-navy-800 dark:bg-navy-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                Metas Financeiras
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Objetivos conjuntos e individuais ativos
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('metas')}
              className="text-xs font-medium text-navy-700 dark:text-navy-300 hover:underline"
            >
              Ver todas
            </button>
          </div>
          {goals.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              Nenhuma meta financeira cadastrada até o momento.
            </p>
          ) : (
            <div className="space-y-4">
              {goals.slice(0, 3).map((goal) => {
                const pct = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                return (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {goal.title}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                        {formatPercent(pct, 0)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {formatBRL(goal.currentAmount)} de {formatBRL(goal.targetAmount)} · Prazo{' '}
                      {formatDateBR(goal.deadline)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                Alertas Importantes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {unreadAlerts.length > 0
                  ? `${unreadAlerts.length} pendentes de leitura`
                  : 'Sem alertas ativos'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('alertas')}
              className="text-xs font-medium text-navy-700 dark:text-navy-300 hover:underline"
            >
              Central
            </button>
          </div>
          {alerts.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              Nenhum alerta registrado no momento.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {alerts.slice(0, 3).map((al) => (
                <div key={al.id} className="py-2.5 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setActivePage(al.module)}
                    className="text-left w-full group"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          al.severity === 'critical'
                            ? 'text-red-600 dark:text-red-400'
                            : al.severity === 'warning'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-navy-600 dark:text-navy-400'
                        }`}
                      />
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-navy-700 dark:group-hover:text-navy-300 transition-colors">
                          {al.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {al.description}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
