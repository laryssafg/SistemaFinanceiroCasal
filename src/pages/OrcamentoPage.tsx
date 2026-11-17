import React, { useState } from 'react';
import { AlertTriangle, CalendarSync, Plus, SlidersHorizontal } from 'lucide-react';
import { EmptyState } from '../components/ui/FeedbackStates';
import { Modal } from '../components/ui/Modal';
import {
  MetricBlock,
  PageHeader,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { BudgetCategory } from '../types/finance';
import { formatBRL, formatPercent } from '../utils/formatters';

export function OrcamentoPage() {
  const { budgets, addBudgetCategory, summary, updateBudgetLimit } = useFinance();
  const [editingBudget, setEditingBudget] = useState<BudgetCategory | null>(null);
  const [newLimitInput, setNewLimitInput] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatLimit, setNewCatLimit] = useState('');
  const [newCatEssential, setNewCatEssential] = useState(true);

  const availableTotal =
    summary.budgetLimitTotal - summary.budgetUsedConfirmed - summary.budgetCommittedPending;

  const openEditModal = (b: BudgetCategory) => {
    setEditingBudget(b);
    setNewLimitInput(b.monthlyLimit.toFixed(2));
  };

  const handleSaveLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;
    const val = Number(newLimitInput.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    updateBudgetLimit(editingBudget.id, val);
    setEditingBudget(null);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = Number(newCatLimit.replace(',', '.'));
    if (!newCatName.trim() || isNaN(limit) || limit <= 0) return;
    addBudgetCategory({
      category: newCatName.trim(),
      monthlyLimit: limit,
      spentConfirmed: 0,
      committedPending: 0,
      previousMonthSpent: 0,
      isEssential: newCatEssential,
    });
    setNewCatName('');
    setNewCatLimit('');
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orçamento Mensal Conjunto"
        subtitle="Limites por categoria, valores utilizados (confirmados), comprometidos (pendentes) e comparação com mês anterior"
        actions={
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Categoria
          </button>
        }
      />

      <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
        <CalendarSync className="w-4 h-4 shrink-0 mt-0.5 text-navy-700 dark:text-navy-300" />
        <p className="leading-relaxed">
          <strong>Reinício mensal automático:</strong> Os tetos do orçamento reiniciam integralmente no dia 1º de cada mês, sem transportar automaticamente saldos não utilizados de competências anteriores.
        </p>
      </div>

      <SurfaceCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricBlock
            label="Limite Mensal Planejado"
            value={formatBRL(summary.budgetLimitTotal)}
            meta={
              budgets.length === 0
                ? 'Nenhuma categoria configurada'
                : `${budgets.length} categoria(s) ativa(s)`
            }
          />
          <MetricBlock
            label="Utilizado (Confirmado)"
            value={formatBRL(summary.budgetUsedConfirmed)}
            meta="Despesas já efetivadas no mês"
          />
          <MetricBlock
            label="Comprometido (Pendente)"
            value={formatBRL(summary.budgetCommittedPending)}
            tone={summary.budgetCommittedPending > 0 ? 'warning' : 'neutral'}
            meta="Lançamentos agendados e parcelas"
          />
          <MetricBlock
            label="Saldo Disponível no Orçamento"
            value={formatBRL(availableTotal)}
            tone={availableTotal > 0 ? 'positive' : availableTotal < 0 ? 'negative' : 'neutral'}
            meta="Após deduzir utilizado e comprometido"
          />
        </div>
      </SurfaceCard>

      <SurfaceCard padding="none">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
              Detalhamento por Categoria
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Limites mensais e comparação com competência anterior
            </p>
          </div>
        </div>

        {budgets.length === 0 ? (
          <EmptyState
            title="Nenhuma categoria de orçamento configurada."
            description="Cadastrem os limites mensais por categoria para acompanhar gastos confirmados, comprometidos e alertas de excesso."
            actionLabel="Adicionar Categoria"
            onAction={() => setIsAddOpen(true)}
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {budgets.map((b) => {
              const totalCommitted = b.spentConfirmed + b.committedPending;
              const available = b.monthlyLimit - totalCommitted;
              const confirmedPct = Math.min(100, (b.spentConfirmed / b.monthlyLimit) * 100);
              const pendingPct = Math.min(
                100 - confirmedPct,
                (b.committedPending / b.monthlyLimit) * 100,
              );
              const totalPct = (totalCommitted / b.monthlyLimit) * 100;
              const isWarning = totalPct >= 85;
              const isOver = totalCommitted > b.monthlyLimit;

              return (
                <div key={b.id} className="p-5 sm:px-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-navy-950 dark:text-slate-100">
                          {b.category}
                        </h3>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          · {b.isEssential ? 'Despesa essencial' : 'Estilo de vida'}
                        </span>
                        {isWarning && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 dark:text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            {isOver ? 'Limite excedido' : 'Próximo do limite'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        Mês anterior: {b.previousMonthSpent > 0 ? formatBRL(b.previousMonthSpent) : 'Sem dados'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right text-xs font-mono tabular-nums">
                        <p className="font-semibold text-navy-950 dark:text-white">
                          {formatBRL(totalCommitted)} / {formatBRL(b.monthlyLimit)}
                        </p>
                        <p
                          className={
                            available < 0
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }
                        >
                          {available >= 0
                            ? `Disponível: ${formatBRL(available)}`
                            : `Excesso: ${formatBRL(Math.abs(available))}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openEditModal(b)}
                        aria-label={`Editar limite de ${b.category}`}
                        className="p-2 text-slate-500 hover:text-navy-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full ${
                        isOver
                          ? 'bg-red-600 dark:bg-red-500'
                          : 'bg-navy-800 dark:bg-navy-400'
                      }`}
                      style={{ width: `${confirmedPct}%` }}
                    />
                    <div
                      className="h-full bg-amber-500/80 dark:bg-amber-400/80"
                      style={{ width: `${pendingPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>
                      Confirmado: {formatBRL(b.spentConfirmed)} · Comprometido:{' '}
                      {formatBRL(b.committedPending)}
                    </span>
                    <span>{formatPercent(totalPct, 1)} utilizado</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      <Modal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Adicionar Categoria de Orçamento"
        subtitle="Os limites reiniciam mensalmente sem acúmulo automático"
      >
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome da Categoria
            </label>
            <input
              required
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Ex.: Moradia, Alimentação, Saúde..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Limite Mensal (R$)
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={newCatLimit}
              onChange={(e) => setNewCatLimit(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={newCatEssential}
              onChange={(e) => setNewCatEssential(e.target.checked)}
              className="rounded border-slate-300"
            />
            Categoria de despesa essencial
          </label>
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
              Salvar Categoria
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editingBudget !== null}
        onClose={() => setEditingBudget(null)}
        title="Ajustar Limite Mensal"
        subtitle={editingBudget?.category}
      >
        <form onSubmit={handleSaveLimit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Novo Limite Mensal (R$)
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={newLimitInput}
              onChange={(e) => setNewLimitInput(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingBudget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg"
            >
              Salvar Limite
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
