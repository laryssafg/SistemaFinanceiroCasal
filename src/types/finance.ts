export type PartnerId = 'partner_a' | 'partner_b';

export type NavSectionId =
  | 'dashboard'
  | 'movimentacoes'
  | 'contas'
  | 'cartoes'
  | 'beneficios'
  | 'orcamento'
  | 'divisao'
  | 'acertos'
  | 'reserva'
  | 'investimentos'
  | 'metas'
  | 'dividas'
  | 'relatorios'
  | 'alertas'
  | 'auditoria'
  | 'configuracoes';

export type TransactionType = 'income' | 'expense' | 'transfer' | 'invoice_payment';
export type TransactionStatus = 'confirmed' | 'pending' | 'scheduled';
export type PaymentMethod =
  | 'pix'
  | 'debit'
  | 'credit_card'
  | 'transfer'
  | 'vr'
  | 'va'
  | 'boleto';
export type ExpenseScope = 'individual' | 'shared';

export interface PartnerProfile {
  id: PartnerId;
  name: string;
  shortName: string;
  email: string;
  roleLabel: string;
  photoDataUrl?: string;
  monthlyNetIncomeConfirmed: number;
  monthlyNetIncomeEstimated: number;
}

export interface BankAccount {
  id: string;
  partnerId: PartnerId;
  institution: string;
  accountName: string;
  accountType: 'checking' | 'savings' | 'digital';
  openingBalance: number;
  currentBalance: number;
  lastUpdated: string;
  active: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  paidAmount?: number;
  partnerId: PartnerId;
  scope: ExpenseScope;
  paymentMethod: PaymentMethod;
  accountId?: string;
  cardId?: string;
  benefitId?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  isRecurring?: boolean;
  recurrenceLabel?: string;
  notes?: string;
  historyLog?: {
    date: string;
    actor: string;
    change: string;
  }[];
}

export interface CreditCard {
  id: string;
  name: string;
  bank: string;
  brand: 'Mastercard' | 'Visa';
  ownerId: PartnerId;
  additionalHolderId?: PartnerId;
  creditLimit: number;
  currentInvoiceAmount: number;
  closedInvoiceAmount: number;
  closedInvoicePaid: boolean;
  closingDay: number;
  dueDay: number;
  lastFourDigits: string;
  additionalLastFourDigits?: string;
}

export interface CreditCardInstallment {
  id: string;
  cardId: string;
  description: string;
  buyerId: PartnerId;
  scope: ExpenseScope;
  category: string;
  purchaseDate: string;
  totalAmount: number;
  installmentAmount: number;
  currentInstallment: number;
  totalInstallments: number;
  isAdditionalCard: boolean;
}

export interface BenefitCard {
  id: string;
  type: 'VR' | 'VA';
  providerName: string;
  partnerId: PartnerId;
  /** UUID do membro no banco (member_id) — preenchido no modo autenticado */
  memberId?: string;
  monthlyCredit: number;
  currentBalance: number;
  spentThisMonth: number;
  lastCreditDate: string;
}

export interface BenefitMovement {
  id: string;
  benefitCardId: string;
  movementType: 'credit' | 'purchase';
  amount: number;           // reais
  description: string;
  category: string | null;
  movementDate: string;     // YYYY-MM-DD
  competenceMonth: string;  // YYYY-MM
  createdBy: string | null;
  createdAt: string;
  reversedBy: string | null;
  isReversal: boolean;
  originalMovementId: string | null;
  notes: string | null;
}

export interface BudgetCategory {
  id: string;
  category: string;
  monthlyLimit: number;
  spentConfirmed: number;
  committedPending: number;
  previousMonthSpent: number;
  isEssential: boolean;
}

export type SplitRuleMode = 'proportional' | 'single_earner' | 'manual' | 'unconfigured';

export interface ProportionalMonthHistory {
  month: string;
  partnerAIncome: number;
  partnerBIncome: number;
  partnerAPercent: number;
  partnerBPercent: number;
  totalShared: number;
  status: 'closed' | 'open_provisional';
}

export interface SharedResponsibilityItem {
  id: string;
  description: string;
  category: string;
  date: string;
  totalAmount: number;
  paidBy: PartnerId;
  partnerAShare: number;
  partnerBShare: number;
  status: 'settled' | 'pending';
  settlementTransferId?: string;
}

export interface CoupleSettlement {
  id: string;
  referenceMonth: string;
  fromPartnerId: PartnerId;
  toPartnerId: PartnerId;
  amount: number;
  status: 'pending' | 'settled';
  linkedTransferId?: string;
  settledDate?: string;
  description: string;
}

export interface EmergencyReserveConfig {
  isConfigured: boolean;
  essentialMonthlyBaseline: number;
  targetMonths: number;
  targetAmount: number;
  currentAmount: number;
  monthlyPlannedDeposit: number;
  partnerATotalContributed: number;
  partnerBTotalContributed: number;
}

export interface EmergencyReserveMovement {
  id: string;
  date: string;
  type: 'deposit' | 'withdrawal';
  partnerId: PartnerId;
  amount: number;
  destinationOrOrigin: string;
  reason?: string;
}

export interface InvestmentAsset {
  id: string;
  name: string;
  institution: string;
  assetClass: 'Renda Fixa' | 'Tesouro Direto' | 'Ações & FIIs' | 'Internacional' | 'Previdência';
  scope?: 'joint' | 'individual';
  ownerId: PartnerId | 'joint';
  isJointPlanning: boolean;
  isEmergencyReserve: boolean;
  investedAmount: number;
  currentBalance: number;
  annualReturnPercent: number;
  liquidity: string;
}

export interface FinancialGoal {
  id: string;
  title: string;
  scope: 'joint' | 'individual';
  ownerId?: PartnerId;
  targetAmount: number;
  currentAmount: number;
  monthlyPlannedContribution: number;
  deadline: string;
  priority: 'Alta' | 'Média' | 'Baixa';
}

export interface DebtItem {
  id: string;
  title: string;
  creditor: string;
  responsibleId: PartnerId | 'joint';
  originalAmount: number;
  remainingBalance: number;
  monthlyInterestRate: number;
  totalInstallments: number;
  paidInstallments: number;
  installmentValue: number;
  nextDueDate: string;
}

export interface SystemAlert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  module: NavSectionId;
  date: string;
  read: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: PartnerId | 'system';
  action: string;
  module: string;
  details: string;
  ipOrOrigin: string;
}

export interface MonthlySeriesPoint {
  month: string;
  income: number;
  expenses: number;
  patrimony: number;
  netWorth: number;
}

export interface FinancialSettings {
  defaultClosingDay: number;
  autoMonthlyReset: boolean;
  requireTransferForSettlement: boolean;
}

