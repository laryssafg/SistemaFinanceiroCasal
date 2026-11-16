import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Link2 } from 'lucide-react';
import { EmptyState } from '../components/ui/FeedbackStates';
import { Modal } from '../components/ui/Modal';
import {
  MetricBlock,
  PageHeader,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { getPartnerName } from '../services/financeService';
import { CoupleSettlement } from '../types/finance';
import { formatBRL, formatDateBR } from '../utils/formatters';

export function AcertosPage() {
  const { settlements, partners, accounts, settleCoupleBalance, summary, financialSettings } =
    useFinance();
  const [settlingItem, setSettlingItem] = useState<CoupleSettlement | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState('');

  const pendingList = settlements.filter((s) => s.status === 'pending');
  const settledList = settlements.filter((s) => s.status === 'settled');

  const openSettleModal = (item: CoupleSettlement) => {
    setSettlingItem(item);
    const payerAcc = accounts.find((a) => a.partnerId === item.fromPartnerId);
    setSourceAccountId(payerAcc?.id ?? accounts[0]?.id ?? '');
  };

  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingItem) return;
    if (financialSettings.requireTransferForSettlement && !sourceAccountId) return;
    settleCoupleBalance(settlingItem.id, sourceAccountId || undefined);
    setSettlingItem(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acertos entre o Casal"
        subtitle="Compensações financeiras entre contas separadas · Somente liquidadas quando vinculadas a transferências efetivas"
      />

      <SurfaceCard>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <MetricBlock
            label="Saldo Pendente de Acerto"
            value={formatBRL(summary.pendingSettlementsTotal)}
            tone={summary.pendingSettlementsTotal > 0 ? 'warning' : 'neutral'}
            meta={
              settlements.length === 0
                ? 'Aguardando despesas compartilhadas'
                : summary.pendingSettlementsTotal > 0
                  ? `${pendingList.length} acerto(s) aguardando transferência efetiva`
                  : 'Todas as responsabilidades estão liquidadas'
            }
          />
          <MetricBlock
            label="Acertos Liquidados"
            value={String(settledList.length)}
            meta="Vinculados a comprovantes de transferência"
          />
          <MetricBlock
            label="Regra de Liquidação"
            value={
              financialSettings.requireTransferForSettlement
                ? 'Vínculo Obrigatório'
                : 'Liquidação Flexível'
            }
            meta={
              financialSettings.requireTransferForSettlement
                ? 'Nenhum acerto é quitado sem transferência correspondente'
                : 'Permite liquidação com ou sem conta bancária vinculada'
            }
          />
        </div>
      </SurfaceCard>

      {settlements.length === 0 ? (
        <SurfaceCard padding="none">
          <EmptyState
            title="Nenhum acerto registrado."
            description="Os acertos entre as titulares aparecerão aqui conforme despesas compartilhadas e divisões proporcionais forem registradas."
          />
        </SurfaceCard>
      ) : (
        <>
          <SurfaceCard>
            <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-1">
              Acertos Pendentes
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Registre a transferência efetiva para liquidar o saldo entre as titulares
            </p>

            {pendingList.length === 0 ? (
              <div className="py-6 text-center text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                Não há acertos pendentes no momento.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingList.map((item) => (
                  <div
                    key={item.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-navy-950 dark:text-slate-100">
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{getPartnerName(partners, item.fromPartnerId)}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span>{getPartnerName(partners, item.toPartnerId)}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.referenceMonth} · {item.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-lg font-semibold font-mono tabular-nums text-navy-950 dark:text-white">
                        {formatBRL(item.amount)}
                      </span>
                      <button
                        type="button"
                        disabled={
                          financialSettings.requireTransferForSettlement && accounts.length === 0
                        }
                        onClick={() => openSettleModal(item)}
                        className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-40 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {financialSettings.requireTransferForSettlement
                          ? 'Vincular Transferência e Liquidar'
                          : 'Liquidar Acerto'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-1">
              Histórico de Acertos Liquidados
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Registros preservados com vínculo direto à movimentação bancária
            </p>

            {settledList.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Nenhum acerto liquidado até o momento.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {settledList.map((item) => (
                  <div
                    key={item.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                          {getPartnerName(partners, item.fromPartnerId)} →{' '}
                          {getPartnerName(partners, item.toPartnerId)}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {item.referenceMonth}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.description}
                      </p>
                      {item.linkedTransferId ? (
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 font-mono">
                          <Link2 className="w-3 h-3" />
                          Vinculado à transferência {item.linkedTransferId} em{' '}
                          {formatDateBR(item.settledDate ?? '')}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Liquidado em {formatDateBR(item.settledDate ?? '')}
                        </p>
                      )}
                    </div>

                    <span className="font-mono tabular-nums font-semibold text-sm text-navy-950 dark:text-slate-100 shrink-0">
                      {formatBRL(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </>
      )}

      <Modal
        open={settlingItem !== null}
        onClose={() => setSettlingItem(null)}
        title={
          financialSettings.requireTransferForSettlement
            ? 'Liquidar Acerto via Transferência Efetiva'
            : 'Liquidar Acerto entre o Casal'
        }
        subtitle={
          settlingItem
            ? `${getPartnerName(partners, settlingItem.fromPartnerId)} → ${getPartnerName(
                partners,
                settlingItem.toPartnerId,
              )} (${formatBRL(settlingItem.amount)})`
            : undefined
        }
      >
        {settlingItem && (
          <form onSubmit={handleConfirmSettle} className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {financialSettings.requireTransferForSettlement
                ? 'Esta ação criará uma transferência bancária confirmada e marcará o acerto e as responsabilidades pendentes vinculadas como liquidadas e preservadas.'
                : 'Você pode vincular uma conta bancária para registrar a transferência ou confirmar a liquidação diretamente conforme suas configurações.'}
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {financialSettings.requireTransferForSettlement
                  ? 'Conta de Origem da Transferência'
                  : 'Conta de Origem da Transferência (Opcional)'}
              </label>
              <select
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                {!financialSettings.requireTransferForSettlement && (
                  <option value="">Liquidar sem vincular conta bancária</option>
                )}
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.institution} ({getPartnerName(partners, acc.partnerId)}) — Saldo{' '}
                    {formatBRL(acc.currentBalance)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSettlingItem(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg"
              >
                {sourceAccountId
                  ? 'Confirmar Transferência e Liquidar'
                  : 'Confirmar Liquidação'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
