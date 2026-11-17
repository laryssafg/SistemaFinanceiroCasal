/**
 * Tipos do Banco de Dados Relacional Supabase
 * Gerado a partir das migrações SQL (supabase/migrations/)
 *
 * Convenções:
 * - Valores monetários em BIGINT (centavos): R$ 100,00 = 10000
 * - Percentuais em basis points: 100.00% = 10000
 * - Datas como ISO strings; competência como 'YYYY-MM'
 * - UUIDs como strings
 */

// ============================================================================
// Tipos utilitários
// ============================================================================

export type UUID = string;
export type ISOTimestamp = string;
export type ISODate = string;
export type CompetenceMonth = string; // 'YYYY-MM'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================================
// Enums do domínio
// ============================================================================

export type PartnerRole = 'partner_a' | 'partner_b';

export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer_in'
  | 'transfer_out'
  | 'invoice_payment'
  | 'refund'
  | 'opening_balance_adj';

export type TransactionStatus = 'confirmed' | 'pending' | 'scheduled' | 'cancelled';

export type PaymentMethod = 'pix' | 'debit' | 'credit_card' | 'transfer' | 'vr' | 'va' | 'boleto';

export type ExpenseScope = 'individual' | 'shared';

export type AccountType = 'checking' | 'savings' | 'digital';

export type BenefitType = 'VR' | 'VA';

export type CardBrand = 'Mastercard' | 'Visa' | 'Elo' | 'Amex' | 'Hipercard';

export type SplitRuleMode = 'proportional' | 'single_earner' | 'manual' | 'unconfigured';

export type InvoiceStatus = 'open' | 'closed' | 'paid' | 'partially_paid';

export type FiscalPeriodStatus = 'open' | 'closed' | 'reopened';

export type AssetClass = 'renda_fixa' | 'tesouro_direto' | 'acoes_fiis' | 'internacional' | 'previdencia';

export type InvestmentMovementType = 'contribution' | 'withdrawal' | 'yield_update';

export type ReserveMovementType = 'deposit' | 'withdrawal';

export type GoalPriority = 'alta' | 'media' | 'baixa';

export type GoalStatus = 'active' | 'completed' | 'cancelled';

export type DebtStatus = 'active' | 'paid_off' | 'renegotiated' | 'cancelled';

export type DebtInstallmentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AuditActorType = 'member' | 'system';

export type ThemeMode = 'light' | 'dark';

export type RecurrenceFrequency = 'monthly' | 'biweekly' | 'weekly' | 'annual';

export type PurchaseStatus = 'active' | 'cancelled' | 'refunded';

export type SettlementStatus = 'pending' | 'settled' | 'partially_settled' | 'cancelled';

export type SharedResponsibilityStatus = 'pending' | 'settled';

export type BenefitMovementType = 'credit' | 'purchase';

// ============================================================================
// Row types (refletem as tabelas SQL)
// ============================================================================

