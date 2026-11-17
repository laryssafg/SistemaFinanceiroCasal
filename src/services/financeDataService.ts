import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import type {
  BankAccount,
  CreditCard,
  CreditCardInstallment,
  PartnerId,
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentMethod,
  ExpenseScope,
} from '../types/finance';

type BankAccountUpdate = Database['public']['Tables']['bank_accounts']['Update'];
type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];
type CreditCardUpdate = Database['public']['Tables']['credit_cards']['Update'];

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
  date: string; // ISO ou 'YYYY-MM-DD'
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

export interface CreateCreditCardDTO {
  ownerId: PartnerId;
  additionalHolderId?: PartnerId;
  name: string;
  bank: string;
  brand: 'Mastercard' | 'Visa' | 'Elo' | 'Amex' | 'Hipercard';
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  lastFourDigits: string;
  additionalLastFourDigits?: string;
}

export interface UpdateCreditCardDTO {
  name?: string;
  bank?: string;
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
  lastFourDigits?: string;
  additionalHolderId?: PartnerId | null;
  additionalLastFourDigits?: string | null;
  isActive?: boolean;
}

export interface CreateCardPurchaseDTO {
  cardId: string;
  buyerId: PartnerId;
  description: string;
  category: string;
  amount: number;
  installments: number;
  scope: ExpenseScope;
  purchaseDate?: string;
  isAdditional?: boolean;
}

/**
 * ============================================================================
 * SERVIÇO: CONTAS BANCÁRIAS
 * ============================================================================
 */
export const accountService = {
  /**
   * Lista todas as contas do núcleo com saldo derivado da view segura
   */
  async listAccounts(
    membersMap: Record<string, { partnerId: PartnerId; name: string }>,
  ): Promise<BankAccount[]> {
    const { data, error } = await supabase
      .from('v_bank_account_balances')
      .select('*')
      .order('account_name', { ascending: true });

    if (error) {
      console.error('Erro ao listar contas bancárias:', error.message);
      throw new Error(`Falha ao carregar contas bancárias: ${error.message}`);
    }

    if (!data) return [];

    return data.map((row) => {
      const memberInfo = row.member_id ? membersMap[row.member_id] : undefined;
      const partnerId: PartnerId = memberInfo?.partnerId ?? 'partner_a';

      return {
        id: row.account_id,
        partnerId,
        institution: row.institution,
        accountName: row.account_name,
        accountType: (row.account_type as 'checking' | 'savings' | 'digital') ?? 'checking',
        openingBalance: fromCents(row.opening_balance),
        currentBalance: fromCents(row.current_balance),
        lastUpdated: '',
        active: Boolean(row.is_active),
      };
    });
  },

  /**
   * Cria uma nova conta bancária vinculada ao núcleo e membro
   */
  async createAccount(
    dto: CreateAccountDTO,
    householdId: string,
    memberId: string,
  ): Promise<string> {
    const openingCents = toCents(dto.openingBalance);

    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        household_id: householdId,
        member_id: memberId,
        institution: dto.institution.trim(),
        account_name: dto.accountName.trim(),
        account_type: dto.accountType,
        opening_balance: openingCents,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao cadastrar conta bancária:', error.message);
      throw new Error(`Falha ao cadastrar conta bancária: ${error.message}`);
    }

    return data.id;
  },

  /**
   * Atualiza dados cadastrais de uma conta existente
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
 * ============================================================================
 * SERVIÇO: MOVIMENTAÇÕES FINANCEIRAS (TRANSACTIONS)
 * ============================================================================
 */
