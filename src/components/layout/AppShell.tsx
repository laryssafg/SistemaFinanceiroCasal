import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CreditCard,
  FileSearch,
  Handshake,
  Landmark,
  LayoutDashboard,
  Menu,
  Moon,
  PieChart,
  Scale,
  Settings,
  ShieldCheck,
  Sun,
  Target,
  TrendingUp,
  Utensils,
  WalletCards,
  X,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { getCurrentReferenceMonthLabel } from '../../data/mockData';
import { NavSectionId } from '../../types/finance';
import { PartnerAvatar } from '../ui/FeedbackStates';

export interface NavItemConfig {
  id: NavSectionId;
  label: string;
  group: 'Operação' | 'Planejamento' | 'Patrimônio' | 'Governança';
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Operação', icon: LayoutDashboard },
  { id: 'movimentacoes', label: 'Movimentações', group: 'Operação', icon: ArrowLeftRight },
  { id: 'contas', label: 'Contas bancárias', group: 'Operação', icon: Landmark },
  { id: 'cartoes', label: 'Cartões de crédito', group: 'Operação', icon: CreditCard },
  { id: 'beneficios', label: 'Benefícios VR/VA', group: 'Operação', icon: Utensils },

  { id: 'orcamento', label: 'Orçamento mensal', group: 'Planejamento', icon: PieChart },
  { id: 'divisao', label: 'Divisão proporcional', group: 'Planejamento', icon: Scale },
  { id: 'acertos', label: 'Acertos entre o casal', group: 'Planejamento', icon: Handshake },

  { id: 'reserva', label: 'Reserva de emergência', group: 'Patrimônio', icon: ShieldCheck },
  { id: 'investimentos', label: 'Investimentos', group: 'Patrimônio', icon: TrendingUp },
  { id: 'metas', label: 'Metas financeiras', group: 'Patrimônio', icon: Target },
  { id: 'dividas', label: 'Dívidas e financiamentos', group: 'Patrimônio', icon: WalletCards },

  { id: 'relatorios', label: 'Relatórios', group: 'Governança', icon: BarChart3 },
  { id: 'alertas', label: 'Alertas', group: 'Governança', icon: Bell },
  { id: 'auditoria', label: 'Histórico e auditoria', group: 'Governança', icon: FileSearch },
  { id: 'configuracoes', label: 'Configurações', group: 'Governança', icon: Settings },
];

const NAV_GROUPS: NavItemConfig['group'][] = [
  'Operação',
  'Planejamento',
  'Patrimônio',
  'Governança',
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    activePage,
    setActivePage,
    theme,
    toggleTheme,
    partners,
    alerts,
    toastMessage,
    setIsAuthDemoOpen,
  } = useFinance();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentMonthLabel = getCurrentReferenceMonthLabel();

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const unreadAlertsCount = alerts.filter((a) => !a.read).length;
  const activeItem = NAV_ITEMS.find((i) => i.id === activePage) ?? NAV_ITEMS[0];

  const handleNavigate = (id: NavSectionId) => {
    setActivePage(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sidebar Desktop (256px) */}
      <aside
        aria-label="Navegação principal"
        className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30"
      >
        <div className="h-14 px-5 flex items-center border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="text-left focus-visible:outline-2 focus-visible:outline-navy-700 rounded"
          >
            <span className="font-display text-[15px] font-bold tracking-tight text-navy-950 dark:text-white whitespace-nowrap">
              Sistema Financeiro do Casal
            </span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((groupName) => {
            const groupItems = NAV_ITEMS.filter((i) => i.group === groupName);
            return (
              <div key={groupName} className="space-y-1">
                <p className="px-3 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  {groupName}
                </p>
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-navy-700 ${
                        isActive
                          ? 'bg-navy-900 text-white dark:bg-navy-600 font-medium'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-navy-950 dark:hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.id === 'alertas' && unreadAlertsCount > 0 && (
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            isActive
                              ? 'text-white/90'
                              : 'text-red-700 dark:text-red-400 font-semibold'
                          }`}
                        >
                          {unreadAlertsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setIsAuthDemoOpen(true)}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left"
          >
            <div className="flex -space-x-2 shrink-0">
              <PartnerAvatar
                src={partners.find((p) => p.id === 'partner_a')?.photoDataUrl}
                name={partners.find((p) => p.id === 'partner_a')?.name}
                size="sm"
              />
              <PartnerAvatar
                src={partners.find((p) => p.id === 'partner_b')?.photoDataUrl}
                name={partners.find((p) => p.id === 'partner_b')?.name}
                size="sm"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-navy-950 dark:text-slate-100 truncate">
                {partners.some((p) => p.name.trim())
                  ? partners
                      .filter((p) => p.name.trim())
                      .map((p) => p.shortName)
                      .join(' & ')
                  : 'Perfis não configurados'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Prévia de desenvolvimento
              </p>
            </div>
          </button>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (limpo, 1 linha, altura compacta no mobile) */}
        <header className="sticky top-0 z-20 h-12 lg:h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="lg:hidden font-display text-sm font-bold text-navy-950 dark:text-white truncate">
              {activeItem.label}
            </span>
            <span className="hidden lg:inline text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {activeItem.group} /{' '}
              <strong className="font-medium text-navy-950 dark:text-slate-100">
                {activeItem.label}
              </strong>
            </span>
            <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
              · {currentMonthLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('configuracoes')}
              className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-navy-950 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Configurações
            </button>
          </div>
        </header>

        {/* Conteúdo da página */}
        <main className="flex-1 w-full max-w-[1220px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Navegação Inferior no Celular (<= 15% altura viewport com top bar) */}
      <nav
        aria-label="Navegação rápida móvel"
        className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-30 grid grid-cols-5"
      >
        {(
          [
            { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
            { id: 'movimentacoes', label: 'Extrato', icon: ArrowLeftRight },
            { id: 'cartoes', label: 'Cartões', icon: CreditCard },
            { id: 'divisao', label: 'Divisão', icon: Scale },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activePage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleNavigate(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] min-h-[44px] ${
                active
                  ? 'text-navy-900 dark:text-navy-300 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[68px]">{tab.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] min-h-[44px] ${
            mobileMenuOpen
              ? 'text-navy-900 dark:text-navy-300 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Menu className="w-4 h-4" />
          <span>Módulos</span>
        </button>
      </nav>

      {/* Drawer de todos os 16 módulos no celular */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Todos os módulos"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-white dark:bg-slate-900 h-full overflow-y-auto p-5 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-display text-sm font-bold text-navy-950 dark:text-white">
                Sistema Financeiro do Casal
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {NAV_GROUPS.map((groupName) => {
              const items = NAV_ITEMS.filter((i) => i.group === groupName);
              return (
                <div key={groupName} className="space-y-1">
                  <p className="px-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    {groupName}
                  </p>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-xs rounded-lg min-h-[44px] ${
                          isActive
                            ? 'bg-navy-900 text-white dark:bg-navy-600 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </span>
                        {item.id === 'alertas' && unreadAlertsCount > 0 && (
                          <span className="font-mono text-[11px]">{unreadAlertsCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast discreto de confirmação */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-18 lg:bottom-6 right-4 sm:right-6 z-50 max-w-sm px-4 py-3 rounded-xl bg-navy-950 dark:bg-slate-800 text-white text-xs font-medium shadow-lg border border-navy-800 dark:border-slate-700"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
