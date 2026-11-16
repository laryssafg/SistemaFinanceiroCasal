import React, { useMemo, useState } from 'react';
import { Info, Plus } from 'lucide-react';
import {
  HorizontalDistributionBar,
  PatrimonyEvolutionChart,
} from '../components/charts/FinanceCharts';
import { EmptyState } from '../components/ui/FeedbackStates';
import { Modal } from '../components/ui/Modal';
import {
  MetricBlock,
  PageHeader,
  SegmentedControl,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { getPartnerName } from '../services/financeService';
import { InvestmentAsset, PartnerId } from '../types/finance';
import { formatBRL, formatPercent } from '../utils/formatters';

export function InvestimentosPage() {
  const { investments, addInvestment, partners, summary, monthlySeries } =
    useFinance();

  const [scopeFilter, setScopeFilter] = useState<'all' | 'joint' | 'individual'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [assetClass, setAssetClass] = useState<InvestmentAsset['assetClass']>('Renda Fixa');
  const [investmentScope, setInvestmentScope] = useState<'joint' | 'individual'>('joint');
  const [ownerId, setOwnerId] = useState<PartnerId>('partner_a');
  const [isEmergencyReserve, setIsEmergencyReserve] = useState(false);
  const [investedAmount, setInvestedAmount] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [annualReturnPercent, setAnnualReturnPercent] = useState('');
  const [liquidity, setLiquidity] = useState('D+1');

  const isJointAsset = (inv: InvestmentAsset) =>
    inv.scope ? inv.scope === 'joint' : inv.isJointPlanning || inv.ownerId === 'joint';

  const filteredInvestments = useMemo(() => {
    return investments.filter((inv) => {
      const joint = isJointAsset(inv);
      if (scopeFilter === 'joint' && !joint) return false;
      if (scopeFilter === 'individual' && joint) return false;
      return true;
    });
  }, [investments, scopeFilter]);

  const jointTotal = investments
    .filter((i) => isJointAsset(i))
    .reduce((s, i) => s + i.currentBalance, 0);
  const individualTotal = investments
    .filter((i) => !isJointAsset(i))
    .reduce((s, i) => s + i.currentBalance, 0);

  const classDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of investments) {
      map[inv.assetClass] = (map[inv.assetClass] ?? 0) + inv.currentBalance;
    }
    const colors = [
      'bg-navy-900 dark:bg-navy-400',
      'bg-emerald-600 dark:bg-emerald-500',
      'bg-navy-500 dark:bg-navy-300',
      'bg-amber-600 dark:bg-amber-400',
      'bg-slate-500 dark:bg-slate-400',
    ];
    return Object.entries(map).map(([label, value], i) => ({
      label,
      value,
      colorClass: colors[i % colors.length],
    }));
  }, [investments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invVal = Number(investedAmount.replace(',', '.')) || 0;
    const curVal = Number(currentBalance.replace(',', '.')) || invVal;
    const retVal = Number(annualReturnPercent.replace(',', '.')) || 0;
    if (!name.trim() || !institution.trim() || curVal <= 0) return;

    addInvestment({
      name: name.trim(),
      institution: institution.trim(),
      assetClass,
      scope: investmentScope,
      ownerId: investmentScope === 'joint' ? 'joint' : ownerId,
      isJointPlanning: investmentScope === 'joint',
      isEmergencyReserve,
      investedAmount: invVal,
      currentBalance: curVal,
      annualReturnPercent: retVal,
      liquidity,
    });

    setName('');
    setInstitution('');
    setInvestedAmount('');
    setCurrentBalance('');
    setAnnualReturnPercent('');
    setIsEmergencyReserve(false);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investimentos e Patrimônio"
        subtitle="Distribuição por classe de ativo, titularidade, rentabilidade e patrimônio líquido consolidado sem dupla contagem da reserva"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <SegmentedControl
              ariaLabel="Filtrar modalidade de investimentos"
              value={scopeFilter}
              onChange={setScopeFilter}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'joint', label: 'Do Casal' },
                { value: 'individual', label: 'Individuais' },
              ]}
            />
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Investimento
            </button>
          </div>
        }
      />

      <div className="flex items-start gap-3 p-4 rounded-xl bg-navy-50/70 dark:bg-navy-950/50 border border-navy-200/70 dark:border-navy-900 text-xs text-navy-900 dark:text-navy-200">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-navy-700 dark:text-navy-300" />
        <p className="leading-relaxed">
          <strong>Consolidação sem dupla contagem:</strong> Os ativos identificados como{' '}
          <em>Reserva de Emergência</em> ({formatBRL(summary.emergencyReserveBalance)}) integram a carteira total de investimentos ({formatBRL(summary.totalInvestmentsNoDoubleCount)}) e não são somados duas vezes no Patrimônio Bruto ({formatBRL(summary.grossPatrimony)}).
        </p>
      </div>

      <SurfaceCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricBlock
            label="Total Investido (Consolidado)"
            value={formatBRL(summary.totalInvestmentsNoDoubleCount)}
            meta={`Livres: ${formatBRL(summary.freeInvestmentsBalance)} · Reserva: ${formatBRL(summary.emergencyReserveBalance)}`}
          />
          <MetricBlock
            label="Investimentos do Casal"
            value={formatBRL(jointTotal)}
            tone={jointTotal > 0 ? 'positive' : 'neutral'}
            meta="Ativos conjuntos e reserva do casal"
          />
          <MetricBlock
            label="Investimentos Individuais"
            value={formatBRL(individualTotal)}
            meta="Ativos exclusivos por titular"
          />
          <MetricBlock
            label="Patrimônio Líquido Total"
            value={formatBRL(summary.netWorth)}
            meta={`Bruto ${formatBRL(summary.grossPatrimony)} menos passivos`}
          />
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <SurfaceCard className="xl:col-span-7">
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-1">
            Evolução Patrimonial do Casal
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Histórico consolidado de patrimônio bruto e líquido
          </p>
          <PatrimonyEvolutionChart data={monthlySeries} />
        </SurfaceCard>

        <SurfaceCard className="xl:col-span-5">
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-1">
            Distribuição por Classe de Ativo
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Alocação atual da carteira consolidada
          </p>
          <HorizontalDistributionBar segments={classDistribution} />
        </SurfaceCard>
      </div>

      <SurfaceCard padding="none">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
            Posições Cadastradas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Titularidade, liquidez, rentabilidade anual histórica e vínculo com reserva de emergência
          </p>
        </div>
        {filteredInvestments.length === 0 ? (
          <EmptyState
            title="Nenhum investimento cadastrado."
            description="Cadastrem os investimentos individuais ou vinculados ao planejamento conjunto para acompanhar alocação e patrimônio."
            actionLabel="Cadastrar Investimento"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Ativo / Instituição</th>
                  <th className="py-3 px-4">Titularidade e Vínculo</th>
                  <th className="py-3 px-4 text-right">Aplicado</th>
                  <th className="py-3 px-4 text-right">Rentab. 12m</th>
                  <th className="py-3 px-4 text-right">Saldo Atual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredInvestments.map((inv) => {
                  const gain = inv.currentBalance - inv.investedAmount;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-navy-950 dark:text-slate-100">
                          {inv.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {inv.institution} · {inv.assetClass} · Liquidez {inv.liquidity}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-slate-800 dark:text-slate-200">
                          {isJointAsset(inv)
                            ? 'Do Casal (Conjunto)'
                            : getPartnerName(partners, inv.ownerId)}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isJointAsset(inv) ? 'Patrimônio Conjunto' : 'Investimento Individual'}
                          {inv.isEmergencyReserve ? ' · Vinculado à Reserva de Emergência' : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatBRL(inv.investedAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        {inv.annualReturnPercent > 0
                          ? `+${formatPercent(inv.annualReturnPercent, 1)} a.a.`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        <p className="font-semibold text-navy-950 dark:text-white">
                          {formatBRL(inv.currentBalance)}
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          {formatBRL(gain, true)}
                        </p>
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
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Cadastrar Investimento"
        subtitle="Adicione uma posição vinculada à titularidade individual ou planejamento conjunto"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nome do Ativo
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Tesouro Selic, CDB..."
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Corretora / Banco
              </label>
              <input
                required
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Ex.: Corretora..."
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Investimento
              </label>
              <select
                value={investmentScope}
                onChange={(e) =>
                  setInvestmentScope(e.target.value as 'joint' | 'individual')
                }
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="joint">Do Casal (Conjunto)</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            {investmentScope === 'individual' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Titular
                </label>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value as PartnerId)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="partner_a">{getPartnerName(partners, 'partner_a')}</option>
                  <option value="partner_b">{getPartnerName(partners, 'partner_b')}</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Titularidade
                </label>
                <div className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                  Conjunto (Casal)
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Classe de Ativo
            </label>
            <select
              value={assetClass}
              onChange={(e) =>
                setAssetClass(e.target.value as InvestmentAsset['assetClass'])
              }
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="Renda Fixa">Renda Fixa</option>
              <option value="Tesouro Direto">Tesouro Direto</option>
              <option value="Ações & FIIs">Ações & FIIs</option>
              <option value="Internacional">Internacional</option>
              <option value="Previdência">Previdência</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor Aplicado (R$)
              </label>
              <input
                required
                type="number"
                step="0.01"
                value={investedAmount}
                onChange={(e) => setInvestedAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Saldo Atual (R$)
              </label>
              <input
                required
                type="number"
                step="0.01"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Rentab. % a.a. (Opcional)
              </label>
              <input
                type="number"
                step="0.1"
                value={annualReturnPercent}
                onChange={(e) => setAnnualReturnPercent(e.target.value)}
                placeholder="0,0"
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Liquidez
            </label>
            <input
              type="text"
              value={liquidity}
              onChange={(e) => setLiquidity(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="space-y-2 pt-1 text-xs">
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isEmergencyReserve}
                onChange={(e) => setIsEmergencyReserve(e.target.checked)}
                className="rounded border-slate-300"
              />
              Ativo vinculado à Reserva de Emergência (evitar dupla contagem)
            </label>
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
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg"
            >
              Salvar Investimento
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
