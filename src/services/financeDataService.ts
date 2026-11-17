import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import type { BankAccount, PartnerId, Transaction, TransactionStatus, TransactionType, PaymentMethod, ExpenseScope } from '../types/finance';

type BankAccountUpdate = Database['public']['Tables']['bank_accounts']['Update'];
type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];

/**
 * Converte valor em reais (float) para centavos inteiros (BIGINT)
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Converte valor em centavos (BIGINT) para reais (float com 2 casas)
 */
export function fromCents(cents: number | null | undefined): number {
  if (cents == null) return 0;
  return Number((Number(cents) / 100).toFixed(2));
}

export interface CreateAccountDTO {
  partnerId: PartnerId;
  institution: string;
  accountName: string;
  accountType: 'checking' | 'savings' | 'digital';
  openingBalance: number;
}

export interface UpdateAccountDTO {
  institution?: string;
  accountName?: string;
  accountType?: 'checking' | 'savings' | 'digital';
  active?: boolean;
}

export interface CreateTransactionDTO {
  partnerId: PartnerId;
  accountId?: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  paidAmount?: number;
  description: string;
  category: string;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  scope: ExpenseScope;
  notes?: string;
}

export interface UpdateTransactionDTO {
  description?: string;
  category?: string;
  status?: TransactionStatus;
  amount?: number;
  paidAmount?: number;
  notes?: string;
}

/**
 * Mapeamento de tipo de movimentação entre o modelo do frontend e o PostgreSQL
 */
function mapFrontendTypeToDb(type: TransactionType): string {
  switch (type) {
    case 'income':
      return 'income';
    case 'expense':
      return 'expense';
    case 'transfer':
      return 'transfer_out';
    case 'invoice_payment':
      return 'invoice_payment';
    default:
      return 'expense';
  }
}

function mapDbTypeToFrontend(dbType: string): TransactionType {
  switch (dbType) {
    case 'income':
      return 'income';
    case 'expense':
      return 'expense';
    case 'transfer_in':
    case 'transfer_out':
      return 'transfer';
    case 'invoice_payment':
      return 'invoice_payment';
    default:
      return 'expense';
  }
}

/**
 * Camada de Acesso a Dados — Contas Bancárias
 */
export const accountService = {
  /**
   * Lista as contas bancárias do núcleo com os saldos derivados calculados pela view oficial
   */
  async listAccounts(householdMembersMap: Record<string, { partnerId: PartnerId }>): Promise<BankAccount[]> {
    const { data, error } = await supabase
      .from('v_bank_account_balances')
      .select('*')
      .order('account_name', { ascending: true });

    if (error) {
      console.error('Erro ao buscar contas bancárias:', error.message);
      throw new Error(`Falha ao carregar contas bancárias: ${error.message}`);
    }

    if (!data) return [];

    return data.map((row: any) => {
      const memberInfo = householdMembersMap[row.member_id];
      const partnerId: PartnerId = memberInfo ? memberInfo.partnerId : 'partner_a';

      return {
        id: row.account_id,
        partnerId,
        institution: row.institution,
        accountName: row.account_name,
        accountType: row.account_type as 'checking' | 'savings' | 'digital',
        openingBalance: fromCents(row.opening_balance),
        currentBalance: fromCents(row.current_balance),
        lastUpdated: new Date().toISOString().split('T')[0],
        active: row.is_active,
      };
    });
  },

  /**
   * Cria nova conta bancária no núcleo
   */
  async createAccount(
    dto: CreateAccountDTO,
    householdId: string,
    memberId: string,
  ): Promise<string> {
    const openingBalanceCents = toCents(dto.openingBalance);

    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        household_id: householdId,
        member_id: memberId,
        institution: dto.institution.trim(),
        account_name: dto.accountName.trim(),
        account_type: dto.accountType,
        opening_balance: openingBalanceCents,
        is_active: true,
        is_emergency_reserve: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao criar conta bancária:', error.message);
      throw new Error(`Falha ao cadastrar conta bancária: ${error.message}`);
    }

    return data.id;
  },

  /**
   * Atualiza dados permitidos de uma conta bancária
   */
  async updateAccount(accountId: string, dto: UpdateAccountDTO): Promise<void> {
    const payload: BankAccountUpdate = {};
    if (dto.institution !== undefined) payload.institution = dto.institution.trim();
    if (dto.accountName !== undefined) payload.account_name = dto.accountName.trim();
    if (dto.accountType !== undefined) payload.account_type = dto.accountType;
    if (dto.active !== undefined) payload.is_active = dto.active;

    const { error } = await supabase
      .from('bank_accounts')
      .update(payload)
      .eq('id', accountId);

    if (error) {
      console.error('Erro ao atualizar conta bancária:', error.message);
      throw new Error(`Falha ao atualizar conta bancária: ${error.message}`);
    }
  },
};

