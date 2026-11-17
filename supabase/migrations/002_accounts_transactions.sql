-- ============================================================================
-- MIGRAÇÃO 002: CONTAS BANCÁRIAS
-- Sistema Financeiro do Casal
-- ============================================================================
-- Dependências: 001_identity_core.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CONTAS BANCÁRIAS
-- ---------------------------------------------------------------------------
CREATE TABLE bank_accounts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    member_id       UUID NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    institution     TEXT NOT NULL,
    account_name    TEXT NOT NULL,
    account_type    TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'digital')),
    opening_balance BIGINT NOT NULL DEFAULT 0,  -- centavos
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE bank_accounts IS 'Contas bancárias dos membros. Saldo de abertura em centavos.';
COMMENT ON COLUMN bank_accounts.opening_balance IS 'Saldo de abertura em centavos (R$ 100,00 = 10000). NÃO é receita.';

CREATE INDEX idx_ba_household ON bank_accounts(household_id);
CREATE INDEX idx_ba_member ON bank_accounts(member_id);

-- ---------------------------------------------------------------------------
-- 2. MOVIMENTAÇÕES FINANCEIRAS (fonte de verdade para saldos bancários)
-- ---------------------------------------------------------------------------
-- Esta é a tabela central de fatos financeiros.
-- Saldos bancários são DERIVADOS da soma de movimentações + saldo de abertura.
-- Tipos: income, expense, transfer_in, transfer_out, invoice_payment,
--        refund, opening_balance_adj
CREATE TABLE transactions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    member_id           UUID NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    account_id          UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
    card_id             UUID,  -- FK definida na migração 004 (cartões)
    benefit_card_id     UUID,  -- FK definida na migração 003 (benefícios)

    -- Classificação
    transaction_type    TEXT NOT NULL CHECK (transaction_type IN (
        'income', 'expense', 'transfer_in', 'transfer_out',
        'invoice_payment', 'refund', 'opening_balance_adj'
    )),
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'confirmed', 'pending', 'scheduled', 'cancelled'
    )),
    scope               TEXT NOT NULL DEFAULT 'individual' CHECK (scope IN ('individual', 'shared')),
    payment_method      TEXT NOT NULL DEFAULT 'pix' CHECK (payment_method IN (
        'pix', 'debit', 'credit_card', 'transfer', 'vr', 'va', 'boleto'
    )),

    -- Valores em centavos
    amount              BIGINT NOT NULL CHECK (amount >= 0),
    paid_amount         BIGINT,  -- para pagamentos parciais
    
    -- Descrição e categorização
    description         TEXT NOT NULL DEFAULT '',
    category            TEXT NOT NULL DEFAULT 'Outros',
    notes               TEXT,

    -- Competência e data
    transaction_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    competence_month    TEXT NOT NULL,  -- formato 'YYYY-MM'

    -- Parcelamento (para compras parceladas fora do cartão)
    installment_current SMALLINT,
    installment_total   SMALLINT,

    -- Recorrência
    is_recurring        BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_rule_id  UUID,  -- FK definida na migração 006

    -- Estorno: referência ao lançamento original
    refunded_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

    -- Transferência: referência ao lançamento par
    transfer_pair_id    UUID REFERENCES transactions(id) ON DELETE SET NULL,

    -- Auditoria
    created_by          UUID REFERENCES household_members(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Restrições de integridade
    CONSTRAINT chk_paid_lte_amount CHECK (paid_amount IS NULL OR paid_amount <= amount),
    CONSTRAINT chk_installment_valid CHECK (
        (installment_current IS NULL AND installment_total IS NULL) OR
        (installment_current IS NOT NULL AND installment_total IS NOT NULL AND
         installment_current >= 1 AND installment_total >= 1 AND
         installment_current <= installment_total)
    ),
    CONSTRAINT chk_competence_format CHECK (competence_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT chk_refund_requires_type CHECK (
        refunded_transaction_id IS NULL OR transaction_type = 'refund'
    ),
    CONSTRAINT chk_transfer_pair_requires_type CHECK (
        transfer_pair_id IS NULL OR transaction_type IN ('transfer_in', 'transfer_out')
    )
);

COMMENT ON TABLE transactions IS 'Fatos financeiros — fonte de verdade para saldos bancários derivados.';
COMMENT ON COLUMN transactions.amount IS 'Valor em centavos. Sempre positivo; o tipo indica débito/crédito.';
COMMENT ON COLUMN transactions.competence_month IS 'Mês de competência no formato YYYY-MM.';
COMMENT ON COLUMN transactions.refunded_transaction_id IS 'Referência ao lançamento original quando type=refund.';

CREATE INDEX idx_tx_household ON transactions(household_id);
CREATE INDEX idx_tx_member ON transactions(member_id);
CREATE INDEX idx_tx_account ON transactions(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_tx_competence ON transactions(household_id, competence_month);
CREATE INDEX idx_tx_type_status ON transactions(transaction_type, status);
CREATE INDEX idx_tx_date ON transactions(transaction_date);
CREATE INDEX idx_tx_category ON transactions(household_id, category);
CREATE INDEX idx_tx_card ON transactions(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX idx_tx_benefit ON transactions(benefit_card_id) WHERE benefit_card_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. VIEW: SALDO BANCÁRIO CALCULADO
-- ---------------------------------------------------------------------------
-- Saldo de cada conta = saldo_abertura + SUM(entradas confirmadas) - SUM(saídas confirmadas)
-- Entradas: income, transfer_in, refund
-- Saídas: expense (pix/debit/boleto/transfer), transfer_out, invoice_payment
CREATE OR REPLACE VIEW v_bank_account_balances AS
SELECT
    ba.id AS account_id,
    ba.household_id,
    ba.member_id,
    ba.institution,
    ba.account_name,
    ba.account_type,
    ba.is_active,
    ba.opening_balance,
    COALESCE(credits.total, 0) AS total_credits,
    COALESCE(debits.total, 0) AS total_debits,
    ba.opening_balance + COALESCE(credits.total, 0) - COALESCE(debits.total, 0) AS current_balance
FROM bank_accounts ba
LEFT JOIN LATERAL (
    SELECT SUM(COALESCE(t.paid_amount, t.amount)) AS total
    FROM transactions t
    WHERE t.account_id = ba.id
      AND t.status = 'confirmed'
      AND t.transaction_type IN ('income', 'transfer_in', 'refund')
) credits ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(COALESCE(t.paid_amount, t.amount)) AS total
    FROM transactions t
    WHERE t.account_id = ba.id
      AND t.status = 'confirmed'
      AND t.transaction_type IN ('expense', 'transfer_out', 'invoice_payment')
      AND t.payment_method NOT IN ('credit_card', 'vr', 'va')
) debits ON TRUE;

COMMENT ON VIEW v_bank_account_balances IS 'Saldos bancários derivados de movimentações confirmadas + saldo de abertura.';
