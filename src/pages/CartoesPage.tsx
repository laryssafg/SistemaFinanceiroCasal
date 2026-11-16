import React, { useState } from 'react';
import { CreditCard as CardIcon, Info, Plus } from 'lucide-react';
import { EmptyState } from '../components/ui/FeedbackStates';
import { Modal } from '../components/ui/Modal';
import {
  PageHeader,
  SegmentedControl,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { getPartnerName } from '../services/financeService';
import { CreditCard, PartnerId } from '../types/finance';
import { formatBRL, formatDateBR, formatDateTimeBR, formatPercent } from '../utils/formatters';

export function CartoesPage() {
  const {
    cards,
    addCreditCard,
    installments,
    transactions,
    accounts,
    partners,
    payCardInvoice,
  } = useFinance();

  const [tab, setTab] = useState<'overview' | 'installments' | 'transactions'>('overview');
  const [payingCard, setPayingCard] = useState<CreditCard | null>(null);
  const [payAccountId, setPayAccountId] = useState(accounts[0]?.id ?? '');
  const [payAmount, setPayAmount] = useState('');

  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('');
  const [cardOwner, setCardOwner] = useState<PartnerId>('partner_a');
  const [cardLimit, setCardLimit] = useState('');
  const [closingDay, setClosingDay] = useState('20');
  const [dueDay, setDueDay] = useState('27');
  const [lastFour, setLastFour] = useState('');

  const cardTransactions = transactions.filter((t) => t.paymentMethod === 'credit_card');
  const invoicePayments = transactions.filter((t) => t.type === 'invoice_payment');

  const openPayModal = (card: CreditCard) => {
    setPayingCard(card);
    setPayAmount(card.currentInvoiceAmount.toFixed(2));
    const ownerAcc = accounts.find((a) => a.partnerId === card.ownerId);
    if (ownerAcc) setPayAccountId(ownerAcc.id);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCard || !payAccountId) return;
    const val = Number(payAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    payCardInvoice(payingCard.id, payAccountId, val);
    setPayingCard(null);
  };

  const handleAddCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = Number(cardLimit.replace(',', '.')) || 0;
    if (!cardName.trim() || !cardBank.trim() || limit <= 0) return;
    addCreditCard({
      name: cardName.trim(),
      bank: cardBank.trim(),
      brand: 'Mastercard',
      ownerId: cardOwner,
      creditLimit: limit,
      currentInvoiceAmount: 0,
      closedInvoiceAmount: 0,
      closedInvoicePaid: true,
      closingDay: Number(closingDay) || 20,
      dueDay: Number(dueDay) || 27,
      lastFourDigits: lastFour.trim().slice(-4) || '0000',
    });
    setCardName('');
    setCardBank('');
    setCardLimit('');
    setLastFour('');
    setIsAddCardOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartões de Crédito e Faturas"
        subtitle="Cartões titulares e adicionais, limites, compras parceladas, compras compartilhadas e pagamento de faturas sem dupla contagem"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <SegmentedControl
              ariaLabel="Seções de cartões"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'overview', label: 'Cartões e Faturas' },
                { value: 'installments', label: 'Parcelas Futuras' },
                { value: 'transactions', label: 'Compras & Quitações' },
              ]}
            />
            <button
              type="button"
              onClick={() => setIsAddCardOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Cartão
            </button>
          </div>
        }
      />

      <div className="flex items-start gap-3 p-4 rounded-xl bg-navy-50/70 dark:bg-navy-950/50 border border-navy-200/70 dark:border-navy-900 text-xs text-navy-900 dark:text-navy-200">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-navy-700 dark:text-navy-300" />
        <p className="leading-relaxed">
          Regra contábil aplicada: compras no crédito compõem as despesas por categoria na data da compra ou competência da fatura. O{' '}
          <strong>pagamento da fatura</strong> é tratado exclusivamente como liquidação financeira e nunca é contabilizado como uma segunda despesa de consumo.
        </p>
      </div>

      {tab === 'overview' && (
        cards.length === 0 ? (
          <SurfaceCard padding="none">
            <EmptyState
              title="Nenhum cartão cadastrado."
              description="Cadastrem os cartões de crédito individuais ou com portador adicional para controlar limites, fechamentos e faturas."
              actionLabel="Cadastrar Cartão"
              onAction={() => setIsAddCardOpen(true)}
            />
          </SurfaceCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {cards.map((card) => {
              const usedPct = Math.min(100, (card.currentInvoiceAmount / card.creditLimit) * 100);
              const available = Math.max(0, card.creditLimit - card.currentInvoiceAmount);

              return (
                <SurfaceCard key={card.id} className="flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                          {card.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Final {card.lastFourDigits} · Titular: {getPartnerName(partners, card.ownerId)}
                        </p>
                        {card.additionalHolderId && (
                          <p className="text-xs text-navy-700 dark:text-navy-300 mt-0.5">
                            Cartão adicional ({card.additionalLastFourDigits}):{' '}
                            {getPartnerName(partners, card.additionalHolderId)}
                          </p>
                        )}
                      </div>
                      <CardIcon className="w-5 h-5 text-navy-800 dark:text-navy-300 shrink-0" />
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">
                          Fatura aberta atual
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-navy-950 dark:text-white">
                          {formatBRL(card.currentInvoiceAmount)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-navy-800 dark:bg-navy-400 rounded-full"
                          style={{ width: `${usedPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        <span>Utilizado: {formatPercent(usedPct, 1)}</span>
                        <span>Disponível: {formatBRL(available)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">
                          Fechamento / Vencimento
                        </span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          Dia {card.closingDay} / Dia {card.dueDay}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 dark:text-slate-400 block">
                          Fatura fechada anterior
                        </span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          {card.closedInvoiceAmount > 0 ? formatBRL(card.closedInvoiceAmount) : 'Sem registro'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openPayModal(card)}
                      disabled={card.currentInvoiceAmount <= 0 || accounts.length === 0}
                      className="w-full py-2 px-4 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-40 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors"
                    >
                      Registrar Pagamento de Fatura
                    </button>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        )
      )}

      {tab === 'installments' && (
        <SurfaceCard padding="none">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
              Compras Parceladas e Parcelas Futuras
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Acompanhamento de compras à vista e parceladas (incluindo cartões adicionais e despesas compartilhadas)
            </p>
          </div>
          {installments.length === 0 ? (
            <EmptyState
              title="Nenhuma compra parcelada registrada."
              description="Compras parceladas nos cartões cadastrados serão listadas aqui com o cronograma de parcelas futuras."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Compra / Origem</th>
                    <th className="py-3 px-4">Cartão</th>
                    <th className="py-3 px-4">Parcela Atual</th>
                    <th className="py-3 px-4 text-right">Valor da Parcela</th>
                    <th className="py-3 px-4 text-right">Saldo Restante Futuro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {installments.map((inst) => {
                    const card = cards.find((c) => c.id === inst.cardId);
                    const remainingCount = inst.totalInstallments - inst.currentInstallment;
                    const remainingAmount = remainingCount * inst.installmentAmount;

                    return (
                      <tr key={inst.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-navy-950 dark:text-slate-100">
                            {inst.description}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatDateBR(inst.purchaseDate)} · {inst.category} ·{' '}
                            {getPartnerName(partners, inst.buyerId)}{' '}
                            {inst.isAdditionalCard ? '(Cartão Adicional)' : ''} ·{' '}
                            {inst.scope === 'shared' ? 'Compartilhada' : 'Individual'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                          {card?.name ?? '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {inst.currentInstallment}/{inst.totalInstallments}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-navy-950 dark:text-slate-100">
                          {formatBRL(inst.installmentAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {remainingCount}x · {formatBRL(remainingAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>
      )}

      {tab === 'transactions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SurfaceCard>
            <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-1">
              Compras no Crédito (Consumo)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Lançamentos à vista e recorrências na fatura atual
            </p>
            {cardTransactions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                Nenhuma compra no cartão de crédito registrada.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {cardTransactions.map((tx) => {
                  const card = cards.find((c) => c.id === tx.cardId);
                  return (
                    <div key={tx.id} className="py-3 flex justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {tx.description}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateTimeBR(tx.date)} · {card?.name ?? 'Cartão'} ·{' '}
                          {tx.scope === 'shared' ? 'Compartilhada' : 'Individual'}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-red-700 dark:text-red-400 shrink-0">
                        {formatBRL(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-1">
              Pagamentos de Faturas Registrados
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Transferências de quitação (não contabilizadas como nova despesa)
            </p>
            {invoicePayments.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                Nenhum pagamento de fatura registrado.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {invoicePayments.map((tx) => (
                  <div key={tx.id} className="py-3 flex justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {tx.description}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatDateTimeBR(tx.date)} · Quitação de fatura sem dupla contagem
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-navy-800 dark:text-navy-300 shrink-0">
                      {formatBRL(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      <Modal
        open={isAddCardOpen}
        onClose={() => setIsAddCardOpen(false)}
        title="Cadastrar Cartão de Crédito"
        subtitle="Informe instituição, titularidade, limite e datas de fechamento e vencimento"
      >
        <form onSubmit={handleAddCardSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nome do Cartão
              </label>
              <input
                required
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Ex.: Nubank Gold"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Instituição Emissora
              </label>
              <input
                required
                type="text"
                value={cardBank}
                onChange={(e) => setCardBank(e.target.value)}
                placeholder="Ex.: Nubank"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Titular
              </label>
              <select
                value={cardOwner}
                onChange={(e) => setCardOwner(e.target.value as PartnerId)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="partner_a">{getPartnerName(partners, 'partner_a')}</option>
                <option value="partner_b">{getPartnerName(partners, 'partner_b')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Limite Total (R$)
              </label>
              <input
                required
                type="number"
                step="10"
                min="1"
                value={cardLimit}
                onChange={(e) => setCardLimit(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Dia Fechamento
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Dia Vencimento
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Últimos 4 dígitos
              </label>
              <input
                type="text"
                maxLength={4}
                value={lastFour}
                onChange={(e) => setLastFour(e.target.value)}
                placeholder="1234"
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddCardOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg"
            >
              Salvar Cartão
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={payingCard !== null}
        onClose={() => setPayingCard(null)}
        title="Registrar Pagamento de Fatura"
        subtitle={
          payingCard
            ? `${payingCard.name} · Não será duplicado como nova despesa de consumo`
            : undefined
        }
      >
        <form onSubmit={handlePaySubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Conta Bancária Pagadora
            </label>
            <select
              value={payAccountId}
              onChange={(e) => setPayAccountId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.institution} ({getPartnerName(partners, acc.partnerId)}) — Saldo{' '}
                  {formatBRL(acc.currentBalance)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Valor a Pagar (R$)
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPayingCard(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg"
            >
              Confirmar Pagamento
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
