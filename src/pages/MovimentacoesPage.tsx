import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard as CardIcon, History, Plus, Repeat, Search } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from '../components/ui/FeedbackStates';
import { Modal } from '../components/ui/Modal';
import {
  PageHeader,
  SegmentedControl,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import {
  getPartnerName,
  getPaymentMethodLabel,
  getTransactionStatusLabel,
  getTransactionTypeLabel,
} from '../services/financeService';
import {
  ExpenseScope,
  PartnerId,
  PaymentMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../types/finance';
import {
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  getLocalDateTimeParts,
  getTimeFromIso,
} from '../utils/formatters';

export function MovimentacoesPage() {
  const {
    transactions,
    addTransaction,
    accounts,
    cards,
    benefits,
    partners,
    setActivePage,
  } = useFinance();

  const [tab, setTab] = useState<'all' | 'recurring' | 'pending'>('all');
  const [partnerFilter, setPartnerFilter] = useState<'all' | PartnerId>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'current_month'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewState, setViewState] = useState<'ready' | 'loading' | 'error'>('ready');

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedHistoryTx, setSelectedHistoryTx] = useState<Transaction | null>(null);

  const initialDateTime = getLocalDateTimeParts();

  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txStatus, setTxStatus] = useState<TransactionStatus>('confirmed');
  const [txDescription, setTxDescription] = useState('');
  const [txCategory, setTxCategory] = useState('Moradia');
  const [txAmount, setTxAmount] = useState('');
  const [txPaidAmount, setTxPaidAmount] = useState('');
  const [txPartner, setTxPartner] = useState<PartnerId>('partner_a');
  const [txScope, setTxScope] = useState<ExpenseScope>('shared');
  const [txMethod, setTxMethod] = useState<PaymentMethod>('pix');
  const [txAccountId, setTxAccountId] = useState(accounts[0]?.id ?? '');
  const [txCardId, setTxCardId] = useState(cards[0]?.id ?? '');
  const [txInstallments, setTxInstallments] = useState<number>(1);
  const [txDate, setTxDate] = useState(initialDateTime.date);
  const [txTime, setTxTime] = useState(initialDateTime.time);
  const [txNotes, setTxNotes] = useState('');

  const openNewTransactionModal = () => {
    const nowParts = getLocalDateTimeParts();
    setTxDate(nowParts.date);
    setTxTime(nowParts.time);
    setIsNewModalOpen(true);
  };

  useEffect(() => {
    if (accounts.length === 0) {
      setTxAccountId('');
    } else if (!accounts.some((a) => a.id === txAccountId)) {
      setTxAccountId(accounts[0].id);
    }
  }, [accounts, txAccountId, isNewModalOpen]);

  useEffect(() => {
    if (cards.length === 0) {
      setTxCardId('');
    } else if (!cards.some((c) => c.id === txCardId)) {
      const preferredCard = cards.find((c) => c.ownerId === txPartner) ?? cards[0];
      setTxCardId(preferredCard.id);
    }
  }, [cards, txCardId, txPartner, isNewModalOpen]);

  const categories = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.category))).sort(),
    [transactions],
  );

  const currentMonthPrefix = initialDateTime.date.slice(0, 7);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (tab === 'recurring' && !t.isRecurring) return false;
      if (tab === 'pending' && t.status === 'confirmed') return false;
      if (partnerFilter !== 'all' && t.partnerId !== partnerFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (accountFilter !== 'all' && t.accountId !== accountFilter) return false;
      if (periodFilter === 'current_month' && !t.date.startsWith(currentMonthPrefix)) {
        return false;
      }
      if (
        searchTerm.trim() &&
        !t.description.toLowerCase().includes(searchTerm.trim().toLowerCase()) &&
        !t.category.toLowerCase().includes(searchTerm.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [
    transactions,
    tab,
    partnerFilter,
    categoryFilter,
    accountFilter,
    periodFilter,
    currentMonthPrefix,
    searchTerm,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(txAmount.replace(',', '.'));
    if (!txDescription.trim() || isNaN(numAmount) || numAmount <= 0) return;
    if (txMethod === 'credit_card' && (!txCardId || !cards.some((c) => c.id === txCardId))) {
      return;
    }

    const numPaid =
      txPaidAmount.trim() !== ''
        ? Math.min(numAmount, Math.max(0, Number(txPaidAmount.replace(',', '.'))))
        : txStatus === 'confirmed'
          ? numAmount
          : 0;

    const nowParts = getLocalDateTimeParts();
    const effectiveDate = txDate || nowParts.date;
    const effectiveTime = txTime || nowParts.time;

    addTransaction({
      date: `${effectiveDate}T${effectiveTime}`,
      description: txDescription.trim(),
      category: txCategory,
      type: txType,
      status: txStatus,
      amount: numAmount,
      paidAmount: numPaid,
      partnerId: txPartner,
      scope: txScope,
      paymentMethod: txMethod,
      accountId:
        txMethod !== 'credit_card' && txMethod !== 'vr' && txMethod !== 'va' && txAccountId
          ? txAccountId
          : undefined,
      cardId: txMethod === 'credit_card' ? txCardId : undefined,
      installmentCurrent: txMethod === 'credit_card' && txInstallments > 1 ? 1 : undefined,
      installmentTotal:
        txMethod === 'credit_card' && txInstallments > 1 ? txInstallments : undefined,
      benefitId:
        txMethod === 'vr' || txMethod === 'va'
          ? benefits.find((b) => b.partnerId === txPartner && b.type.toLowerCase() === txMethod)
              ?.id
          : undefined,
      notes: txNotes.trim() || undefined,
    });

    setTxDescription('');
    setTxAmount('');
    setTxPaidAmount('');
    setTxInstallments(1);
    setTxNotes('');
    setIsNewModalOpen(false);
  };

  const selectedCard = cards.find((c) => c.id === txCardId);
  const numericAmountPreview = Number(txAmount.replace(',', '.')) || 0;

  const hasActiveFilters =
    tab !== 'all' ||
    partnerFilter !== 'all' ||
    categoryFilter !== 'all' ||
    accountFilter !== 'all' ||
    periodFilter !== 'all' ||
    searchTerm.trim() !== '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimentações e Extratos"
        subtitle="Receitas, despesas, transferências, pagamentos parciais e lançamentos recorrentes com meio de pagamento explícito"
        actions={
          <button
            type="button"
            onClick={openNewTransactionModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar Movimentação
          </button>
        }
      />

      <SurfaceCard padding="sm" className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <SegmentedControl
            ariaLabel="Visualização de movimentações"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'Todos os lançamentos' },
              { value: 'recurring', label: 'Recorrentes' },
              { value: 'pending', label: 'Pendentes / Parciais' },
            ]}
          />

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Visualizar estado:
            </span>
            <SegmentedControl
              ariaLabel="Simulação de estado da lista"
              value={viewState}
              onChange={setViewState}
              options={[
                { value: 'ready', label: 'Dados' },
                { value: 'loading', label: 'Carregando' },
                { value: 'error', label: 'Erro' },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar descrição..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-navy-600"
            />
          </div>

          <select
            aria-label="Filtrar por pessoa"
            value={partnerFilter}
            onChange={(e) => setPartnerFilter(e.target.value as 'all' | PartnerId)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="all">Todas as pessoas</option>
            <option value="partner_a">{getPartnerName(partners, 'partner_a')}</option>
            <option value="partner_b">{getPartnerName(partners, 'partner_b')}</option>
          </select>

          <select
            aria-label="Filtrar por conta"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="all">Todas as contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.institution} ({getPartnerName(partners, a.partnerId)})
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por categoria"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por período"
            value={periodFilter}
            onChange={(e) =>
              setPeriodFilter(e.target.value as 'all' | 'current_month')
            }
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="all">Todos os períodos</option>
            <option value="current_month">Mês atual</option>
          </select>
        </div>
      </SurfaceCard>

      <SurfaceCard padding="none">
        {viewState === 'loading' ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : viewState === 'error' ? (
          <div className="p-6">
            <ErrorState onRetry={() => setViewState('ready')} />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            title="Nenhuma movimentação registrada."
            description={
              hasActiveFilters
                ? 'Nenhum lançamento encontrado para os filtros aplicados.'
                : 'Registre receitas, despesas, transferências ou pagamentos parciais para começar a acompanhar o extrato.'
            }
            actionLabel={hasActiveFilters ? 'Limpar filtros' : 'Registrar Movimentação'}
            onAction={() => {
              if (hasActiveFilters) {
                setTab('all');
                setPartnerFilter('all');
                setCategoryFilter('all');
                setAccountFilter('all');
                setPeriodFilter('all');
                setSearchTerm('');
              } else {
                openNewTransactionModal();
              }
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Data e Hora</th>
                  <th className="py-3 px-4">Descrição e Vínculos</th>
                  <th className="py-3 px-4">Meio de Pagamento</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-right">Histórico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredTransactions.map((tx) => {
                  const isPartial =
                    tx.status === 'pending' &&
                    tx.paidAmount !== undefined &&
                    tx.paidAmount > 0 &&
                    tx.paidAmount < tx.amount;
                  const timePart = getTimeFromIso(tx.date);

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div>{formatDateBR(tx.date)}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          {timePart ? `às ${timePart}` : 'Sem hora'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-navy-950 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{tx.description}</span>
                          {tx.isRecurring && (
                            <Repeat
                              className="w-3 h-3 text-slate-400 shrink-0"
                              aria-label="Recorrente"
                            />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {tx.category} · {getPartnerName(partners, tx.partnerId)} ·{' '}
                          {tx.scope === 'shared' ? 'Compartilhada' : 'Individual'}
                          {tx.recurrenceLabel ? ` · ${tx.recurrenceLabel}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <div>{getPaymentMethodLabel(tx.paymentMethod)}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          {tx.cardId
                            ? `${cards.find((c) => c.id === tx.cardId)?.name ?? 'Cartão'}${
                                tx.installmentTotal && tx.installmentTotal > 1
                                  ? ` · ${tx.installmentCurrent ?? 1}/${tx.installmentTotal}`
                                  : ''
                              }`
                            : tx.accountId
                              ? `${accounts.find((a) => a.id === tx.accountId)?.institution ?? getTransactionTypeLabel(tx.type)}`
                              : getTransactionTypeLabel(tx.type)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            tx.status === 'confirmed'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : tx.status === 'pending'
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {getTransactionStatusLabel(tx.status)}
                        </span>
                        {isPartial && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            Pago {formatBRL(tx.paidAmount ?? 0)} de {formatBRL(tx.amount)}
                          </div>
                        )}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                          tx.type === 'income'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : tx.type === 'expense'
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-navy-900 dark:text-slate-200'
                        }`}
                      >
                        {tx.type === 'income'
                          ? formatBRL(tx.amount, true)
                          : tx.type === 'expense'
                            ? formatBRL(-tx.amount)
                            : formatBRL(tx.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryTx(tx)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-navy-950 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-md transition-colors"
                        >
                          <History className="w-3 h-3" />
                          Alterações
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      <Modal
        open={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Registrar Movimentação"
        subtitle="Inclui suporte a receitas, despesas, transferências e pagamentos parciais"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tipo
              </label>
              <select
                value={txType}
                onChange={(e) => {
                  const nextType = e.target.value as TransactionType;
                  setTxType(nextType);
                  if (nextType !== 'expense' && txMethod === 'credit_card') {
                    setTxMethod('pix');
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
                <option value="transfer">Transferência</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Situação
              </label>
              <select
                value={txStatus}
                onChange={(e) => setTxStatus(e.target.value as TransactionStatus)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="confirmed">Confirmado</option>
                <option value="pending">Pendente / Parcial</option>
                <option value="scheduled">Agendado / Estimado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descrição
            </label>
            <input
              required
              type="text"
              value={txDescription}
              onChange={(e) => setTxDescription(e.target.value)}
              placeholder="Ex.: Conta de Água, Salário, Transferência..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor Total (R$)
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor Já Pago (Opcional / Parcial)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={txPaidAmount}
                onChange={(e) => setTxPaidAmount(e.target.value)}
                placeholder="Deixe vazio se integral"
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Pessoa Responsável
              </label>
              <select
                value={txPartner}
                onChange={(e) => setTxPartner(e.target.value as PartnerId)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="partner_a">{getPartnerName(partners, 'partner_a')}</option>
                <option value="partner_b">{getPartnerName(partners, 'partner_b')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Abrangência
              </label>
              <select
                value={txScope}
                onChange={(e) => setTxScope(e.target.value as ExpenseScope)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="shared">Compartilhada (Casal)</option>
                <option value="individual">Individual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Meio de Pagamento
              </label>
              <select
                value={txMethod}
                onChange={(e) => setTxMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="pix">Pix</option>
                <option value="debit">Cartão de Débito</option>
                {txType === 'expense' && (
                  <option value="credit_card">Cartão de Crédito</option>
                )}
                <option value="transfer">Transferência</option>
                <option value="boleto">Boleto</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Categoria
              </label>
              <select
                value={txCategory}
                onChange={(e) => setTxCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="Moradia">Moradia</option>
                <option value="Alimentação e Mercado">Alimentação e Mercado</option>
                <option value="Saúde">Saúde</option>
                <option value="Transporte">Transporte</option>
                <option value="Lazer e Viagens">Lazer e Viagens</option>
                <option value="Salário">Salário</option>
                <option value="Renda Extra">Renda Extra</option>
              </select>
            </div>
          </div>

          {txMethod === 'credit_card' ? (
            <div className="space-y-3">
              {cards.length === 0 ? (
                <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                    <CardIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      Nenhum cartão de crédito cadastrado. Cadastre um cartão primeiro para registrar esta compra nele.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewModalOpen(false);
                      setActivePage('cartoes');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 rounded-lg transition-colors"
                  >
                    Cadastrar Cartão de Crédito
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Cartão de Crédito
                    </label>
                    <select
                      required
                      value={txCardId}
                      onChange={(e) => setTxCardId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      {cards.map((card) => {
                        const available = Math.max(0, card.creditLimit - card.currentInvoiceAmount);
                        return (
                          <option key={card.id} value={card.id}>
                            {card.name} (Final {card.lastFourDigits}) — {getPartnerName(partners, card.ownerId)} · Disp. {formatBRL(available)}
                          </option>
                        );
                      })}
                    </select>
                    {selectedCard && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                        Fatura aberta: {formatBRL(selectedCard.currentInvoiceAmount)} · Fecha dia {selectedCard.closingDay} / Vence dia {selectedCard.dueDay}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Parcelamento
                      </label>
                      <select
                        value={txInstallments}
                        onChange={(e) => setTxInstallments(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <option value={1}>1x (À vista na fatura)</option>
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                          <option key={n} value={n}>
                            {n}x parcelado
                          </option>
                        ))}
                      </select>
                      {txInstallments > 1 && numericAmountPreview > 0 && (
                        <p className="text-[11px] text-navy-700 dark:text-navy-300 mt-1 font-mono tabular-nums">
                          {txInstallments}x de {formatBRL(numericAmountPreview / txInstallments)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Data da Compra
                      </label>
                      <input
                        required
                        type="date"
                        value={txDate}
                        onChange={(e) => setTxDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Hora da Compra
                      </label>
                      <input
                        required
                        type="time"
                        value={txTime}
                        onChange={(e) => setTxTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Conta Bancária
                </label>
                <select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  {accounts.length === 0 ? (
                    <option value="">Nenhuma conta cadastrada</option>
                  ) : (
                    accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.institution} — {getPartnerName(partners, acc.partnerId)}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Data da Movimentação
                  </label>
                  <input
                    required
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Hora da Movimentação
                  </label>
                  <input
                    required
                    type="time"
                    value={txTime}
                    onChange={(e) => setTxTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Observações
            </label>
            <input
              type="text"
              value={txNotes}
              onChange={(e) => setTxNotes(e.target.value)}
              placeholder="Detalhes adicionais sobre este lançamento..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={txMethod === 'credit_card' && (!txCardId || cards.length === 0)}
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg"
            >
              Salvar Lançamento
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={selectedHistoryTx !== null}
        onClose={() => setSelectedHistoryTx(null)}
        title="Histórico de Alterações"
        subtitle={selectedHistoryTx?.description}
      >
        {selectedHistoryTx && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Valor registrado:</span>
                <p className="font-mono font-semibold text-navy-950 dark:text-white mt-0.5">
                  {formatBRL(selectedHistoryTx.amount)}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Data e hora:</span>
                <p className="font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                  {formatDateTimeBR(selectedHistoryTx.date)}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Meio de pagamento:</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                  {getPaymentMethodLabel(selectedHistoryTx.paymentMethod)}
                </p>
              </div>
            </div>

            {selectedHistoryTx.notes && (
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Nota: {selectedHistoryTx.notes}
              </p>
            )}

            <div className="space-y-2">
              <p className="font-medium text-slate-700 dark:text-slate-300">
                Trilha de auditoria do lançamento
              </p>
              {selectedHistoryTx.historyLog && selectedHistoryTx.historyLog.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                  {selectedHistoryTx.historyLog.map((item, idx) => (
                    <li key={idx} className="p-3 space-y-0.5">
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{item.actor}</span>
                        <span className="font-mono">{formatDateTimeBR(item.date)}</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200">{item.change}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">
                  Sem alterações posteriores registradas.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
