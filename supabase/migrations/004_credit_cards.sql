-- ============================================================================
-- MIGRAÇÃO 004: CARTÕES DE CRÉDITO, FATURAS E PARCELAMENTOS
-- Sistema Financeiro do Casal
-- ============================================================================
-- Dependências: 001, 002
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CARTÕES DE CRÉDITO
-- ---------------------------------------------------------------------------
CREATE TABLE credit_cards (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id            UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    owner_id                UUID NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    additional_holder_id    UUID REFERENCES household_members(id) ON DELETE SET NULL,
    card_name               TEXT NOT NULL,
    bank                    TEXT NOT NULL,
    brand                   TEXT NOT NULL CHECK (brand IN ('Mastercard', 'Visa', 'Elo', 'Amex', 'Hipercard')),
    credit_limit            BIGINT NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),  -- centavos
    closing_day             SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
    due_day                 SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    last_four_digits        CHAR(4) NOT NULL,
    additional_last_four    CHAR(4),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE credit_cards IS 'Cartões de crédito do casal. Cartões adicionais são do mesmo registro.';

CREATE INDEX idx_cc_household ON credit_cards(household_id);
CREATE INDEX idx_cc_owner ON credit_cards(owner_id);

-- ---------------------------------------------------------------------------
-- 2. FATURAS
-- ---------------------------------------------------------------------------
-- Cada fatura representa um período de cobrança de um cartão.
-- Status: open (acumulando), closed (fechada, aguardando pagamento), paid, partially_paid
CREATE TABLE credit_card_invoices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    card_id         UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    reference_month TEXT NOT NULL,  -- 'YYYY-MM' do fechamento
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'closed', 'paid', 'partially_paid'
    )),
    total_amount    BIGINT NOT NULL DEFAULT 0,  -- centavos: soma das compras
    paid_amount     BIGINT NOT NULL DEFAULT 0,  -- centavos: valor já pago
    due_date        DATE,
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (card_id, reference_month),
    CONSTRAINT chk_inv_paid_lte_total CHECK (paid_amount <= total_amount),
    CONSTRAINT chk_inv_competence_format CHECK (reference_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

COMMENT ON TABLE credit_card_invoices IS 'Faturas de cartão de crédito por período.';

CREATE INDEX idx_inv_household ON credit_card_invoices(household_id);
CREATE INDEX idx_inv_card_month ON credit_card_invoices(card_id, reference_month);

-- ---------------------------------------------------------------------------
-- 3. COMPRAS NO CARTÃO DE CRÉDITO
-- ---------------------------------------------------------------------------
-- Cada compra pode ser à vista (1 parcela) ou parcelada.
-- A compra é o fato original; as parcelas são derivadas.
CREATE TABLE credit_card_purchases (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    card_id             UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    buyer_id            UUID NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    is_additional_card  BOOLEAN NOT NULL DEFAULT FALSE,
    scope               TEXT NOT NULL DEFAULT 'individual' CHECK (scope IN ('individual', 'shared')),
    description         TEXT NOT NULL,
    category            TEXT NOT NULL DEFAULT 'Outros',
    purchase_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount        BIGINT NOT NULL CHECK (total_amount > 0),  -- centavos
    total_installments  SMALLINT NOT NULL DEFAULT 1 CHECK (total_installments >= 1),
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'refunded')),
    
    -- Referência para estorno
    refunded_purchase_id UUID REFERENCES credit_card_purchases(id) ON DELETE SET NULL,
    
    created_by          UUID REFERENCES household_members(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE credit_card_purchases IS 'Compras no cartão de crédito — fato original de cada gasto.';

CREATE INDEX idx_ccp_household ON credit_card_purchases(household_id);
CREATE INDEX idx_ccp_card ON credit_card_purchases(card_id);
CREATE INDEX idx_ccp_buyer ON credit_card_purchases(buyer_id);

-- ---------------------------------------------------------------------------
-- 4. PARCELAS DE CARTÃO
-- ---------------------------------------------------------------------------
-- Cada parcela é vinculada a uma compra e a uma fatura.
CREATE TABLE credit_card_installments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    purchase_id         UUID NOT NULL REFERENCES credit_card_purchases(id) ON DELETE CASCADE,
    invoice_id          UUID REFERENCES credit_card_invoices(id) ON DELETE SET NULL,
    installment_number  SMALLINT NOT NULL CHECK (installment_number >= 1),
    installment_amount  BIGINT NOT NULL CHECK (installment_amount > 0),  -- centavos
    due_month           TEXT NOT NULL,  -- 'YYYY-MM'
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (purchase_id, installment_number),
    CONSTRAINT chk_inst_due_format CHECK (due_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

COMMENT ON TABLE credit_card_installments IS 'Parcelas individuais de compras parceladas no cartão.';

CREATE INDEX idx_cci_purchase ON credit_card_installments(purchase_id);
CREATE INDEX idx_cci_invoice ON credit_card_installments(invoice_id) WHERE invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. PAGAMENTOS DE FATURA
-- ---------------------------------------------------------------------------
-- Pagamento de fatura reduz saldo bancário e obrigação do cartão.
-- NÃO é uma segunda despesa de consumo.
CREATE TABLE invoice_payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    invoice_id      UUID NOT NULL REFERENCES credit_card_invoices(id) ON DELETE RESTRICT,
    account_id      UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    transaction_id  UUID REFERENCES transactions(id) ON DELETE SET NULL,
    amount          BIGINT NOT NULL CHECK (amount > 0),  -- centavos
    payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by      UUID REFERENCES household_members(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE invoice_payments IS 'Pagamentos de fatura — link entre fatura, conta bancária e transação.';
COMMENT ON COLUMN invoice_payments.transaction_id IS 'Transação tipo invoice_payment que registra a saída bancária.';

CREATE INDEX idx_ip_invoice ON invoice_payments(invoice_id);
CREATE INDEX idx_ip_account ON invoice_payments(account_id);

-- ---------------------------------------------------------------------------
-- 6. ADICIONAR FK de transactions.card_id
-- ---------------------------------------------------------------------------
ALTER TABLE transactions
    ADD CONSTRAINT fk_tx_credit_card
    FOREIGN KEY (card_id) REFERENCES credit_cards(id) ON DELETE SET NULL;
