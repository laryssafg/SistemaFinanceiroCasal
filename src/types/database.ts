/**
 * Tipos do Banco de Dados Relacional Supabase (Preparação para Tarefa 03)
 * Mapeamento das tabelas e esquemas para integração com @supabase/supabase-js
 */

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
  FinancialSettings,
  InvestmentAsset,
  MonthlySeriesPoint,
  PartnerProfile,
  ProportionalMonthHistory,
  SharedResponsibilityItem,
  SystemAlert,
  Transaction,
} from './finance';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      partner_profiles: {
        Row: PartnerProfile;
        Insert: PartnerProfile;
        Update: Partial<PartnerProfile>;
      };
      bank_accounts: {
        Row: BankAccount;
        Insert: BankAccount;
        Update: Partial<BankAccount>;
      };
      transactions: {
        Row: Transaction;
        Insert: Transaction;
        Update: Partial<Transaction>;
      };
      credit_cards: {
        Row: CreditCard;
        Insert: CreditCard;
        Update: Partial<CreditCard>;
      };
      credit_card_installments: {
        Row: CreditCardInstallment;
        Insert: CreditCardInstallment;
        Update: Partial<CreditCardInstallment>;
      };
      benefit_cards: {
        Row: BenefitCard;
        Insert: BenefitCard;
        Update: Partial<BenefitCard>;
      };
      budget_categories: {
        Row: BudgetCategory;
        Insert: BudgetCategory;
        Update: Partial<BudgetCategory>;
      };
      proportional_history: {
        Row: ProportionalMonthHistory;
        Insert: ProportionalMonthHistory;
        Update: Partial<ProportionalMonthHistory>;
      };
      shared_responsibilities: {
        Row: SharedResponsibilityItem;
        Insert: SharedResponsibilityItem;
        Update: Partial<SharedResponsibilityItem>;
      };
      couple_settlements: {
        Row: CoupleSettlement;
        Insert: CoupleSettlement;
        Update: Partial<CoupleSettlement>;
      };
      emergency_reserve_configs: {
        Row: EmergencyReserveConfig;
        Insert: EmergencyReserveConfig;
        Update: Partial<EmergencyReserveConfig>;
      };
      emergency_reserve_movements: {
        Row: EmergencyReserveMovement;
        Insert: EmergencyReserveMovement;
        Update: Partial<EmergencyReserveMovement>;
      };
      investment_assets: {
        Row: InvestmentAsset;
        Insert: InvestmentAsset;
        Update: Partial<InvestmentAsset>;
      };
      financial_goals: {
        Row: FinancialGoal;
        Insert: FinancialGoal;
        Update: Partial<FinancialGoal>;
      };
      debt_items: {
        Row: DebtItem;
        Insert: DebtItem;
        Update: Partial<DebtItem>;
      };
      system_alerts: {
        Row: SystemAlert;
        Insert: SystemAlert;
        Update: Partial<SystemAlert>;
      };
      audit_logs: {
        Row: AuditLogEntry;
        Insert: AuditLogEntry;
        Update: Partial<AuditLogEntry>;
      };
      monthly_series: {
        Row: MonthlySeriesPoint;
        Insert: MonthlySeriesPoint;
        Update: Partial<MonthlySeriesPoint>;
      };
      financial_settings: {
        Row: FinancialSettings & { id: string };
        Insert: FinancialSettings & { id: string };
        Update: Partial<FinancialSettings & { id: string }>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
