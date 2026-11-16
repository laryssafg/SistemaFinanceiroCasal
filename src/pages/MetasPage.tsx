import React, { useState } from 'react';
import { Plus, Target } from 'lucide-react';
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
import { PartnerId } from '../types/finance';
import { formatBRL, formatDateBR, formatPercent } from '../utils/formatters';

export function MetasPage() {
  const { goals, addGoal, partners } = useFinance();
  const [filter, setFilter] = useState<'all' | 'joint' | 'individual'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const defaultDeadline = new Date(
    new Date().setFullYear(new Date().getFullYear() + 1),
  )
    .toISOString()
    .split('T')[0];

  const [title, setTitle] = useState('');
  const [scope, setScope] = useState<'joint' | 'individual'>('joint');
  const [ownerId, setOwnerId] = useState<PartnerId>('partner_a');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [monthlyPlanned, setMonthlyPlanned] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [priority, setPriority] = useState<'Alta' | 'Média' | 'Baixa'>('Média');

  const filtered = goals.filter((g) => (filter === 'all' ? true : g.scope === filter));
  const totalTarget = filtered.reduce((s, g) => s + g.targetAmount, 0);
  const totalCurrent = filtered.reduce((s, g) => s + g.currentAmount, 0);
  const totalMonthlyPlanned = filtered.reduce(
    (s, g) => s + g.monthlyPlannedContribution,
    0,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(targetAmount.replace(',', '.'));
    const current = Number(currentAmount.replace(',', '.')) || 0;
    const monthly = Number(monthlyPlanned.replace(',', '.')) || 0;
    if (!title.trim() || isNaN(target) || target <= 0) return;

    addGoal({
      title: title.trim(),
      scope,
      ownerId: scope === 'individual' ? ownerId : undefined,
      targetAmount: target,
      currentAmount: current,
      monthlyPlannedContribution: monthly,
      deadline,
      priority,
    });

    setTitle('');
    setTargetAmount('');
    setCurrentAmount('');
    setMonthlyPlanned('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas Financeiras"
        subtitle="Objetivos de curto, médio e longo prazo com acompanhamento de aportes planejados e prazos"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <SegmentedControl
              ariaLabel="Filtrar metas"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'joint', label: 'Conjuntas' },
                { value: 'individual', label: 'Individuais' },
              ]}
            />
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Meta
            </button>
          </div>
        }
      />

      <SurfaceCard>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <MetricBlock
            label="Total Acumulado nas Metas"
            value={formatBRL(totalCurrent)}
            tone={totalCurrent > 0 ? 'positive' : 'neutral'}
            meta={
              totalTarget > 0
                ? `${formatPercent((totalCurrent / totalTarget) * 100, 1)} do valor-alvo total`
                : 'Nenhuma meta cadastrada'
            }
          />
          <MetricBlock
            label="Soma dos Valores-Alvo"
            value={formatBRL(totalTarget)}
            meta={`${filtered.length} meta(s) exibida(s)`}
          />
          <MetricBlock
            label="Aportes Mensais Planejados"
            value={formatBRL(totalMonthlyPlanned)}
            meta="Compromisso mensal combinado"
          />
        </div>
      </SurfaceCard>

      {filtered.length === 0 ? (
        <SurfaceCard padding="none">
          <EmptyState
            title="Nenhuma meta financeira cadastrada."
            description="Criem metas conjuntas ou individuais com valor-alvo, prazo e aporte mensal planejado."
            actionLabel="Nova Meta"
            onAction={() => setIsModalOpen(true)}
          />
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((goal) => {
            const pct = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
            const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
            const monthsEst =
              goal.monthlyPlannedContribution > 0
                ? Math.ceil(remaining / goal.monthlyPlannedContribution)
                : null;

            return (
              <SurfaceCard key={goal.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-navy-50 dark:bg-navy-950 border border-navy-100 dark:border-navy-900 flex items-center justify-center text-navy-800 dark:text-navy-300 shrink-0">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-navy-950 dark:text-slate-50">
                        {goal.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {goal.scope === 'joint'
                          ? 'Meta Conjunta (Casal)'
                          : `Individual · ${getPartnerName(partners, goal.ownerId ?? 'partner_a')}`}{' '}
                        · Prioridade {goal.priority}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatPercent(pct, 1)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-mono tabular-nums">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {formatBRL(goal.currentAmount)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Alvo: {formatBRL(goal.targetAmount)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">
                      Aporte mensal planejado
                    </span>
                    <span className="font-mono tabular-nums font-medium text-navy-950 dark:text-slate-100">
                      {formatBRL(goal.monthlyPlannedContribution)} / mês
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 dark:text-slate-400 block">
                      Prazo & Estimativa
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {formatDateBR(goal.deadline)}
                      {monthsEst !== null ? ` (~${monthsEst}m)` : ''}
                    </span>
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Criar Nova Meta Financeira"
        subtitle="Defina valor-alvo, prazo e aporte mensal planejado"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome da Meta
            </label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Entrada Imóvel, Viagem..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Meta
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'joint' | 'individual')}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="joint">Conjunta (Casal)</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            {scope === 'individual' ? (
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
                  Prioridade
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'Alta' | 'Média' | 'Baixa')}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="Alta">Alta</option>
                  <option value="Média">Média</option>
                  <option value="Baixa">Baixa</option>
                </select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor-Alvo (R$)
              </label>
              <input
                required
                type="number"
                step="10"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Já Acumulado (R$)
              </label>
              <input
                type="number"
                step="10"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Aporte Mensal (R$)
              </label>
              <input
                required
                type="number"
                step="10"
                value={monthlyPlanned}
                onChange={(e) => setMonthlyPlanned(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Prazo Alvo
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
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
              Salvar Meta
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
