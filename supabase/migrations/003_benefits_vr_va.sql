-- ============================================================================
-- MIGRAÇÃO 003: BENEFÍCIOS VR/VA
-- Sistema Financeiro do Casal
-- ============================================================================
-- Dependências: 001_identity_core.sql, 002_accounts_transactions.sql
-- ============================================================================
-- REGRA INEGOCIÁVEL: compra com VR/VA NUNCA diminui saldo bancário.
-- Créditos de VR/VA NÃO entram no cálculo de renda líquida monetária.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CARTÕES/CARTEIRAS DE BENEFÍCIO
-- ---------------------------------------------------------------------------
CREATE TABLE benefit_cards (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    member_id       UUID NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    benefit_type    TEXT NOT NULL CHECK (benefit_type IN ('VR', 'VA')),
    provider_name   TEXT NOT NULL,
    monthly_credit  BIGINT NOT NULL DEFAULT 0 CHECK (monthly_credit >= 0),  -- centavos
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE benefit_cards IS 'Cartões/carteiras de benefício VR/VA. Saldo é derivado.';
COMMENT ON COLUMN benefit_cards.monthly_credit IS 'Valor mensal esperado de crédito em centavos.';

CREATE INDEX idx_bc_household ON benefit_cards(household_id);
CREATE INDEX idx_bc_member ON benefit_cards(member_id);

-- ---------------------------------------------------------------------------
-- 2. MOVIMENTAÇÕES DE BENEFÍCIO (fonte de verdade para saldo VR/VA)
-- ---------------------------------------------------------------------------
-- Tipos: credit (recarga mensal), purchase (compra com VR/VA)
-- O saldo é DERIVADO da soma de créditos - compras.
CREATE TABLE benefit_movements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    benefit_card_id UUID NOT NULL REFERENCES benefit_cards(id) ON DELETE CASCADE,
    movement_type   TEXT NOT NULL CHECK (movement_type IN ('credit', 'purchase')),
    amount          BIGINT NOT NULL CHECK (amount > 0),  -- centavos, sempre positivo
    description     TEXT NOT NULL DEFAULT '',
    category        TEXT,
    movement_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    competence_month TEXT NOT NULL,  -- formato 'YYYY-MM'
    
    -- Referência opcional ao transaction para relatórios unificados
    -- (a despesa com VR/VA aparece em relatórios, mas NÃO afeta contas bancárias)
    linked_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

    created_by      UUID REFERENCES household_members(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_bm_competence_format CHECK (competence_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

COMMENT ON TABLE benefit_movements IS 'Movimentações de VR/VA. Compras aqui NÃO afetam saldo bancário.';

CREATE INDEX idx_bm_benefit_card ON benefit_movements(benefit_card_id);
CREATE INDEX idx_bm_household ON benefit_movements(household_id);
CREATE INDEX idx_bm_competence ON benefit_movements(household_id, competence_month);

-- ---------------------------------------------------------------------------
-- 3. VIEW: SALDO DE BENEFÍCIOS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_benefit_card_balances AS
SELECT
    bc.id AS benefit_card_id,
    bc.household_id,
    bc.member_id,
    bc.benefit_type,
    bc.provider_name,
    bc.monthly_credit,
    bc.is_active,
    COALESCE(credits.total, 0) AS total_credits,
    COALESCE(purchases.total, 0) AS total_purchases,
    COALESCE(credits.total, 0) - COALESCE(purchases.total, 0) AS current_balance
FROM benefit_cards bc
LEFT JOIN LATERAL (
    SELECT SUM(bm.amount) AS total
    FROM benefit_movements bm
    WHERE bm.benefit_card_id = bc.id AND bm.movement_type = 'credit'
) credits ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(bm.amount) AS total
    FROM benefit_movements bm
    WHERE bm.benefit_card_id = bc.id AND bm.movement_type = 'purchase'
) purchases ON TRUE;

COMMENT ON VIEW v_benefit_card_balances IS 'Saldos de benefícios VR/VA derivados de créditos e compras.';

-- ---------------------------------------------------------------------------
-- 4. ADICIONAR FK de transactions.benefit_card_id
-- ---------------------------------------------------------------------------
ALTER TABLE transactions
    ADD CONSTRAINT fk_tx_benefit_card
    FOREIGN KEY (benefit_card_id) REFERENCES benefit_cards(id) ON DELETE SET NULL;
