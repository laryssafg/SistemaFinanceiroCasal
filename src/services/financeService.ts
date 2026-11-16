import {
  BankAccount,
  BenefitCard,
  BudgetCategory,
  CoupleSettlement,
  CreditCard,
  DebtItem,
  InvestmentAsset,
  PartnerId,
  PartnerProfile,
  PaymentMethod,
  SplitRuleMode,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../types/finance';

/**
 * CAMADA DE SERVIÇO FINANCEIRO (PREPARADA PARA SUPABASE)
 * Concentra regras de agregação e domínio desacopladas da origem dos dados.
 */

export interface DashboardSummary {
  totalBankBalance: number;
  partnerABankBalance: number;
  partnerBBankBalance: number;
  totalBenefitsBalance: number;
  partnerABenefitsBalance: number;
  partnerBBenefitsBalance: number;
  confirmedIncomeMonth: number;
  estimatedIncomeMonth: number;
  confirmedExpensesMonth: number;
  pendingExpensesMonth: number;
  openCreditCardInvoices: number;
  freeInvestmentsBalance: number;
  emergencyReserveBalance: number;
  totalInvestmentsNoDoubleCount: number;
  totalDebtsBalance: number;
  grossPatrimony: number;
  netWorth: number;
  pendingSettlementsTotal: number;
  budgetLimitTotal: number;
  budgetUsedConfirmed: number;
  budgetCommittedPending: number;
}

export function computeDashboardSummary(params: {
  accounts: BankAccount[];
  benefits: BenefitCard[];
  transactions: Transaction[];
  cards: CreditCard[];
  investments: InvestmentAsset[];
  debts: DebtItem[];
  settlements: CoupleSettlement[];
  budgets: BudgetCategory[];
}): DashboardSummary {
  const {
    accounts,
    benefits,
    transactions,
    cards,
    investments,
    debts,
    settlements,
    budgets,
  } = params;

  // Regra fundamental: dinheiro bancário NUNCA inclui VR/VA
  const partnerABankBalance = accounts
    .filter((a) => a.partnerId === 'partner_a' && a.active)
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const partnerBBankBalance = accounts
    .filter((a) => a.partnerId === 'partner_b' && a.active)
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const totalBankBalance = partnerABankBalance + partnerBBankBalance;

  // Benefícios VR/VA em indicador totalmente independente
  const partnerABenefitsBalance = benefits
    .filter((b) => b.partnerId === 'partner_a')
    .reduce((sum, b) => sum + b.currentBalance, 0);
  const partnerBBenefitsBalance = benefits
    .filter((b) => b.partnerId === 'partner_b')
    .reduce((sum, b) => sum + b.currentBalance, 0);
  const totalBenefitsBalance = partnerABenefitsBalance + partnerBBenefitsBalance;

  // Receitas confirmadas vs estimadas (excluindo créditos de VR/VA)
  const confirmedIncomeMonth = transactions
    .filter((t) => t.type === 'income' && t.status === 'confirmed')
    .reduce((sum, t) => sum + t.amount, 0);

  const estimatedIncomeMonth = transactions
    .filter((t) => t.type === 'income' && t.status !== 'confirmed')
    .reduce((sum, t) => sum + t.amount, 0);

  // Despesas realizadas vs pendentes (excluindo pagamento de fatura e transferências para não duplicar)
  const confirmedExpensesMonth = transactions
    .filter((t) => t.type === 'expense' && t.status === 'confirmed')
    .reduce((sum, t) => sum + (t.paidAmount ?? t.amount), 0);

  const pendingExpensesMonth = transactions
    .filter((t) => t.type === 'expense' && t.status !== 'confirmed')
    .reduce((sum, t) => sum + Math.max(0, t.amount - (t.paidAmount ?? 0)), 0);

  const openCreditCardInvoices = cards.reduce(
    (sum, c) => sum + c.currentInvoiceAmount,
    0,
  );

  // Investimentos sem dupla contagem da Reserva de Emergência
  const emergencyReserveBalance = investments
    .filter((i) => i.isEmergencyReserve)
    .reduce((sum, i) => sum + i.currentBalance, 0);

  const freeInvestmentsBalance = investments
    .filter((i) => !i.isEmergencyReserve)
    .reduce((sum, i) => sum + i.currentBalance, 0);

  const totalInvestmentsNoDoubleCount =
    freeInvestmentsBalance + emergencyReserveBalance;

  const totalDebtsBalance = debts.reduce(
    (sum, d) => sum + d.remainingBalance,
    0,
  );

  // Patrimônio Bruto (Contas bancárias + Investimentos totais sem dupla contagem, sem VR/VA)
  const grossPatrimony = totalBankBalance + totalInvestmentsNoDoubleCount;

  // Patrimônio Líquido = Patrimônio Bruto - Dívidas - Faturas em aberto
  const netWorth =
    grossPatrimony - totalDebtsBalance - openCreditCardInvoices;

  const pendingSettlementsTotal = settlements
    .filter((s) => s.status === 'pending')
    .reduce((sum, s) => sum + s.amount, 0);

  const budgetLimitTotal = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const budgetUsedConfirmed = budgets.reduce(
    (sum, b) => sum + b.spentConfirmed,
    0,
  );
  const budgetCommittedPending = budgets.reduce(
    (sum, b) => sum + b.committedPending,
    0,
  );

  return {
    totalBankBalance,
    partnerABankBalance,
    partnerBBankBalance,
    totalBenefitsBalance,
    partnerABenefitsBalance,
    partnerBBenefitsBalance,
    confirmedIncomeMonth,
    estimatedIncomeMonth,
    confirmedExpensesMonth,
    pendingExpensesMonth,
    openCreditCardInvoices,
    freeInvestmentsBalance,
    emergencyReserveBalance,
    totalInvestmentsNoDoubleCount,
    totalDebtsBalance,
    grossPatrimony,
    netWorth,
    pendingSettlementsTotal,
    budgetLimitTotal,
    budgetUsedConfirmed,
    budgetCommittedPending,
  };
}

export function computeProportionalPercentages(
  partnerAIncome: number,
  partnerBIncome: number,
  manualPartnerAPercent?: number,
  allowManual = false,
): {
  mode: SplitRuleMode;
  partnerAPercent: number | null;
  partnerBPercent: number | null;
} {
  const a = Math.max(0, partnerAIncome);
  const b = Math.max(0, partnerBIncome);

  if (a === 0 && b === 0) {
    if (!allowManual || manualPartnerAPercent === undefined) {
      return {
        mode: 'unconfigured',
        partnerAPercent: null,
        partnerBPercent: null,
      };
    }
    const clamped = Math.min(100, Math.max(0, manualPartnerAPercent));
    return {
      mode: 'manual',
      partnerAPercent: clamped,
      partnerBPercent: 100 - clamped,
    };
  }

  if (a > 0 && b === 0) {
    return { mode: 'single_earner', partnerAPercent: 100, partnerBPercent: 0 };
  }

  if (b > 0 && a === 0) {
    return { mode: 'single_earner', partnerAPercent: 0, partnerBPercent: 100 };
  }

  const total = a + b;
  const partnerAPercent = Number(((a / total) * 100).toFixed(2));
  const partnerBPercent = Number((100 - partnerAPercent).toFixed(2));
  return { mode: 'proportional', partnerAPercent, partnerBPercent };
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  const map: Record<PaymentMethod, string> = {
    pix: 'Pix',
    debit: 'Cartão de Débito',
    credit_card: 'Cartão de Crédito',
    transfer: 'Transferência (TED/DOC)',
    vr: 'Vale-Refeição (VR)',
    va: 'Vale-Alimentação (VA)',
    boleto: 'Boleto Bancário',
  };
  return map[method];
}

export function getTransactionTypeLabel(type: TransactionType): string {
  const map: Record<TransactionType, string> = {
    income: 'Receita',
    expense: 'Despesa',
    transfer: 'Transferência',
    invoice_payment: 'Pagamento de Fatura',
  };
  return map[type];
}

export function getTransactionStatusLabel(status: TransactionStatus): string {
  const map: Record<TransactionStatus, string> = {
    confirmed: 'Confirmado',
    pending: 'Pendente / Estimado',
    scheduled: 'Agendado',
  };
  return map[status];
}

export function getPartnerName(
  partners: PartnerProfile[],
  partnerId: PartnerId | 'joint' | 'system',
): string {
  if (partnerId === 'joint') return 'Conjunto (Casal)';
  if (partnerId === 'system') return 'Sistema';
  const found = partners.find((p) => p.id === partnerId);
  if (found && found.name.trim()) return found.name;
  return partnerId === 'partner_a'
    ? 'Titular 1 (não configurado)'
    : 'Titular 2 (não configurado)';
}

export function getPartnerShortName(
  partners: PartnerProfile[],
  partnerId: PartnerId,
): string {
  const found = partners.find((p) => p.id === partnerId);
  if (found && found.shortName.trim()) return found.shortName;
  return partnerId === 'partner_a' ? 'Titular 1' : 'Titular 2';
}
