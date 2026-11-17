import React, { useMemo, useState } from 'react';
import { Plus, ShieldAlert, Utensils, ArrowUpRight, RotateCcw } from 'lucide-react';
import { HorizontalDistributionBar } from '../components/charts/FinanceCharts';
import { EmptyState } from '../components/ui/FeedbackStates';
import { Modal } from '../components/ui/Modal';
import {
  MetricBlock,
  PageHeader,
  SegmentedControl,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { getPartnerName, getPartnerShortName } from '../services/financeService';
import { PartnerId } from '../types/finance';
import { formatBRL, formatDateBR, formatDateTimeBR, formatPercent } from '../utils/formatters';

export function BeneficiosPage() {
  const {
    benefits,
    benefitMovements,
    addBenefitCard,
    registerBenefitCredit,
    registerBenefitPurchase,
    reverseBenefitMovement,
    transactions,
    partners,
    summary,
    isDataLoading,
  } = useFinance();

  const [partnerFilter, setPartnerFilter] = useState<'all' | PartnerId>('all');
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isAddBenefitOpen, setIsAddBenefitOpen] = useState(false);
  const [isCreditOpen, setIsCreditOpen] = useState(false);

  const [newBenType, setNewBenType] = useState<'VR' | 'VA'>('VR');
  const [newBenProvider, setNewBenProvider] = useState('');
  const [newBenPartner, setNewBenPartner] = useState<PartnerId>('partner_a');
  const [newBenCredit, setNewBenCredit] = useState('');

  const [selectedBenefitId, setSelectedBenefitId] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Alimentação e Mercado');
  const [amount, setAmount] = useState('');
  const [scope, setScope] = useState<'individual' | 'shared'>('shared');

  const [creditCardId, setCreditCardId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('Recarga mensal');

  const visibleBenefits = useMemo(
    () =>
      benefits.filter((b) =>
        partnerFilter === 'all' ? true : b.partnerId === partnerFilter,
      ),
    [benefits, partnerFilter],
  );

  // No modo autenticado, temos benefitMovements; no modo preview, temos transactions de VR/VA
  const displayedMovements = useMemo(() => {
    if (benefitMovements && benefitMovements.length > 0) {
      return benefitMovements
        .filter((m) => {
          if (partnerFilter === 'all') return true;
          const card = benefits.find((b) => b.id === m.benefitCardId);
          return card ? card.partnerId === partnerFilter : true;
        })
        .map((m) => {
          const card = benefits.find((b) => b.id === m.benefitCardId);
          return {
            id: m.id,
            description: m.description,
            category: m.category || 'Alimentação e Mercado',
            date: m.movementDate,
            amount: m.amount,
            movementType: m.movementType,
            isReversal: m.isReversal,
            partnerId: card ? card.partnerId : 'partner_a',
            benefitName: card ? card.providerName : 'Benefício',
            canReverse: m.movementType === 'purchase' && !m.isReversal && !m.reversedBy,
          };
        });
    }

    return transactions
      .filter(
        (t) =>
          (t.paymentMethod === 'vr' || t.paymentMethod === 'va') &&
          (partnerFilter === 'all' || t.partnerId === partnerFilter),
      )
      .map((t) => ({
        id: t.id,
        description: t.description,
        category: t.category,
        date: t.date,
        amount: t.amount,
        movementType: 'purchase' as const,
        isReversal: false,
        partnerId: t.partnerId,
        benefitName: t.paymentMethod.toUpperCase(),
        canReverse: false,
      }));
  }, [benefitMovements, transactions, partnerFilter, benefits]);

  const totalCredits = visibleBenefits.reduce((s, b) => s + b.monthlyCredit, 0);
  const totalSpent = visibleBenefits.reduce((s, b) => s + b.spentThisMonth, 0);
  const totalCurrent = visibleBenefits.reduce((s, b) => s + b.currentBalance, 0);

  const categorySegments = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const mov of displayedMovements) {
      if (mov.movementType === 'purchase') {
        byCat[mov.category] = (byCat[mov.category] ?? 0) + mov.amount;
      }
    }
    const palette = [
      'bg-navy-800 dark:bg-navy-400',
      'bg-emerald-600 dark:bg-emerald-500',
      'bg-navy-500 dark:bg-navy-300',
      'bg-slate-500 dark:bg-slate-400',
    ];
    return Object.entries(byCat).map(([label, value], i) => ({
      label,
      value,
      colorClass: palette[i % palette.length],
    }));
  }, [displayedMovements]);

  const handleAddBenefit = async (e: React.FormEvent) => {
    e.preventDefault();
    const credit = Number(newBenCredit.replace(',', '.')) || 0;
    if (!newBenProvider.trim()) return;
    try {
      await addBenefitCard({
        type: newBenType,
        providerName: newBenProvider.trim(),
        partnerId: newBenPartner,
        monthlyCredit: credit,
        currentBalance: credit,
        spentThisMonth: 0,
      });
      setNewBenProvider('');
      setNewBenCredit('');
      setIsAddBenefitOpen(false);
    } catch {
      // toast de erro exibido no contexto
    }
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = selectedBenefitId || benefits[0]?.id;
    const num = Number(amount.replace(',', '.'));
    if (!targetId || !description.trim() || isNaN(num) || num <= 0) return;

    try {
      await registerBenefitPurchase({
        benefitId: targetId,
        description: description.trim(),
        category,
        amount: num,
        scope,
      });
      setDescription('');
      setAmount('');
      setIsPurchaseOpen(false);
    } catch {
      // toast de erro exibido no contexto
    }
  };

  const handleCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = creditCardId || benefits[0]?.id;
    const num = Number(creditAmount.replace(',', '.'));
    if (!targetId || isNaN(num) || num <= 0) return;

    try {
      await registerBenefitCredit({
        benefitId: targetId,
        amount: num,
        description: creditDescription.trim() || 'Recarga recebida',
      });
      setCreditAmount('');
      setCreditDescription('Recarga mensal');
      setIsCreditOpen(false);
    } catch {
      // toast exibido no contexto
    }
  };

  const handleReverseMovement = async (movementId: string) => {
    if (!window.confirm('Confirma o estorno deste lançamento? O valor será reajustado no saldo.')) return;
    try {
      await reverseBenefitMovement(movementId);
    } catch {
      // toast exibido no contexto
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Benefícios VR e VA"
        subtitle="Cartões independentes de Vale-Refeição e Vale-Alimentação · Separados integralmente das contas bancárias"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <SegmentedControl
              ariaLabel="Filtrar benefícios por titular"
              value={partnerFilter}
              onChange={setPartnerFilter}
              options={[
                { value: 'all', label: 'Casal (Todos)' },
                { value: 'partner_a', label: getPartnerShortName(partners, 'partner_a') },
                { value: 'partner_b', label: getPartnerShortName(partners, 'partner_b') },
              ]}
            />
            <button
              type="button"
              onClick={() => setIsAddBenefitOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-navy-950 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Benefício
            </button>
            <button
              type="button"
              disabled={benefits.length === 0}
              onClick={() => {
                setCreditCardId(benefits[0]?.id ?? '');
                setIsCreditOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-950 dark:text-emerald-100 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Registrar Crédito (Recarga)
            </button>
            <button
              type="button"
              disabled={benefits.length === 0}
              onClick={() => {
                setSelectedBenefitId(benefits[0]?.id ?? '');
                setIsPurchaseOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-40 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Registrar Compra VR/VA
            </button>
          </div>
        }
      />

      <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-950 dark:text-emerald-200">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" />
        <p className="leading-relaxed">
          <strong>Regra de isolamento patrimonial:</strong> Compras registradas com VR ou VA nunca reduzem o saldo das contas bancárias (atualmente em{' '}
          <span className="font-mono font-semibold">{formatBRL(summary.totalBankBalance)}</span>), e créditos de benefícios não são somados como salário em conta. O consumo aparece nos relatórios sem dupla contagem.
        </p>
      </div>

      <SurfaceCard>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <MetricBlock
            label="Saldo Disponível em Benefícios"
            value={formatBRL(totalCurrent)}
            meta="Saldo livre exclusivo de VR e VA"
          />
          <MetricBlock
            label="Créditos Recebidos no Mês"
            value={formatBRL(totalCredits)}
            tone={totalCredits > 0 ? 'positive' : 'neutral'}
            meta="Recargas corporativas independentes de salário"
          />
          <MetricBlock
            label="Compras Realizadas no Mês"
            value={formatBRL(totalSpent)}
            meta={
              totalCredits > 0
                ? `${formatPercent((totalSpent / totalCredits) * 100, 1)} de utilização mensal`
                : 'Aguardando cadastro de benefícios'
            }
          />
        </div>
      </SurfaceCard>

      {visibleBenefits.length === 0 ? (
        <SurfaceCard padding="none">
          <EmptyState
            title="Nenhum benefício cadastrado."
            description="Cadastrem seus cartões de Vale-Refeição e Vale-Alimentação para controlar saldos e compras sem misturar com contas bancárias."
            actionLabel="Cadastrar Benefício"
            onAction={() => setIsAddBenefitOpen(true)}
          />
        </SurfaceCard>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {visibleBenefits.map((ben) => {
              const usedPct =
                ben.monthlyCredit > 0
                  ? Math.min(100, (ben.spentThisMonth / ben.monthlyCredit) * 100)
                  : 0;
              return (
                <SurfaceCard key={ben.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-navy-50 dark:bg-navy-950 border border-navy-100 dark:border-navy-900 flex items-center justify-center text-navy-800 dark:text-navy-300">
                        <Utensils className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-navy-950 dark:text-slate-50">
                          {ben.providerName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {ben.type === 'VR' ? 'Vale-Refeição' : 'Vale-Alimentação'} · Titular:{' '}
                          {getPartnerName(partners, ben.partnerId)}
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-semibold font-mono tabular-nums text-navy-950 dark:text-white">
                      {formatBRL(ben.currentBalance)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      <span>Crédito mensal: {formatBRL(ben.monthlyCredit)}</span>
                      <span>
                        Gasto: {formatBRL(ben.spentThisMonth)} ({formatPercent(usedPct, 1)})
                      </span>
                    </div>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <SurfaceCard className="lg:col-span-5">
              <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-1">
                Gastos por Categoria (VR/VA)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Distribuição do consumo direto nos cartões de benefício
              </p>
              <HorizontalDistributionBar segments={categorySegments} />
            </SurfaceCard>

            <SurfaceCard className="lg:col-span-7">
              <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-1">
                Histórico de Movimentações em VR/VA
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Créditos, consumos e estornos registrados exclusivamente em benefícios
              </p>
              {displayedMovements.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Nenhuma movimentação registrada nos benefícios até o momento.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {displayedMovements.map((mov) => (
                    <div key={mov.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          {mov.description}
                          {mov.isReversal && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-medium">
                              Estorno
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateBR(mov.date)} · {mov.category} ·{' '}
                          {getPartnerName(partners, mov.partnerId)} · {mov.benefitName}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-mono tabular-nums font-semibold shrink-0 ${
                            mov.movementType === 'credit'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {mov.movementType === 'credit' ? '+' : '-'}
                          {formatBRL(mov.amount)}
                        </span>
                        {mov.canReverse && (
                          <button
                            type="button"
                            title="Estornar lançamento"
                            disabled={isDataLoading}
                            onClick={() => handleReverseMovement(mov.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SurfaceCard>
          </div>
        </>
      )}

      {/* Modal: Cadastrar Benefício */}
      <Modal
        open={isAddBenefitOpen}
        onClose={() => setIsAddBenefitOpen(false)}
        title="Cadastrar Benefício (VR / VA)"
        subtitle="O saldo de benefícios permanece totalmente isolado das contas bancárias"
      >
        <form onSubmit={handleAddBenefit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tipo
              </label>
              <select
                value={newBenType}
                onChange={(e) => setNewBenType(e.target.value as 'VR' | 'VA')}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="VR">Vale-Refeição (VR)</option>
                <option value="VA">Vale-Alimentação (VA)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Titular
              </label>
              <select
                value={newBenPartner}
                onChange={(e) => setNewBenPartner(e.target.value as PartnerId)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="partner_a">{getPartnerName(partners, 'partner_a')}</option>
                <option value="partner_b">{getPartnerName(partners, 'partner_b')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Operadora / Nome do Cartão
            </label>
            <input
              required
              type="text"
              value={newBenProvider}
              onChange={(e) => setNewBenProvider(e.target.value)}
              placeholder="Ex.: Alelo Refeição, Flash, Sodexo..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Crédito / Saldo Inicial (R$)
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={newBenCredit}
              onChange={(e) => setNewBenCredit(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddBenefitOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isDataLoading}
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg"
            >
              Salvar Benefício
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Registrar Compra */}
      <Modal
        open={isPurchaseOpen}
        onClose={() => setIsPurchaseOpen(false)}
        title="Registrar Compra em Benefício (VR / VA)"
        subtitle="Deduz exclusivamente do cartão de benefício selecionado sem alterar contas bancárias"
      >
        <form onSubmit={handlePurchaseSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Cartão de Benefício
            </label>
            <select
              value={selectedBenefitId || benefits[0]?.id || ''}
              onChange={(e) => setSelectedBenefitId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              {benefits.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.providerName} ({getPartnerShortName(partners, b.partnerId)}) — Saldo{' '}
                  {formatBRL(b.currentBalance)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Estabelecimento / Descrição
            </label>
            <input
              required
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Mercado, Restaurante..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="Alimentação e Mercado">Alimentação e Mercado</option>
                <option value="Restaurantes">Restaurantes</option>
                <option value="Padaria e Cafés">Padaria e Cafés</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor (R$)
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Abrangência
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'individual' | 'shared')}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="shared">Consumo Compartilhado (Casal)</option>
              <option value="individual">Consumo Individual</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsPurchaseOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isDataLoading}
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg"
            >
              Registrar no Benefício
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Registrar Crédito (Recarga) */}
      <Modal
        open={isCreditOpen}
        onClose={() => setIsCreditOpen(false)}
        title="Registrar Crédito no Benefício (VR / VA)"
        subtitle="Adiciona saldo ao cartão corporativo sem registrar entrada em contas bancárias"
      >
        <form onSubmit={handleCreditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Cartão de Benefício
            </label>
            <select
              value={creditCardId || benefits[0]?.id || ''}
              onChange={(e) => setCreditCardId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              {benefits.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.providerName} ({getPartnerShortName(partners, b.partnerId)}) — Saldo atual:{' '}
                  {formatBRL(b.currentBalance)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descrição / Origem do Crédito
            </label>
            <input
              required
              type="text"
              value={creditDescription}
              onChange={(e) => setCreditDescription(e.target.value)}
              placeholder="Ex.: Recarga mensal da empresa..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Valor do Crédito (R$)
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreditOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isDataLoading}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg"
            >
              Confirmar Recarga
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
