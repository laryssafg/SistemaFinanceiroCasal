-- ============================================================================
-- MIGRAÇÃO 006: ORÇAMENTO, CATEGORIAS E RECORRÊNCIAS
-- Sistema Financeiro do Casal
-- ============================================================================
-- Dependências: 001, 002
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CATEGORIAS DE ORÇAMENTO
-- ---------------------------------------------------------------------------
-- Categorias são definidas pelo casal e reutilizadas em movimentações.
CREATE TABLE budget_categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    category_name   TEXT NOT NULL,
    is_essential    BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (household_id, category_name)
);

COMMENT ON TABLE budget_categories IS 'Categorias de orçamento do núcleo — classificações gerenciais.';

CREATE INDEX idx_bcat_household ON budget_categories(household_id);

-- ---------------------------------------------------------------------------
-- 2. ORÇAMENTOS MENSAIS
-- ---------------------------------------------------------------------------
-- Um orçamento mensal por competência, contendo os limites de cada categoria.
-- Orçamento é CONJUNTO (do casal). Limites reiniciam mensalmente.
-- Saldos não utilizados NÃO são transportados automaticamente.
CREATE TABLE monthly_budgets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    competence_month TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (household_id, competence_month),
    CONSTRAINT chk_mb_competence_format CHECK (competence_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

COMMENT ON TABLE monthly_budgets IS 'Orçamento mensal conjunto do casal. Limites reiniciam a cada mês.';

CREATE INDEX idx_mb_household ON monthly_budgets(household_id);

-- ---------------------------------------------------------------------------
-- 3. LIMITES POR CATEGORIA NO MÊS
-- ---------------------------------------------------------------------------
CREATE TABLE budget_category_limits (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_id           UUID NOT NULL REFERENCES monthly_budgets(id) ON DELETE CASCADE,
    category_id         UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
    monthly_limit       BIGINT NOT NULL DEFAULT 0 CHECK (monthly_limit >= 0),  -- centavos
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (budget_id, category_id)
);

COMMENT ON TABLE budget_category_limits IS 'Limite orçamentário por categoria no mês. Gastos são derivados de transactions.';

CREATE INDEX idx_bcl_budget ON budget_category_limits(budget_id);
CREATE INDEX idx_bcl_category ON budget_category_limits(category_id);

-- ---------------------------------------------------------------------------
-- 4. REGRAS DE RECORRÊNCIA
-- ---------------------------------------------------------------------------
-- Define lançamentos recorrentes (salário, aluguel, assinaturas, etc.)
-- Recorrências NÃO são marcadas como pagas automaticamente.
-- A cada mês, lançamentos pendentes são gerados a partir das regras ativas.
CREATE TABLE recurrence_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    member_id           UUID NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    
    description         TEXT NOT NULL,
    category            TEXT NOT NULL DEFAULT 'Outros',
    transaction_type    TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    scope               TEXT NOT NULL DEFAULT 'individual' CHECK (scope IN ('individual', 'shared')),
    payment_method      TEXT NOT NULL DEFAULT 'pix',
    amount              BIGINT NOT NULL CHECK (amount > 0),  -- centavos
    
    -- Frequência
    frequency           TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN (
        'monthly', 'biweekly', 'weekly', 'annual'
    )),
    day_of_month        SMALLINT CHECK (day_of_month BETWEEN 1 AND 31),
    
    -- Conta destino/origem
    account_id          UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
    card_id             UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
    
    -- Vigência
    start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date            DATE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE recurrence_rules IS 'Regras de lançamentos recorrentes. Geram pendências que exigem confirmação manual.';

CREATE INDEX idx_rr_household ON recurrence_rules(household_id);
CREATE INDEX idx_rr_member ON recurrence_rules(member_id);

-- ---------------------------------------------------------------------------
-- 5. ADICIONAR FK de transactions.recurrence_rule_id
-- ---------------------------------------------------------------------------
ALTER TABLE transactions
    ADD CONSTRAINT fk_tx_recurrence_rule
    FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id) ON DELETE SET NULL;
