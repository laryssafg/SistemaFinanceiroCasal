import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Settings2, ShieldCheck } from 'lucide-react';
import { EmptyState } from '../components/ui/FeedbackStates';
import { Modal } from '../components/ui/Modal';
import {
  MetricBlock,
  PageHeader,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { getPartnerName, getPartnerShortName } from '../services/financeService';
import { PartnerId } from '../types/finance';
import { formatBRL, formatDateBR, formatPercent } from '../utils/formatters';

export function ReservaPage() {
  const {
    emergencyConfig,
    configureEmergencyReserve,
    emergencyMovements,
    addEmergencyMovement,
    investments,
    partners,
  } = useFinance();

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [baselineInput, setBaselineInput] = useState('');
  const [monthsInput, setMonthsInput] = useState('12');
  const [plannedInput, setPlannedInput] = useState('');

  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawStepConfirm, setWithdrawStepConfirm] = useState(false);

  const [movPartner, setMovPartner] = useState<PartnerId>('partner_a');
  const [movAmount, setMovAmount] = useState('');
  const [movOrigin, setMovOrigin] = useState('');
  const [movReason, setMovReason] = useState('');

  const reserveCustodians = investments.filter((i) => i.isEmergencyReserve);
  const progressPct =
    emergencyConfig.targetAmount > 0
      ? Math.min(100, (emergencyConfig.currentAmount / emergencyConfig.targetAmount) * 100)
      : 0;
  const remainingToGoal = Math.max(
    0,
    emergencyConfig.targetAmount - emergencyConfig.currentAmount,
  );
  const estimatedMonthsToTarget =
    emergencyConfig.monthlyPlannedDeposit > 0 && remainingToGoal > 0
      ? Math.ceil(remainingToGoal / emergencyConfig.monthlyPlannedDeposit)
      : 0;

  const deposits = emergencyMovements.filter((m) => m.type === 'deposit');
  const withdrawals = emergencyMovements.filter((m) => m.type === 'withdrawal');
  const todayIso = new Date().toISOString().split('T')[0];

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const baseline = Number(baselineInput.replace(',', '.'));
    const months = Number(monthsInput) || 12;
    const planned = Number(plannedInput.replace(',', '.')) || 0;
    if (isNaN(baseline) || baseline <= 0) return;

    configureEmergencyReserve({
      essentialMonthlyBaseline: baseline,
      targetMonths: months,
      monthlyPlannedDeposit: planned,
    });
    setIsConfigOpen(false);
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(movAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    addEmergencyMovement({
      date: todayIso,
      type: 'deposit',
      partnerId: movPartner,
      amount: val,
      destinationOrOrigin: movOrigin.trim() || 'Ativo de Reserva de Emergência',
      reason: movReason.trim() || 'Aporte na reserva conjunta',
    });

    setMovAmount('');
    setMovOrigin('');
    setMovReason('');
    setIsDepositOpen(false);
  };

  const handleWithdrawInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(movAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0 || !movReason.trim()) return;
    setWithdrawStepConfirm(true);
  };

  const handleWithdrawConfirmed = () => {
    const val = Number(movAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0 || !movReason.trim()) return;

    addEmergencyMovement({
      date: todayIso,
      type: 'withdrawal',
      partnerId: movPartner,
      amount: val,
      destinationOrOrigin: movOrigin.trim() || 'Ativo de Reserva de Emergência',
      reason: movReason.trim(),
    });

    setMovAmount('');
    setMovOrigin('');
    setMovReason('');
    setWithdrawStepConfirm(false);
    setIsWithdrawOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reserva de Emergência Conjunta"
        subtitle="Meta equivalente a 12 meses de despesas essenciais · Pertence ao planejamento conjunto mesmo com custódia individual"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsConfigOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-navy-950 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Configurar Meta
            </button>
            <button
              type="button"
              disabled={!emergencyConfig.isConfigured || emergencyConfig.currentAmount <= 0}
              onClick={() => {
                setWithdrawStepConfirm(false);
                setMovAmount('');
                setMovReason('');
                setIsWithdrawOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-700 dark:text-red-300 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Registrar Retirada
            </button>
            <button
              type="button"
              onClick={() => {
                setMovAmount('');
                setMovReason('');
                setIsDepositOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Novo Aporte
            </button>
          </div>
        }
      />

      {!emergencyConfig.isConfigured && emergencyMovements.length === 0 && reserveCustodians.length === 0 ? (
        <SurfaceCard padding="none">
          <EmptyState
            title="A reserva de emergência ainda não foi configurada."
            description="Definam o valor mensal das despesas essenciais do casal para calcular a meta recomendada de 12 meses e acompanhar aportes e custódia."
            actionLabel="Configurar Reserva de Emergência"
            onAction={() => setIsConfigOpen(true)}
          />
        </SurfaceCard>
      ) : (
        <>
          <SurfaceCard className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricBlock
                label="Saldo Atual da Reserva"
                value={formatBRL(emergencyConfig.currentAmount)}
                tone={emergencyConfig.currentAmount > 0 ? 'positive' : 'neutral'}
                meta={
                  emergencyConfig.targetAmount > 0
                    ? `${formatPercent(progressPct, 1)} da meta de ${emergencyConfig.targetMonths} meses`
                    : 'Meta mensal ainda não definida'
                }
              />
              <MetricBlock
                label={`Meta Total (${emergencyConfig.targetMonths} Meses Essenciais)`}
                value={
                  emergencyConfig.targetAmount > 0
                    ? formatBRL(emergencyConfig.targetAmount)
                    : 'Não configurada'
                }
                meta={
                  emergencyConfig.essentialMonthlyBaseline > 0
                    ? `Base mensal essencial: ${formatBRL(emergencyConfig.essentialMonthlyBaseline)}`
                    : 'Defina as despesas essenciais'
                }
              />
              <MetricBlock
                label="Falta para Atingir a Meta"
                value={
                  emergencyConfig.targetAmount > 0
                    ? formatBRL(remainingToGoal)
                    : 'Aguardando meta'
                }
                meta={
                  estimatedMonthsToTarget > 0
                    ? `Projeção: ~${estimatedMonthsToTarget} meses com aporte de ${formatBRL(emergencyConfig.monthlyPlannedDeposit)}/mês`
                    : 'Sem projeção de aporte definida'
                }
              />
              <MetricBlock
                label="Contribuições Acumuladas"
                value={`${formatBRL(emergencyConfig.partnerATotalContributed)} / ${formatBRL(emergencyConfig.partnerBTotalContributed)}`}
                meta={`${getPartnerShortName(partners, 'partner_a')} / ${getPartnerShortName(partners, 'partner_b')} (planejamento conjunto)`}
              />
            </div>

            {emergencyConfig.targetAmount > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-navy-800 dark:bg-navy-400 rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    Cobertura atual:{' '}
                    {emergencyConfig.essentialMonthlyBaseline > 0
                      ? (emergencyConfig.currentAmount / emergencyConfig.essentialMonthlyBaseline)
                          .toFixed(1)
                          .replace('.', ',')
                      : '0,0'}{' '}
                    meses de despesas essenciais
                  </span>
                  <span>Meta: {emergencyConfig.targetMonths},0 meses</span>
                </div>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <div className="flex items-start gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-navy-800 dark:text-navy-300 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                  Onde a Reserva Está Mantida
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mesmo quando custodiada em CPF/conta individual, a reserva pertence integralmente ao planejamento conjunto e não é somada duas vezes no patrimônio.
                </p>
              </div>
            </div>

            {reserveCustodians.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                Nenhum investimento marcado como custódia da reserva de emergência até o momento.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reserveCustodians.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-navy-950 dark:text-slate-100">
                        {asset.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {asset.institution} · Titularidade: {getPartnerName(partners, asset.ownerId)} · Liquidez {asset.liquidity}
                      </p>
                    </div>
                    <span className="text-base font-semibold font-mono tabular-nums text-navy-950 dark:text-white shrink-0">
                      {formatBRL(asset.currentBalance)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SurfaceCard>
              <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-1">
                Histórico de Aportes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Entradas registradas para construção da reserva conjunta
              </p>
              {deposits.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Nenhum aporte registrado até o momento.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {deposits.map((m) => (
                    <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {m.destinationOrOrigin}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateBR(m.date)} · {getPartnerName(partners, m.partnerId)} · {m.reason}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                        +{formatBRL(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SurfaceCard>

            <SurfaceCard>
              <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-1">
                Histórico de Retiradas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Saídas com motivo obrigatório registrado em trilha de auditoria
              </p>
              {withdrawals.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Nenhuma retirada registrada até o momento.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {withdrawals.map((m) => (
                    <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          Motivo: {m.reason}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateBR(m.date)} · Solicitado por {getPartnerName(partners, m.partnerId)} · {m.destinationOrOrigin}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-red-700 dark:text-red-400 shrink-0">
                        -{formatBRL(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SurfaceCard>
          </div>
        </>
      )}

      {/* Modal: Configurar Reserva */}
      <Modal
        open={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        title="Configurar Reserva de Emergência"
        subtitle="Calcule a meta de acordo com as despesas essenciais mensais do casal"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Despesas Essenciais Mensais (R$)
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={baselineInput}
              onChange={(e) => setBaselineInput(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Meses de Cobertura (Alvo)
              </label>
              <input
                required
                type="number"
                min="1"
                max="36"
                value={monthsInput}
                onChange={(e) => setMonthsInput(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Aporte Mensal Planejado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={plannedInput}
                onChange={(e) => setPlannedInput(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsConfigOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg"
            >
              Salvar Configuração
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Novo Aporte */}
      <Modal
        open={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        title="Registrar Aporte na Reserva de Emergência"
        subtitle="Contribuição conjunta mantida em ativo de liquidez imediata"
      >
        <form onSubmit={handleDeposit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Pessoa que realizou o aporte
            </label>
            <select
              value={movPartner}
              onChange={(e) => setMovPartner(e.target.value as PartnerId)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="partner_a">{getPartnerName(partners, 'partner_a')}</option>
              <option value="partner_b">{getPartnerName(partners, 'partner_b')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Conta ou Investimento de Destino
            </label>
            <input
              type="text"
              value={movOrigin}
              onChange={(e) => setMovOrigin(e.target.value)}
              placeholder="Ex.: Tesouro Selic, CDB Liquidez Diária..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Valor do Aporte (R$)
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="1"
              value={movAmount}
              onChange={(e) => setMovAmount(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Observação (Opcional)
            </label>
            <input
              type="text"
              value={movReason}
              onChange={(e) => setMovReason(e.target.value)}
              placeholder="Ex.: Aporte mensal programado"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDepositOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg"
            >
              Confirmar Aporte
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Retirada com Confirmação Obrigatória e Campo para Motivo */}
      <Modal
        open={isWithdrawOpen}
        onClose={() => {
          setIsWithdrawOpen(false);
          setWithdrawStepConfirm(false);
        }}
        title={
          withdrawStepConfirm
            ? 'Confirmar Retirada da Reserva de Emergência'
            : 'Solicitar Retirada da Reserva'
        }
        subtitle="Toda retirada exige justificativa formal e confirmação explícita do casal"
      >
        {!withdrawStepConfirm ? (
          <form onSubmit={handleWithdrawInitialSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Pessoa Solicitante
              </label>
              <select
                value={movPartner}
                onChange={(e) => setMovPartner(e.target.value as PartnerId)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="partner_a">{getPartnerName(partners, 'partner_a')}</option>
                <option value="partner_b">{getPartnerName(partners, 'partner_b')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor da Retirada (R$)
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="1"
                max={emergencyConfig.currentAmount}
                value={movAmount}
                onChange={(e) => setMovAmount(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Motivo Obrigatório da Retirada
              </label>
              <textarea
                required
                rows={3}
                value={movReason}
                onChange={(e) => setMovReason(e.target.value)}
                placeholder="Descreva a emergência ou justificativa para utilização da reserva..."
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsWithdrawOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg"
              >
                Avançar para Confirmação
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 space-y-2">
              <p className="font-semibold text-red-900 dark:text-red-200">
                Confirmação de impacto na Reserva de Emergência
              </p>
              <p className="text-red-800 dark:text-red-300">
                Você está prestes a retirar{' '}
                <strong className="font-mono">
                  {formatBRL(Number(movAmount.replace(',', '.')) || 0)}
                </strong>{' '}
                da reserva conjunta por solicitação de{' '}
                <strong>{getPartnerName(partners, movPartner)}</strong>.
              </p>
              <p className="text-red-800 dark:text-red-300">
                Motivo registrado: <em>"{movReason}"</em>
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWithdrawStepConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Voltar e Revisar
              </button>
              <button
                type="button"
                onClick={handleWithdrawConfirmed}
                className="px-4 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg"
              >
                Confirmar Retirada Auditada
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
