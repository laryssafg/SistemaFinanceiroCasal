-- ============================================================================
-- MIGRAÇÃO 008: METAS FINANCEIRAS E DÍVIDAS
-- Sistema Financeiro do Casal
-- ============================================================================
-- Dependências: 001, 002
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. METAS FINANCEIRAS
-- ---------------------------------------------------------------------------
CREATE TABLE financial_goals (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id                UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    owner_id                    UUID REFERENCES household_members(id) ON DELETE SET NULL,
    
    title                       TEXT NOT NULL,
    scope                       TEXT NOT NULL DEFAULT 'joint' CHECK (scope IN ('joint', 'individual')),
    target_amount               BIGINT NOT NULL CHECK (target_amount > 0),  -- centavos
    monthly_planned_contribution BIGINT NOT NULL DEFAULT 0 CHECK (monthly_planned_contribution >= 0),
    deadline                    DATE,
    priority                    TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baixa')),
    status                      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE financial_goals IS 'Metas financeiras individuais ou conjuntas.';

CREATE INDEX idx_fg_household ON financial_goals(household_id);
CREATE INDEX idx_fg_owner ON financial_goals(owner_id) WHERE owner_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. APORTES EM METAS
-- ---------------------------------------------------------------------------
CREATE TABLE goal_contributions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id         UUID NOT NULL REFERENCES financial_goals(id) ON DELETE CASCADE,
    member_id       UUID REFERENCES household_members(id) ON DELETE SET NULL,
    amount          BIGINT NOT NULL CHECK (amount > 0),  -- centavos
    contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_id  UUID REFERENCES transactions(id) ON DELETE SET NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE goal_contributions IS 'Aportes realizados em metas financeiras.';

CREATE INDEX idx_gc_goal ON goal_contributions(goal_id);

-- ---------------------------------------------------------------------------
-- 3. DÍVIDAS / CONTRATOS
-- ---------------------------------------------------------------------------
CREATE TABLE debts (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id            UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    responsible_id          UUID REFERENCES household_members(id) ON DELETE SET NULL,
    
    title                   TEXT NOT NULL,
    creditor                TEXT NOT NULL,
    scope                   TEXT NOT NULL DEFAULT 'individual' CHECK (scope IN ('individual', 'joint')),
    
    -- Valores em centavos
    original_amount         BIGINT NOT NULL CHECK (original_amount > 0),
    monthly_interest_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (monthly_interest_rate_bps >= 0),  -- basis points
    total_installments      SMALLINT NOT NULL CHECK (total_installments >= 1),
    installment_value       BIGINT NOT NULL CHECK (installment_value > 0),  -- centavos
    
    start_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'renegotiated', 'cancelled')),
    
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE debts IS 'Dívidas e contratos de financiamento.';
COMMENT ON COLUMN debts.monthly_interest_rate_bps IS 'Taxa mensal em basis points (ex: 150 = 1.50%).';

CREATE INDEX idx_debt_household ON debts(household_id);
CREATE INDEX idx_debt_responsible ON debts(responsible_id) WHERE responsible_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. PARCELAS DE DÍVIDA
-- ---------------------------------------------------------------------------
CREATE TABLE debt_installments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id             UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    installment_number  SMALLINT NOT NULL CHECK (installment_number >= 1),
    due_date            DATE NOT NULL,
    
    -- Composição do pagamento (centavos)
    principal_amount    BIGINT NOT NULL DEFAULT 0 CHECK (principal_amount >= 0),
    interest_amount     BIGINT NOT NULL DEFAULT 0 CHECK (interest_amount >= 0),
    total_amount        BIGINT NOT NULL CHECK (total_amount > 0),
    
    -- Status de pagamento
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'paid', 'overdue', 'cancelled'
    )),
    paid_date           DATE,
    paid_amount         BIGINT,  -- centavos efetivamente pagos
    
    -- Vínculo com transação bancária
    transaction_id      UUID REFERENCES transactions(id) ON DELETE SET NULL,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (debt_id, installment_number),
    CONSTRAINT chk_di_total CHECK (total_amount >= principal_amount + interest_amount)
);

COMMENT ON TABLE debt_installments IS 'Parcelas de dívidas com separação de principal e juros.';

CREATE INDEX idx_di_debt ON debt_installments(debt_id);
CREATE INDEX idx_di_due ON debt_installments(due_date, status);