/**
 * Camada de Acesso a Dados — Movimentações Financeiras
 */
export const transactionService = {
  /**
   * Lista movimentações do núcleo com suporte a ordenação decrescente por data
   */
  async listTransactions(
    householdMembersMap: Record<string, { partnerId: PartnerId; name: string }>,
  ): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar movimentações:', error.message);
      throw new Error(`Falha ao carregar movimentações: ${error.message}`);
    }

    if (!data) return [];

    return data.map((row: any) => {
      const memberInfo = householdMembersMap[row.member_id];
      const partnerId: PartnerId = memberInfo ? memberInfo.partnerId : 'partner_a';
      const actorName = memberInfo ? memberInfo.name : 'Titular';

      return {
        id: row.id,
        date: row.transaction_date,
        description: row.description,
        category: row.category,
        type: mapDbTypeToFrontend(row.transaction_type),
        status: (row.status === 'confirmed' || row.status === 'pending' || row.status === 'scheduled'
          ? row.status
          : 'confirmed') as TransactionStatus,
        amount: fromCents(row.amount),
        paidAmount: row.paid_amount ? fromCents(row.paid_amount) : undefined,
        partnerId,
        scope: (row.scope === 'shared' ? 'shared' : 'individual') as ExpenseScope,
        paymentMethod: row.payment_method as PaymentMethod,
        accountId: row.account_id ?? undefined,
        cardId: row.card_id ?? undefined,
        benefitId: row.benefit_card_id ?? undefined,
        installmentCurrent: row.installment_current ?? undefined,
        installmentTotal: row.installment_total ?? undefined,
        isRecurring: row.is_recurring ?? false,
        notes: row.notes ?? undefined,
        historyLog: [
          {
            date: row.created_at,
            actor: actorName,
            change: 'Registro gravado no banco de dados Supabase.',
          },
        ],
      };
    });
  },

  /**
   * Cria nova receita ou despesa no banco de dados
   */
  async createTransaction(
    dto: CreateTransactionDTO,
    householdId: string,
    memberId: string,
  ): Promise<string> {
    const amountCents = toCents(dto.amount);
    const paidAmountCents = dto.paidAmount ? toCents(dto.paidAmount) : null;
    const competenceMonth = dto.date.slice(0, 7);

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        household_id: householdId,
        member_id: memberId,
        account_id: dto.accountId || null,
        transaction_type: mapFrontendTypeToDb(dto.type),
        status: dto.status,
        scope: dto.scope,
        payment_method: dto.paymentMethod,
        amount: amountCents,
        paid_amount: paidAmountCents,
        description: dto.description.trim(),
        category: dto.category.trim(),
        transaction_date: dto.date,
        competence_month: competenceMonth,
        notes: dto.notes?.trim() || null,
        is_recurring: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao criar movimentação:', error.message);
      throw new Error(`Falha ao registrar movimentação: ${error.message}`);
    }

    return data.id;
  },

  /**
   * Atualiza dados de uma movimentação existente
   */
  async updateTransaction(id: string, dto: UpdateTransactionDTO): Promise<void> {
    const payload: TransactionUpdate = {};
    if (dto.description !== undefined) payload.description = dto.description.trim();
    if (dto.category !== undefined) payload.category = dto.category.trim();
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.notes !== undefined) payload.notes = dto.notes.trim();
    if (dto.amount !== undefined) payload.amount = toCents(dto.amount);
    if (dto.paidAmount !== undefined) payload.paid_amount = toCents(dto.paidAmount);

    const { error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar movimentação:', error.message);
      throw new Error(`Falha ao atualizar movimentação: ${error.message}`);
    }
  },

  /**
   * Cancelamento lógico de uma movimentação
   */
  async cancelTransaction(id: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      console.error('Erro ao cancelar movimentação:', error.message);
      throw new Error(`Falha ao cancelar movimentação: ${error.message}`);
    }
  },

  /**
   * Executa transferência atômica entre duas contas do núcleo
   */
  async executeTransfer(params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    date?: string;
    notes?: string;
  }): Promise<void> {
    const amountCents = toCents(params.amount);

    const { error } = await supabase.rpc('create_bank_transfer', {
      p_from_account_id: params.fromAccountId,
      p_to_account_id: params.toAccountId,
      p_amount: amountCents,
      p_description: params.description || 'Transferência entre contas',
      p_date: params.date || new Date().toISOString().split('T')[0],
      p_notes: params.notes,
    });

    if (error) {
      console.error('Erro na transferência atômica:', error.message);
      throw new Error(`Falha na transferência bancária: ${error.message}`);
    }
  },
};
