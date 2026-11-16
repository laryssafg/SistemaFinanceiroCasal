import {
  AuditLogEntry,
  BankAccount,
  BenefitCard,
  BudgetCategory,
  CoupleSettlement,
  CreditCard,
  CreditCardInstallment,
  DebtItem,
  EmergencyReserveConfig,
  EmergencyReserveMovement,
  FinancialGoal,
  InvestmentAsset,
  MonthlySeriesPoint,
  PartnerProfile,
  ProportionalMonthHistory,
  SharedResponsibilityItem,
  SystemAlert,
  Transaction,
} from '../types/finance';

/**
 * ESTADO INICIAL VAZIO — PREPARADO PARA INTEGRAÇÃO COM SUPABASE
 * Todos os dados demonstrativos e fictícios foram removidos.
 * As coleções iniciam vazias até que perfis e registros reais sejam cadastrados.
 */

export const DEVELOPMENT_PREVIEW_NOTICE =
  'Prévia de desenvolvimento com base vazia. A persistência definitiva e autenticação serão conectadas ao Supabase.';

export function getCurrentReferenceMonthLabel(): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export const INITIAL_PARTNERS: PartnerProfile[] = [];
export const INITIAL_BANK_ACCOUNTS: BankAccount[] = [];
export const INITIAL_BENEFIT_CARDS: BenefitCard[] = [];
export const INITIAL_CREDIT_CARDS: CreditCard[] = [];
export const INITIAL_CREDIT_CARD_INSTALLMENTS: CreditCardInstallment[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
export const INITIAL_BUDGET_CATEGORIES: BudgetCategory[] = [];
export const INITIAL_PROPORTIONAL_HISTORY: ProportionalMonthHistory[] = [];
export const INITIAL_SHARED_RESPONSIBILITIES: SharedResponsibilityItem[] = [];
export const INITIAL_SETTLEMENTS: CoupleSettlement[] = [];

export const INITIAL_EMERGENCY_RESERVE_CONFIG: EmergencyReserveConfig = {
  isConfigured: false,
  essentialMonthlyBaseline: 0,
  targetMonths: 12,
  targetAmount: 0,
  currentAmount: 0,
  monthlyPlannedDeposit: 0,
  partnerATotalContributed: 0,
  partnerBTotalContributed: 0,
};

export const INITIAL_EMERGENCY_MOVEMENTS: EmergencyReserveMovement[] = [];
export const INITIAL_INVESTMENTS: InvestmentAsset[] = [];
export const INITIAL_GOALS: FinancialGoal[] = [];
export const INITIAL_DEBTS: DebtItem[] = [];
export const INITIAL_MONTHLY_SERIES: MonthlySeriesPoint[] = [];
export const INITIAL_ALERTS: SystemAlert[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];
