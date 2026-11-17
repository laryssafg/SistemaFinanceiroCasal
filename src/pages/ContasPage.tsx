import React, { useState } from 'react';
import { Landmark, Plus } from 'lucide-react';
import { EmptyState, PartnerAvatar } from '../components/ui/FeedbackStates';
import { Modal } from '../components/ui/Modal';
import {
  MetricBlock,
  PageHeader,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { getPartnerName, getPartnerShortName } from '../services/financeService';
import { PartnerId } from '../types/finance';
import { formatBRL, formatDateBR, formatDateTimeBR } from '../utils/formatters';

export function ContasPage() {
  const { accounts, addBankAccount, partners, summary, transactions, isDataLoading } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const [partnerId, setPartnerId] = useState<PartnerId>('partner_a');
  const [institution, setInstitution] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings' | 'digital'>('checking');
  const [openingBalance, setOpeningBalance] = useState('');

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const opening = Number(openingBalance.replace(',', '.')) || 0;
    if (!institution.trim() || !accountName.trim()) return;
    addBankAccount({
      partnerId,
      institution: institution.trim(),
      accountName: accountName.trim(),
      accountType,
      openingBalance: opening,
      currentBalance: opening,
      active: true,
    });
    setInstitution('');
    setAccountName('');
    setOpeningBalance('');
    setIsModalOpen(false);
  };

  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null;
  const accountTransactions = selectedAccount
    ? transactions.filter(
        (t) =>
          t.accountId === selectedAccount.id &&
          t.paymentMethod !== 'vr' &&
          t.paymentMethod !== 'va',
      )
    : [];

  const partnerA = partners.find((p) => p.id === 'partner_a');
  const partnerB = partners.find((p) => p.id === 'partner_b');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas Bancárias Individuais"
        subtitle="Dinheiro separado por titularidade · Saldos de abertura, saldos atuais e extratos bancários (exclui VR/VA)"
        actions={
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Cadastrar Conta
          </button>
        }
      />

      <SurfaceCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricBlock
            label="Saldo Total Consolidado em Bancos"
            value={formatBRL(summary.totalBankBalance)}
            meta="Não inclui créditos nem saldos de Vale-Refeição / Alimentação"
          />
          <MetricBlock
            label={getPartnerName(partners, 'partner_a')}
            value={
              partnerA || accounts.some((a) => a.partnerId === 'partner_a')
                ? formatBRL(summary.partnerABankBalance)
                : 'Não configurado'
            }
            meta={`${accounts.filter((a) => a.partnerId === 'partner_a').length} conta(s) ativa(s)`}
          />
          <MetricBlock
            label={getPartnerName(partners, 'partner_b')}
            value={
              partnerB || accounts.some((a) => a.partnerId === 'partner_b')
                ? formatBRL(summary.partnerBBankBalance)
                : 'Não configurado'
            }
            meta={`${accounts.filter((a) => a.partnerId === 'partner_b').length} conta(s) ativa(s)`}
          />
        </div>
      </SurfaceCard>

      {accounts.length === 0 ? (
        <SurfaceCard padding="none">
          <EmptyState
            title="Nenhuma conta cadastrada."
            description="Cadastrem suas contas correntes, poupanças ou contas digitais individuais com o saldo de abertura para começar."
            actionLabel="Cadastrar Conta"
            onAction={() => setIsModalOpen(true)}
          />
        </SurfaceCard>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {accounts.map((acc) => {
              const owner = partners.find((p) => p.id === acc.partnerId);
              const isSelected = selectedAccount?.id === acc.id;
              const delta = acc.currentBalance - acc.openingBalance;

              return (
                <SurfaceCard
                  key={acc.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-navy-700 dark:border-navy-400 ring-1 ring-navy-700/20'
                      : 'hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className="w-full text-left space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-navy-50 dark:bg-navy-950/60 border border-navy-100 dark:border-navy-900 flex items-center justify-center text-navy-800 dark:text-navy-300">
                          <Landmark className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-navy-950 dark:text-slate-50">
                            {acc.institution}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {acc.accountName} ·{' '}
                            {acc.accountType === 'checking'
                              ? 'Conta Corrente'
                              : acc.accountType === 'savings'
                                ? 'Poupança'
                                : 'Conta Digital'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <PartnerAvatar src={owner?.photoDataUrl} name={owner?.name} size="sm" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {getPartnerShortName(partners, acc.partnerId)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">
                          Saldo abertura
                        </span>
                        <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
                          {formatBRL(acc.openingBalance)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">
                          Variação no mês
                        </span>
                        <span
                          className={`font-mono tabular-nums font-medium ${
                            delta >= 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {formatBRL(delta, true)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 dark:text-slate-400 block">
                          Saldo atual
                        </span>
                        <span className="font-mono tabular-nums text-base font-semibold text-navy-950 dark:text-white">
                          {formatBRL(acc.currentBalance)}
                        </span>
                      </div>
                    </div>
                  </button>
                </SurfaceCard>
              );
            })}
          </div>

          {selectedAccount && (
            <SurfaceCard>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                    Extrato Bancário — {selectedAccount.institution} ({selectedAccount.accountName})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Titular: {getPartnerName(partners, selectedAccount.partnerId)} · Atualizado em{' '}
                    {formatDateBR(selectedAccount.lastUpdated)}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {accountTransactions.length} lançamentos
                </span>
              </div>

              {accountTransactions.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                  Nenhuma movimentação bancária registrada nesta conta até o momento.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {accountTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="py-3 flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {tx.description}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateTimeBR(tx.date)} · {tx.category} ·{' '}
                          {tx.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                        </p>
                      </div>
                      <span
                        className={`font-mono tabular-nums font-semibold shrink-0 ${
                          tx.type === 'income'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {tx.type === 'income'
                          ? formatBRL(tx.amount, true)
                          : formatBRL(-(tx.paidAmount ?? tx.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SurfaceCard>
          )}
        </>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Cadastrar Conta Bancária Individual"
        subtitle="Informe titularidade e saldo de abertura da competência"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Titular da Conta
            </label>
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value as PartnerId)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="partner_a">{getPartnerName(partners, 'partner_a')}</option>
              <option value="partner_b">{getPartnerName(partners, 'partner_b')}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Instituição Financeira
              </label>
              <input
                required
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Ex.: Banco do Brasil"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Conta
              </label>
              <select
                value={accountType}
                onChange={(e) =>
                  setAccountType(e.target.value as 'checking' | 'savings' | 'digital')
                }
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="checking">Conta Corrente</option>
                <option value="digital">Conta Digital</option>
                <option value="savings">Poupança</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nome / Apelido da Conta
              </label>
              <input
                required
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Ex.: Conta Salário"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Saldo de Abertura (R$)
              </label>
              <input
                required
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isDataLoading}
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDataLoading ? 'Salvando...' : 'Salvar Conta'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