export const transactionService = {
  /**
   * Lista movimentações financeiras do núcleo
   */
  async listTransactions(
    membersMap: Record<string, { partnerId: PartnerId; name: string }>,
  ): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar movimentações:', error.message);
      throw new Error(`Falha ao carregar movimentações: ${error.message}`);
    }

    if (!data) return [];

    return data.map((row) => {
      const memberInfo = row.member_id ? membersMap[row.member_id] : undefined;
      const partnerId: PartnerId = memberInfo?.partnerId ?? 'partner_a';

      let uiType: TransactionType = 'expense';
      if (row.transaction_type === 'income') uiType = 'income';
      else if (row.transaction_type === 'transfer_in' || row.transaction_type === 'transfer_out') {
        uiType = 'transfer';
      } else if (row.transaction_type === 'invoice_payment') {
        uiType = 'invoice_payment';
      }

      return {
        id: row.id,
        date: row.transaction_date,
        description: row.description,
        category: row.category,
        type: uiType,
        status: row.status as TransactionStatus,
        amount: fromCents(row.amount),
        paidAmount: row.paid_amount ? fromCents(row.paid_amount) : undefined,
        partnerId,
        scope: row.scope as ExpenseScope,
        paymentMethod: row.payment_method as PaymentMethod,
        accountId: row.account_id ?? undefined,
        cardId: row.card_id ?? undefined,
        installmentCurrent: row.installment_current ?? undefined,
        installmentTotal: row.installment_total ?? undefined,
        isRecurring: row.is_recurring,
        notes: row.notes ?? undefined,
      };
    });
  },

  /**
   * Registra uma nova movimentação financeira
   */
  async createTransaction(
    dto: CreateTransactionDTO,
    householdId: string,
    memberId: string,
  ): Promise<string> {
    const amountCents = toCents(dto.amount);
    const paidCents = dto.paidAmount != null ? toCents(dto.paidAmount) : null;
    const dateStr = dto.date.includes('T') ? dto.date.split('T')[0] : dto.date;
    const competenceMonth = dateStr.slice(0, 7);

    let dbType: 'income' | 'expense' | 'invoice_payment' | 'transfer_in' | 'transfer_out' = 'expense';
    if (dto.type === 'income') dbType = 'income';
    else if (dto.type === 'invoice_payment') dbType = 'invoice_payment';

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        household_id: householdId,
        member_id: memberId,
        account_id: dto.accountId || null,
        transaction_type: dbType,
        status: dto.status,
        scope: dto.scope,
        payment_method: dto.paymentMethod,
        amount: amountCents,
        paid_amount: paidCents,
        description: dto.description.trim(),
        category: dto.category.trim() || 'Outros',
        transaction_date: dateStr,
        competence_month: competenceMonth,
        notes: dto.notes ? dto.notes.trim() : null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao registrar movimentação:', error.message);
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

/**
 * ============================================================================
 * SERVIÇO: CARTÕES DE CRÉDITO, PARCELAS E FATURAS
 * ============================================================================
 */
export const creditCardService = {
  /**
   * Lista todos os cartões de crédito do casal com saldos de fatura derivados
   */
  async listCards(
    membersMap: Record<string, { partnerId: PartnerId; name: string }>,
  ): Promise<CreditCard[]> {
    const { data, error } = await supabase
      .from('v_credit_card_details')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao listar cartões de crédito:', error.message);
      throw new Error(`Falha ao carregar cartões de crédito: ${error.message}`);
    }

    if (!data) return [];

    return data.map((row) => {
      const ownerInfo = row.owner_id ? membersMap[row.owner_id] : undefined;
      const ownerId: PartnerId = ownerInfo?.partnerId ?? 'partner_a';

      const addInfo = row.additional_holder_id ? membersMap[row.additional_holder_id] : undefined;
      const additionalHolderId: PartnerId | undefined = addInfo?.partnerId;

      return {
        id: row.id,
        name: row.card_name,
        bank: row.bank,
        brand: (row.brand as 'Mastercard' | 'Visa') ?? 'Mastercard',
        ownerId,
        additionalHolderId,
        creditLimit: fromCents(row.credit_limit),
        currentInvoiceAmount: fromCents(row.current_invoice_amount),
        closedInvoiceAmount: fromCents(row.closed_invoice_amount),
        closedInvoicePaid: Boolean(row.closed_invoice_paid),
        closingDay: row.closing_day,
        dueDay: row.due_day,
        lastFourDigits: row.last_four_digits ? row.last_four_digits.trim() : '0000',
        additionalLastFourDigits: row.additional_last_four ? row.additional_last_four.trim() : undefined,
      };
    });
  },

  /**
   * Cria um novo cartão de crédito para o casal
   */
  async createCard(
    dto: CreateCreditCardDTO,
    householdId: string,
    ownerMemberId: string,
    additionalMemberId?: string,
  ): Promise<string> {
    const limitCents = toCents(dto.creditLimit);

    const { data, error } = await supabase
      .from('credit_cards')
      .insert({
        household_id: householdId,
        owner_id: ownerMemberId,
        additional_holder_id: additionalMemberId || null,
        card_name: dto.name.trim(),
        bank: dto.bank.trim(),
        brand: dto.brand,
        credit_limit: limitCents,
        closing_day: dto.closingDay,
        due_day: dto.dueDay,
        last_four_digits: dto.lastFourDigits.trim().slice(-4),
        additional_last_four: dto.additionalLastFourDigits ? dto.additionalLastFourDigits.trim().slice(-4) : null,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao cadastrar cartão de crédito:', error.message);
      throw new Error(`Falha ao cadastrar cartão de crédito: ${error.message}`);
    }

    return data.id;
  },

  /**
   * Atualiza dados de um cartão de crédito existente
   */
  async updateCard(cardId: string, dto: UpdateCreditCardDTO): Promise<void> {
    const payload: CreditCardUpdate = {};
    if (dto.name !== undefined) payload.card_name = dto.name.trim();
    if (dto.bank !== undefined) payload.bank = dto.bank.trim();
    if (dto.creditLimit !== undefined) payload.credit_limit = toCents(dto.creditLimit);
    if (dto.closingDay !== undefined) payload.closing_day = dto.closingDay;
    if (dto.dueDay !== undefined) payload.due_day = dto.dueDay;
    if (dto.lastFourDigits !== undefined) payload.last_four_digits = dto.lastFourDigits.trim().slice(-4);
    if (dto.additionalLastFourDigits !== undefined) {
      payload.additional_last_four = dto.additionalLastFourDigits ? dto.additionalLastFourDigits.trim().slice(-4) : null;
    }
    if (dto.isActive !== undefined) payload.is_active = dto.isActive;

    const { error } = await supabase
      .from('credit_cards')
      .update(payload)
      .eq('id', cardId);

    if (error) {
      console.error('Erro ao atualizar cartão de crédito:', error.message);
      throw new Error(`Falha ao atualizar cartão de crédito: ${error.message}`);
    }
  },

  /**
   * Lista as parcelas futuras de compras parceladas do núcleo
   */
  async listInstallments(
    membersMap: Record<string, { partnerId: PartnerId; name: string }>,
  ): Promise<CreditCardInstallment[]> {
    const { data, error } = await supabase
      .from('credit_card_installments')
      .select(`
        id,
        purchase_id,
        installment_number,
        installment_amount,
        due_month,
        credit_card_purchases (
          id,
          card_id,
          buyer_id,
          description,
          category,
          scope,
          purchase_date,
          total_amount,
          total_installments,
          is_additional_card
        )
      `)
      .order('due_month', { ascending: true });

    if (error) {
      console.error('Erro ao listar parcelas de cartão:', error.message);
      return [];
    }

    if (!data) return [];

    return data
      .filter((row) => row.credit_card_purchases != null)
      .map((row) => {
        const purchase = row.credit_card_purchases as any;
        const buyerInfo = purchase.buyer_id ? membersMap[purchase.buyer_id] : undefined;
        const buyerId: PartnerId = buyerInfo?.partnerId ?? 'partner_a';

        return {
          id: row.id,
          cardId: purchase.card_id,
          description: purchase.description,
          buyerId,
          scope: purchase.scope as ExpenseScope,
          category: purchase.category,
          purchaseDate: purchase.purchase_date,
          totalAmount: fromCents(purchase.total_amount),
          installmentAmount: fromCents(row.installment_amount),
          currentInstallment: row.installment_number,
          totalInstallments: purchase.total_installments,
          isAdditionalCard: purchase.is_additional_card,
        };
      });
  },

  /**
   * Registra uma compra atômica no cartão (à vista ou parcelada)
   */
  async createPurchase(dto: CreateCardPurchaseDTO, buyerMemberId: string): Promise<void> {
    const amountCents = toCents(dto.amount);

    const { error } = await supabase.rpc('create_credit_card_purchase', {
      p_card_id: dto.cardId,
      p_buyer_id: buyerMemberId,
      p_description: dto.description.trim(),
      p_category: dto.category.trim() || 'Outros',
      p_amount: amountCents,
      p_installments: dto.installments,
      p_scope: dto.scope,
      p_purchase_date: dto.purchaseDate || new Date().toISOString().split('T')[0],
      p_is_additional: Boolean(dto.isAdditional),
    });

    if (error) {
      console.error('Erro ao registrar compra no cartão:', error.message);
      throw new Error(`Falha ao registrar compra no cartão: ${error.message}`);
    }
  },

  /**
   * Executa pagamento atômico de fatura debitando a conta bancária
   */
  async payInvoice(params: {
    cardId: string;
    accountId: string;
    amount: number;
    paymentDate?: string;
  }): Promise<void> {
    const amountCents = toCents(params.amount);

    const { error } = await supabase.rpc('pay_credit_card_invoice', {
      p_card_id: params.cardId,
      p_account_id: params.accountId,
      p_amount: amountCents,
      p_payment_date: params.paymentDate || new Date().toISOString().split('T')[0],
    });

    if (error) {
      console.error('Erro ao registrar pagamento de fatura:', error.message);
      throw new Error(`Falha ao pagar fatura: ${error.message}`);
    }
  },
};
