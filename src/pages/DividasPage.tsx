import React, { useMemo, useState } from 'react';
import { Calculator, Plus } from 'lucide-react';
import { EmptyState } from '../components/ui/FeedbackStates';
import { Modal } from '../components/ui/Modal';
import {
  MetricBlock,
  PageHeader,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { getPartnerName } from '../services/financeService';
import { PartnerId } from '../types/finance';
import { formatBRL, formatDateBR, formatPercent } from '../utils/formatters';

export function DividasPage() {
  const { debts, addDebt, partners, summary } = useFinance();
  const [selectedDebtId, setSelectedDebtId] = useState(debts[0]?.id ?? '');
  const [extraMonthlyAmortization, setExtraMonthlyAmortization] = useState(0);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [creditor, setCreditor] = useState('');
  const [responsibleId, setResponsibleId] = useState<PartnerId | 'joint'>('joint');
  const [remainingBalance, setRemainingBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('24');
  const [paidInstallments, setPaidInstallments] = useState('0');
  const [installmentValue, setInstallmentValue] = useState('');

  const totalMonthlyInstallments = debts.reduce((s, d) => s + d.installmentValue, 0);
  const weightedRate = useMemo(() => {
    const totalBal = debts.reduce((s, d) => s + d.remainingBalance, 0);
    if (totalBal <= 0) return null;
    const sumWeighted = debts.reduce(
      (s, d) => s + d.remainingBalance * d.monthlyInterestRate,
      0,
    );
    return sumWeighted / totalBal;
  }, [debts]);

  const selectedDebt = debts.find((d) => d.id === selectedDebtId) ?? debts[0];

  const simulation = useMemo(() => {
    if (!selectedDebt) {
      return { originalMonths: 0, simulatedMonths: 0, monthsSaved: 0, interestSaved: 0 };
    }
    const rate = selectedDebt.monthlyInterestRate / 100;
    const simulatePayoff = (monthlyPayment: number) => {
      if (monthlyPayment <= 0) return { months: 0, totalInterest: 0 };
      let balance = selectedDebt.remainingBalance;
      let months = 0;
      let totalInterest = 0;
      while (balance > 0.01 && months < 240) {
        const interest = balance * rate;
        totalInterest += interest;
        balance = balance + interest - monthlyPayment;
        months += 1;
      }
      return { months, totalInterest };
    };

    const base = simulatePayoff(selectedDebt.installmentValue);
    const boosted = simulatePayoff(
      selectedDebt.installmentValue + extraMonthlyAmortization,
    );

    return {
      originalMonths: base.months,
      simulatedMonths: boosted.months,
      monthsSaved: Math.max(0, base.months - boosted.months),
      interestSaved: Math.max(0, base.totalInterest - boosted.totalInterest),
    };
  }, [selectedDebt, extraMonthlyAmortization]);

  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const bal = Number(remainingBalance.replace(',', '.'));
    const rate = Number(interestRate.replace(',', '.')) || 0;
    const instVal = Number(installmentValue.replace(',', '.'));
    if (!title.trim() || !creditor.trim() || isNaN(bal) || bal <= 0 || isNaN(instVal)) {
      return;
    }

    addDebt({
      title: title.trim(),
      creditor: creditor.trim(),
      responsibleId,
      originalAmount: bal,
      remainingBalance: bal,
      monthlyInterestRate: rate,
      totalInstallments: Number(totalInstallments) || 12,
      paidInstallments: Number(paidInstallments) || 0,
      installmentValue: instVal,
      nextDueDate: new Date().toISOString().split('T')[0],
    });
    setTitle('');
    setCreditor('');
    setRemainingBalance('');
    setInterestRate('');
    setInstallmentValue('');
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dívidas e Financiamentos"
        subtitle="Saldos devedores, taxas de juros, parcelas pagas/restantes e simulador de amortização extraordinária"
        actions={
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Cadastrar Dívida
          </button>
        }
      />

      <SurfaceCard>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <MetricBlock
            label="Saldo Devedor Total"
            value={formatBRL(summary.totalDebtsBalance)}
            tone={summary.totalDebtsBalance > 0 ? 'negative' : 'neutral'}
            meta={
              debts.length === 0
                ? 'Nenhum contrato cadastrado'
                : `${debts.length} contrato(s) ativo(s)`
            }
          />
          <MetricBlock
            label="Comprometimento Mensal em Parcelas"
            value={formatBRL(totalMonthlyInstallments)}
            meta="Soma das parcelas contratuais mensais"
          />
          <MetricBlock
            label="Taxa Média Ponderada"
            value={weightedRate !== null ? `${formatPercent(weightedRate, 2)} a.m.` : 'Sem dados'}
            meta={
              weightedRate !== null
                ? 'Calculada sobre os saldos devedores ativos'
                : 'Aguardando cadastro de contratos'
            }
          />
        </div>
      </SurfaceCard>

      {debts.length === 0 ? (
        <SurfaceCard padding="none">
          <EmptyState
            title="Nenhuma dívida ou financiamento cadastrado."
            description="Caso possuam financiamentos, empréstimos ou parcelamentos de longo prazo, cadastrem aqui para acompanhar amortizações e juros."
            actionLabel="Cadastrar Dívida"
            onAction={() => setIsAddOpen(true)}
          />
        </SurfaceCard>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {debts.map((debt) => {
              const paidPct = (debt.paidInstallments / debt.totalInstallments) * 100;
              const remainingInstallments = debt.totalInstallments - debt.paidInstallments;

              return (
                <SurfaceCard key={debt.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                        {debt.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {debt.creditor} · Responsabilidade: {getPartnerName(partners, debt.responsibleId)}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-medium text-red-700 dark:text-red-400">
                      {formatPercent(debt.monthlyInterestRate, 2)} a.m.
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">
                        Saldo devedor
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-navy-950 dark:text-white text-sm">
                        {formatBRL(debt.remainingBalance)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">
                        Parcela mensal
                      </span>
                      <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200 text-sm">
                        {formatBRL(debt.installmentValue)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 dark:text-slate-400 block">
                        Próx. vencimento
                      </span>
                      <span className="font-mono text-slate-800 dark:text-slate-200 text-sm">
                        {formatDateBR(debt.nextDueDate)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-navy-800 dark:bg-navy-400 rounded-full"
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      <span>
                        Pagas: {debt.paidInstallments}/{debt.totalInstallments} parcelas
                      </span>
                      <span>Restantes: {remainingInstallments} parcelas</span>
                    </div>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>

          {selectedDebt && (
            <SurfaceCard className="space-y-5">
              <div className="flex items-start gap-3">
                <Calculator className="w-5 h-5 text-navy-800 dark:text-navy-300 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                    Simulador de Amortização Extraordinária
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Simule o impacto de aportes mensais adicionais na redução do prazo e economia de juros
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Contrato Selecionado
                    </label>
                    <select
                      value={selectedDebtId}
                      onChange={(e) => setSelectedDebtId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      {debts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} — Saldo {formatBRL(d.remainingBalance)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <label className="font-medium text-slate-700 dark:text-slate-300">
                        Amortização Extra Mensal
                      </label>
                      <span className="font-mono font-semibold text-navy-950 dark:text-white">
                        {formatBRL(extraMonthlyAmortization)} / mês
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2500}
                      step={100}
                      value={extraMonthlyAmortization}
                      onChange={(e) => setExtraMonthlyAmortization(Number(e.target.value))}
                      className="w-full accent-navy-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                  <MetricBlock
                    label="Prazo Estimado com Extra"
                    value={`${simulation.simulatedMonths} meses`}
                    meta={`Original estimado: ${simulation.originalMonths} meses`}
                  />
                  <MetricBlock
                    label="Redução de Prazo / Juros"
                    value={`-${simulation.monthsSaved} meses`}
                    tone="positive"
                    meta={`Economia estimada de ${formatBRL(simulation.interestSaved)}`}
                  />
                </div>
              </div>
            </SurfaceCard>
          )}
        </>
      )}

      <Modal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Cadastrar Dívida ou Financiamento"
        subtitle="Informe o contrato para controle de parcelas e amortizações"
      >
        <form onSubmit={handleAddDebt} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Descrição do Contrato
              </label>
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Financiamento Imobiliário"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Instituição Credora
              </label>
              <input
                required
                type="text"
                value={creditor}
                onChange={(e) => setCreditor(e.target.value)}
                placeholder="Ex.: Banco..."
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Responsável
              </label>
              <select
                value={responsibleId}
                onChange={(e) =>
                  setResponsibleId(e.target.value as PartnerId | 'joint')
                }
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="joint">Conjunto (Casal)</option>
                <option value="partner_a">{getPartnerName(partners, 'partner_a')}</option>
                <option value="partner_b">{getPartnerName(partners, 'partner_b')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Saldo Devedor (R$)
              </label>
              <input
                required
                type="number"
                step="0.01"
                value={remainingBalance}
                onChange={(e) => setRemainingBalance(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Juros % a.m.
              </label>
              <input
                type="number"
                step="0.01"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="0,00"
                className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Parcela (R$)
              </label>
              <input
                required
                type="number"
                step="0.01"
                value={installmentValue}
                onChange={(e) => setInstallmentValue(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Total Parc.
              </label>
              <input
                type="number"
                min="1"
                value={totalInstallments}
                onChange={(e) => setTotalInstallments(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Pagas
              </label>
              <input
                type="number"
                min="0"
                value={paidInstallments}
                onChange={(e) => setPaidInstallments(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg"
            >
              Salvar Dívida
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