export interface HouseholdRow {
  id: UUID;
  display_name: string;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface HouseholdMemberRow {
  id: UUID;
  household_id: UUID;
  auth_user_id: UUID | null;
  partner_role: PartnerRole;
  display_name: string;
  short_name: string;
  email: string;
  role_label: string;
  photo_url: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface HouseholdSettingsRow {
  id: UUID;
  household_id: UUID;
  default_closing_day: number;
  auto_monthly_reset: boolean;
  require_transfer_for_settlement: boolean;
  theme: ThemeMode;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface BankAccountRow {
  id: UUID;
  household_id: UUID;
  member_id: UUID;
  institution: string;
  account_name: string;
  account_type: AccountType;
  opening_balance: number; // centavos
  is_active: boolean;
  is_emergency_reserve: boolean;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface TransactionRow {
  id: UUID;
  household_id: UUID;
  member_id: UUID;
  account_id: UUID | null;
  card_id: UUID | null;
  benefit_card_id: UUID | null;
  transaction_type: TransactionType;
  status: TransactionStatus;
  scope: ExpenseScope;
  payment_method: PaymentMethod;
  amount: number; // centavos
  paid_amount: number | null;
  description: string;
  category: string;
  notes: string | null;
  transaction_date: ISODate;
  competence_month: CompetenceMonth;
  installment_current: number | null;
  installment_total: number | null;
  is_recurring: boolean;
  recurrence_rule_id: UUID | null;
  refunded_transaction_id: UUID | null;
  transfer_pair_id: UUID | null;
  created_by: UUID | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface BenefitCardRow {
  id: UUID;
  household_id: UUID;
  member_id: UUID;
  benefit_type: BenefitType;
  provider_name: string;
  monthly_credit: number; // centavos
  is_active: boolean;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface BenefitMovementRow {
  id: UUID;
  household_id: UUID;
  benefit_card_id: UUID;
  movement_type: BenefitMovementType;
  amount: number; // centavos
  description: string;
  category: string | null;
  movement_date: ISODate;
  competence_month: CompetenceMonth;
  linked_transaction_id: UUID | null;
  created_by: UUID | null;
  created_at: ISOTimestamp;
}

export interface CreditCardRow {
  id: UUID;
  household_id: UUID;
  owner_id: UUID;
  additional_holder_id: UUID | null;
  card_name: string;
  bank: string;
  brand: CardBrand;
  credit_limit: number; // centavos
  closing_day: number;
  due_day: number;
  last_four_digits: string;
  additional_last_four: string | null;
  is_active: boolean;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface CreditCardInvoiceRow {
  id: UUID;
  household_id: UUID;
  card_id: UUID;
  reference_month: CompetenceMonth;
  status: InvoiceStatus;
  total_amount: number; // centavos
  paid_amount: number;
  due_date: ISODate | null;
  closed_at: ISOTimestamp | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface CreditCardPurchaseRow {
  id: UUID;
  household_id: UUID;
  card_id: UUID;
  buyer_id: UUID;
  is_additional_card: boolean;
  scope: ExpenseScope;
  description: string;
  category: string;
  purchase_date: ISODate;
  total_amount: number; // centavos
  total_installments: number;
  status: PurchaseStatus;
  refunded_purchase_id: UUID | null;
  created_by: UUID | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface CreditCardInstallmentRow {
  id: UUID;
  household_id: UUID;
  purchase_id: UUID;
  invoice_id: UUID | null;
  installment_number: number;
  installment_amount: number; // centavos
  due_month: CompetenceMonth;
  created_at: ISOTimestamp;
}

export interface InvoicePaymentRow {
  id: UUID;
  household_id: UUID;
  invoice_id: UUID;
  account_id: UUID;
  transaction_id: UUID | null;
  amount: number; // centavos
  payment_date: ISODate;
  created_by: UUID | null;
  created_at: ISOTimestamp;
}

export interface ProportionalPeriodRow {
  id: UUID;
  household_id: UUID;
  competence_month: CompetenceMonth;
  partner_a_income: number; // centavos
  partner_b_income: number;
  partner_a_percent: number; // basis points (10000 = 100%)
  partner_b_percent: number;
  split_mode: SplitRuleMode;
  total_shared: number; // centavos
  status: 'open' | 'closed';
  recalc_version: number;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface SharedResponsibilityRow {
  id: UUID;
  household_id: UUID;
  period_id: UUID;
  transaction_id: UUID | null;
  description: string;
  category: string;
  responsibility_date: ISODate;
  total_amount: number; // centavos
  paid_by_member_id: UUID;
  partner_a_share: number; // centavos
  partner_b_share: number;
  applied_a_percent: number; // basis points
  applied_b_percent: number;
  status: SharedResponsibilityStatus;
  recalc_version: number;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface CoupleSettlementRow {
  id: UUID;
  household_id: UUID;
  period_id: UUID | null;
  reference_month: CompetenceMonth;
  from_member_id: UUID;
  to_member_id: UUID;
  amount: number; // centavos
  description: string;
  status: SettlementStatus;
  settled_amount: number;
  settled_date: ISODate | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface SettlementTransferRow {
  id: UUID;
  household_id: UUID;
  settlement_id: UUID;
  transaction_id: UUID;
  amount: number; // centavos
  transfer_date: ISODate;
  created_at: ISOTimestamp;
}

export interface BudgetCategoryRow {
  id: UUID;
  household_id: UUID;
  category_name: string;
  is_essential: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface MonthlyBudgetRow {
  id: UUID;
  household_id: UUID;
  competence_month: CompetenceMonth;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface BudgetCategoryLimitRow {
  id: UUID;
  budget_id: UUID;
  category_id: UUID;
  monthly_limit: number; // centavos
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface RecurrenceRuleRow {
  id: UUID;
  household_id: UUID;
  member_id: UUID;
  description: string;
  category: string;
  transaction_type: 'income' | 'expense';
  scope: ExpenseScope;
  payment_method: PaymentMethod;
  amount: number; // centavos
  frequency: RecurrenceFrequency;
  day_of_month: number | null;
  account_id: UUID | null;
  card_id: UUID | null;
  start_date: ISODate;
  end_date: ISODate | null;
  is_active: boolean;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface InvestmentAssetRow {
  id: UUID;
  household_id: UUID;
  owner_id: UUID | null;
  asset_name: string;
  institution: string;
  asset_class: AssetClass;
  scope: 'individual' | 'joint';
  is_joint_planning: boolean;
  is_emergency_reserve: boolean;
  invested_amount: number; // centavos
  annual_return_bps: number;
  liquidity: string;
  is_active: boolean;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface InvestmentMovementRow {
  id: UUID;
  household_id: UUID;
  asset_id: UUID;
  member_id: UUID | null;
  movement_type: InvestmentMovementType;
  amount: number; // centavos
  account_id: UUID | null;
  transaction_id: UUID | null;
  movement_date: ISODate;
  notes: string | null;
  created_at: ISOTimestamp;
}

export interface InvestmentValuationRow {
  id: UUID;
  asset_id: UUID;
  valuation_date: ISODate;
  balance: number; // centavos
  created_at: ISOTimestamp;
}

export interface EmergencyReserveConfigRow {
  id: UUID;
  household_id: UUID;
  is_configured: boolean;
  linked_asset_id: UUID | null;
  linked_account_id: UUID | null;
  essential_monthly_baseline: number; // centavos
  target_months: number;
  target_amount: number;
  monthly_planned_deposit: number;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface EmergencyReserveMovementRow {
  id: UUID;
  household_id: UUID;
  config_id: UUID;
  member_id: UUID;
  movement_type: ReserveMovementType;
  amount: number; // centavos
  reason: string | null;
  destination_or_origin: string;
  investment_movement_id: UUID | null;
  transaction_id: UUID | null;
  movement_date: ISODate;
  created_at: ISOTimestamp;
}

export interface FinancialGoalRow {
  id: UUID;
  household_id: UUID;
  owner_id: UUID | null;
  title: string;
  scope: 'joint' | 'individual';
  target_amount: number; // centavos
  monthly_planned_contribution: number;
  deadline: ISODate | null;
  priority: GoalPriority;
  status: GoalStatus;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface GoalContributionRow {
  id: UUID;
  goal_id: UUID;
  member_id: UUID | null;
  amount: number; // centavos
  contribution_date: ISODate;
  transaction_id: UUID | null;
  notes: string | null;
  created_at: ISOTimestamp;
}

export interface DebtRow {
  id: UUID;
  household_id: UUID;
  responsible_id: UUID | null;
  title: string;
  creditor: string;
  scope: 'individual' | 'joint';
  original_amount: number; // centavos
  monthly_interest_rate_bps: number;
  total_installments: number;
  installment_value: number; // centavos
  start_date: ISODate;
  status: DebtStatus;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface DebtInstallmentRow {
  id: UUID;
  debt_id: UUID;
  installment_number: number;
  due_date: ISODate;
  principal_amount: number; // centavos
  interest_amount: number;
  total_amount: number;
  status: DebtInstallmentStatus;
  paid_date: ISODate | null;
  paid_amount: number | null;
  transaction_id: UUID | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface FiscalPeriodRow {
  id: UUID;
  household_id: UUID;
  competence_month: CompetenceMonth;
  status: FiscalPeriodStatus;
  close_version: number;
  closed_at: ISOTimestamp | null;
  closed_by: UUID | null;
  reopened_at: ISOTimestamp | null;
  reopened_by: UUID | null;
  reopen_reason: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface FiscalSnapshotRow {
  id: UUID;
  period_id: UUID;
  snapshot_version: number;
  total_income: number;
  total_expenses: number;
  total_bank_balance: number;
  total_benefits_balance: number;
  total_investments: number;
  emergency_reserve: number;
  total_debts: number;
  gross_patrimony: number;
  net_worth: number;
  partner_a_income: number;
  partner_b_income: number;
  partner_a_percent: number;
  partner_b_percent: number;
  total_shared: number;
  pending_settlements: number;
  extra_data: Json | null;
  created_at: ISOTimestamp;
}

export interface SystemAlertRow {
  id: UUID;
  household_id: UUID;
  title: string;
  description: string;
  severity: AlertSeverity;
  module: string;
  alert_date: ISODate;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: ISOTimestamp;
}

export interface AuditLogRow {
  id: UUID;
  household_id: UUID;
  actor_member_id: UUID | null;
  actor_type: AuditActorType;
  action: string;
  entity_type: string;
  entity_id: UUID | null;
  old_values: Json | null;
  new_values: Json | null;
  module: string | null;
  reason: string | null;
  ip_or_origin: string | null;
  logged_at: ISOTimestamp;
}

export interface MonthlySeriesRow {
  id: UUID;
  household_id: UUID;
  competence_month: CompetenceMonth;
  total_income: number;
  total_expenses: number;
  patrimony: number;
  net_worth: number;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

// ============================================================================
// Database schema type para Supabase client
// ============================================================================

export interface Database {
  public: {
    Tables: {
      households: {
        Row: HouseholdRow;
        Insert: Partial<HouseholdRow> & Pick<HouseholdRow, 'display_name'>;
        Update: Partial<HouseholdRow>;
      };
      household_members: {
        Row: HouseholdMemberRow;
        Insert: Partial<HouseholdMemberRow> & Pick<HouseholdMemberRow, 'household_id' | 'partner_role'>;
        Update: Partial<HouseholdMemberRow>;
      };
      household_settings: {
        Row: HouseholdSettingsRow;
        Insert: Partial<HouseholdSettingsRow> & Pick<HouseholdSettingsRow, 'household_id'>;
        Update: Partial<HouseholdSettingsRow>;
      };
      bank_accounts: {
        Row: BankAccountRow;
        Insert: Partial<BankAccountRow> & Pick<BankAccountRow, 'household_id' | 'member_id' | 'institution' | 'account_name' | 'account_type'>;
        Update: Partial<BankAccountRow>;
      };
      transactions: {
        Row: TransactionRow;
        Insert: Partial<TransactionRow> & Pick<TransactionRow, 'household_id' | 'member_id' | 'transaction_type' | 'amount' | 'competence_month'>;
        Update: Partial<TransactionRow>;
      };
      benefit_cards: {
        Row: BenefitCardRow;
        Insert: Partial<BenefitCardRow> & Pick<BenefitCardRow, 'household_id' | 'member_id' | 'benefit_type' | 'provider_name'>;
        Update: Partial<BenefitCardRow>;
      };
      benefit_movements: {
        Row: BenefitMovementRow;
        Insert: Partial<BenefitMovementRow> & Pick<BenefitMovementRow, 'household_id' | 'benefit_card_id' | 'movement_type' | 'amount' | 'competence_month'>;
        Update: Partial<BenefitMovementRow>;
      };
      credit_cards: {
        Row: CreditCardRow;
        Insert: Partial<CreditCardRow> & Pick<CreditCardRow, 'household_id' | 'owner_id' | 'card_name' | 'bank' | 'brand' | 'closing_day' | 'due_day' | 'last_four_digits'>;
        Update: Partial<CreditCardRow>;
      };
      credit_card_invoices: {
        Row: CreditCardInvoiceRow;
        Insert: Partial<CreditCardInvoiceRow> & Pick<CreditCardInvoiceRow, 'household_id' | 'card_id' | 'reference_month'>;
        Update: Partial<CreditCardInvoiceRow>;
      };
      credit_card_purchases: {
        Row: CreditCardPurchaseRow;
        Insert: Partial<CreditCardPurchaseRow> & Pick<CreditCardPurchaseRow, 'household_id' | 'card_id' | 'buyer_id' | 'description' | 'total_amount'>;
        Update: Partial<CreditCardPurchaseRow>;
      };
      credit_card_installments: {
        Row: CreditCardInstallmentRow;
        Insert: Partial<CreditCardInstallmentRow> & Pick<CreditCardInstallmentRow, 'household_id' | 'purchase_id' | 'installment_number' | 'installment_amount' | 'due_month'>;
        Update: Partial<CreditCardInstallmentRow>;
      };
      invoice_payments: {
        Row: InvoicePaymentRow;
        Insert: Partial<InvoicePaymentRow> & Pick<InvoicePaymentRow, 'household_id' | 'invoice_id' | 'account_id' | 'amount'>;
        Update: Partial<InvoicePaymentRow>;
      };
      proportional_periods: {
        Row: ProportionalPeriodRow;
        Insert: Partial<ProportionalPeriodRow> & Pick<ProportionalPeriodRow, 'household_id' | 'competence_month'>;
        Update: Partial<ProportionalPeriodRow>;
      };
      shared_responsibilities: {
        Row: SharedResponsibilityRow;
        Insert: Partial<SharedResponsibilityRow> & Pick<SharedResponsibilityRow, 'household_id' | 'period_id' | 'description' | 'total_amount' | 'paid_by_member_id' | 'partner_a_share' | 'partner_b_share' | 'applied_a_percent' | 'applied_b_percent'>;
        Update: Partial<SharedResponsibilityRow>;
      };
      couple_settlements: {
        Row: CoupleSettlementRow;
        Insert: Partial<CoupleSettlementRow> & Pick<CoupleSettlementRow, 'household_id' | 'reference_month' | 'from_member_id' | 'to_member_id' | 'amount'>;
        Update: Partial<CoupleSettlementRow>;
      };
      settlement_transfers: {
        Row: SettlementTransferRow;
        Insert: Partial<SettlementTransferRow> & Pick<SettlementTransferRow, 'household_id' | 'settlement_id' | 'transaction_id' | 'amount'>;
        Update: Partial<SettlementTransferRow>;
      };
      budget_categories: {
        Row: BudgetCategoryRow;
        Insert: Partial<BudgetCategoryRow> & Pick<BudgetCategoryRow, 'household_id' | 'category_name'>;
        Update: Partial<BudgetCategoryRow>;
      };
      monthly_budgets: {
        Row: MonthlyBudgetRow;
        Insert: Partial<MonthlyBudgetRow> & Pick<MonthlyBudgetRow, 'household_id' | 'competence_month'>;
        Update: Partial<MonthlyBudgetRow>;
      };
      budget_category_limits: {
        Row: BudgetCategoryLimitRow;
        Insert: Partial<BudgetCategoryLimitRow> & Pick<BudgetCategoryLimitRow, 'budget_id' | 'category_id'>;
        Update: Partial<BudgetCategoryLimitRow>;
      };
      recurrence_rules: {
        Row: RecurrenceRuleRow;
        Insert: Partial<RecurrenceRuleRow> & Pick<RecurrenceRuleRow, 'household_id' | 'member_id' | 'description' | 'transaction_type' | 'amount'>;
        Update: Partial<RecurrenceRuleRow>;
      };
      investment_assets: {
        Row: InvestmentAssetRow;
        Insert: Partial<InvestmentAssetRow> & Pick<InvestmentAssetRow, 'household_id' | 'asset_name' | 'institution' | 'asset_class'>;
        Update: Partial<InvestmentAssetRow>;
      };
      investment_movements: {
        Row: InvestmentMovementRow;
        Insert: Partial<InvestmentMovementRow> & Pick<InvestmentMovementRow, 'household_id' | 'asset_id' | 'movement_type' | 'amount'>;
        Update: Partial<InvestmentMovementRow>;
      };
      investment_valuations: {
        Row: InvestmentValuationRow;
        Insert: Partial<InvestmentValuationRow> & Pick<InvestmentValuationRow, 'asset_id' | 'balance'>;
        Update: Partial<InvestmentValuationRow>;
      };
      emergency_reserve_configs: {
        Row: EmergencyReserveConfigRow;
        Insert: Partial<EmergencyReserveConfigRow> & Pick<EmergencyReserveConfigRow, 'household_id'>;
        Update: Partial<EmergencyReserveConfigRow>;
      };
      emergency_reserve_movements: {
        Row: EmergencyReserveMovementRow;
        Insert: Partial<EmergencyReserveMovementRow> & Pick<EmergencyReserveMovementRow, 'household_id' | 'config_id' | 'member_id' | 'movement_type' | 'amount'>;
        Update: Partial<EmergencyReserveMovementRow>;
      };
      financial_goals: {
        Row: FinancialGoalRow;
        Insert: Partial<FinancialGoalRow> & Pick<FinancialGoalRow, 'household_id' | 'title' | 'target_amount'>;
        Update: Partial<FinancialGoalRow>;
      };
      goal_contributions: {
        Row: GoalContributionRow;
        Insert: Partial<GoalContributionRow> & Pick<GoalContributionRow, 'goal_id' | 'amount'>;
        Update: Partial<GoalContributionRow>;
      };
      debts: {
        Row: DebtRow;
        Insert: Partial<DebtRow> & Pick<DebtRow, 'household_id' | 'title' | 'creditor' | 'original_amount' | 'total_installments' | 'installment_value'>;
        Update: Partial<DebtRow>;
      };
      debt_installments: {
        Row: DebtInstallmentRow;
        Insert: Partial<DebtInstallmentRow> & Pick<DebtInstallmentRow, 'debt_id' | 'installment_number' | 'due_date' | 'total_amount'>;
        Update: Partial<DebtInstallmentRow>;
      };
      fiscal_periods: {
        Row: FiscalPeriodRow;
        Insert: Partial<FiscalPeriodRow> & Pick<FiscalPeriodRow, 'household_id' | 'competence_month'>;
        Update: Partial<FiscalPeriodRow>;
      };
      fiscal_snapshots: {
        Row: FiscalSnapshotRow;
        Insert: Partial<FiscalSnapshotRow> & Pick<FiscalSnapshotRow, 'period_id'>;
        Update: Partial<FiscalSnapshotRow>;
      };
      system_alerts: {
        Row: SystemAlertRow;
        Insert: Partial<SystemAlertRow> & Pick<SystemAlertRow, 'household_id' | 'title'>;
        Update: Partial<SystemAlertRow>;
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Partial<AuditLogRow> & Pick<AuditLogRow, 'household_id' | 'action' | 'entity_type'>;
        Update: never; // Auditoria é append-only
      };
      monthly_series: {
        Row: MonthlySeriesRow;
        Insert: Partial<MonthlySeriesRow> & Pick<MonthlySeriesRow, 'household_id' | 'competence_month'>;
        Update: Partial<MonthlySeriesRow>;
      };
    };
    Views: {
      v_bank_account_balances: {
        Row: BankAccountRow & { total_credits: number; total_debits: number; current_balance: number };
      };
      v_benefit_card_balances: {
        Row: BenefitCardRow & { total_credits: number; total_purchases: number; current_balance: number };
      };
      v_investment_balances: {
        Row: InvestmentAssetRow & { current_balance: number; last_valuation_date: ISODate | null };
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
