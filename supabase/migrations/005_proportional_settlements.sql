-- ============================================================================
-- MIGRAÇÃO 005: DIVISÃO PROPORCIONAL, RESPONSABILIDADES E ACERTOS
-- Sistema Financeiro do Casal
-- ============================================================================
-- Dependências: 001, 002
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. COMPETÊNCIAS MENSAIS DE DIVISÃO
-- ---------------------------------------------------------------------------
-- Cada registro representa um mês de competência para o cálculo de divisão.
-- Percentuais são armazenados como basis points (10000 = 100.00%)
-- para evitar erros de arredondamento em ponto flutuante.
CREATE TABLE proportional_periods (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    competence_month    TEXT NOT NULL,  -- 'YYYY-MM'
    
    -- Renda líquida elegível (centavos)
    -- NÃO inclui: transferências, empréstimos, resgates de principal, VR/VA
    partner_a_income    BIGINT NOT NULL DEFAULT 0 CHECK (partner_a_income >= 0),
    partner_b_income    BIGINT NOT NULL DEFAULT 0 CHECK (partner_b_income >= 0),
    
    -- Percentuais em basis points (ex: 5523 = 55.23%)
    partner_a_percent   INTEGER NOT NULL DEFAULT 0 CHECK (partner_a_percent BETWEEN 0 AND 10000),
    partner_b_percent   INTEGER NOT NULL DEFAULT 0 CHECK (partner_b_percent BETWEEN 0 AND 10000),
    
    -- Modo de cálculo
    split_mode          TEXT NOT NULL DEFAULT 'unconfigured' CHECK (split_mode IN (
        'proportional', 'single_earner', 'manual', 'unconfigured'
    )),
    
    -- Total de despesas compartilhadas no período (centavos)
    total_shared        BIGINT NOT NULL DEFAULT 0 CHECK (total_shared >= 0),
    
    -- Status do período
    status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    
    -- Versão para controle de recálculos
    recalc_version      SMALLINT NOT NULL DEFAULT 1,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (household_id, competence_month),
    CONSTRAINT chk_pp_percent_sum CHECK (partner_a_percent + partner_b_percent = 10000 OR 
        (partner_a_percent = 0 AND partner_b_percent = 0 AND split_mode = 'unconfigured')),
    CONSTRAINT chk_pp_competence_format CHECK (competence_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

COMMENT ON TABLE proportional_periods IS 'Competência mensal para divisão proporcional entre o casal.';
COMMENT ON COLUMN proportional_periods.partner_a_percent IS 'Percentual em basis points (10000 = 100%). Soma com B deve ser 10000.';

CREATE INDEX idx_pp_household_month ON proportional_periods(household_id, competence_month);

-- ---------------------------------------------------------------------------
-- 2. RESPONSABILIDADES COMPARTILHADAS (despesas a serem divididas)
-- ---------------------------------------------------------------------------
CREATE TABLE shared_responsibilities (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    period_id           UUID NOT NULL REFERENCES proportional_periods(id) ON DELETE CASCADE,
    transaction_id      UUID REFERENCES transactions(id) ON DELETE SET NULL,
    
    description         TEXT NOT NULL,
    category            TEXT NOT NULL DEFAULT 'Outros',
    responsibility_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount        BIGINT NOT NULL CHECK (total_amount > 0),  -- centavos
    
    -- Quem pagou originalmente
    paid_by_member_id   UUID NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    
    -- Divisão aplicada (centavos) — preserva os valores no momento do cálculo
    partner_a_share     BIGINT NOT NULL CHECK (partner_a_share >= 0),
    partner_b_share     BIGINT NOT NULL CHECK (partner_b_share >= 0),
    
    -- Percentuais aplicados na divisão (basis points, snapshot)
    applied_a_percent   INTEGER NOT NULL CHECK (applied_a_percent BETWEEN 0 AND 10000),
    applied_b_percent   INTEGER NOT NULL CHECK (applied_b_percent BETWEEN 0 AND 10000),
    
    -- Status da responsabilidade
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    
    -- Versão do recálculo aplicado
    recalc_version      SMALLINT NOT NULL DEFAULT 1,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Soma das partes deve ser igual ao total
    CONSTRAINT chk_sr_shares_sum CHECK (partner_a_share + partner_b_share = total_amount),
    CONSTRAINT chk_sr_percent_sum CHECK (applied_a_percent + applied_b_percent = 10000)
);

COMMENT ON TABLE shared_responsibilities IS 'Despesas compartilhadas divididas proporcionalmente.';
COMMENT ON COLUMN shared_responsibilities.applied_a_percent IS 'Snapshot do % aplicado. Responsabilidades liquidadas preservam este valor.';

CREATE INDEX idx_sr_household ON shared_responsibilities(household_id);
CREATE INDEX idx_sr_period ON shared_responsibilities(period_id);
CREATE INDEX idx_sr_paid_by ON shared_responsibilities(paid_by_member_id);
CREATE INDEX idx_sr_status ON shared_responsibilities(household_id, status);

-- ---------------------------------------------------------------------------
-- 3. ACERTOS ENTRE O CASAL
-- ---------------------------------------------------------------------------
-- Um acerto só pode ser "settled" quando existe transferência efetiva vinculada.
CREATE TABLE couple_settlements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    period_id           UUID REFERENCES proportional_periods(id) ON DELETE SET NULL,
    
    reference_month     TEXT NOT NULL,
    from_member_id      UUID NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    to_member_id        UUID NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    amount              BIGINT NOT NULL CHECK (amount > 0),  -- centavos
    
    description         TEXT NOT NULL DEFAULT '',
    
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'settled', 'partially_settled', 'cancelled'
    )),
    settled_amount      BIGINT NOT NULL DEFAULT 0 CHECK (settled_amount >= 0),
    settled_date        DATE,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_cs_different_members CHECK (from_member_id != to_member_id),
    CONSTRAINT chk_cs_settled_lte_amount CHECK (settled_amount <= amount),
    CONSTRAINT chk_cs_competence_format CHECK (reference_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

COMMENT ON TABLE couple_settlements IS 'Acertos financeiros entre o casal — requer transferência efetiva para liquidar.';

CREATE INDEX idx_cs_household ON couple_settlements(household_id);
CREATE INDEX idx_cs_month ON couple_settlements(household_id, reference_month);
CREATE INDEX idx_cs_status ON couple_settlements(household_id, status);

-- ---------------------------------------------------------------------------
-- 4. TRANSFERÊNCIAS VINCULADAS A ACERTOS
-- ---------------------------------------------------------------------------
-- Registra cada transferência efetiva que liquida (total ou parcialmente) um acerto.
CREATE TABLE settlement_transfers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    settlement_id   UUID NOT NULL REFERENCES couple_settlements(id) ON DELETE RESTRICT,
    transaction_id  UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
    amount          BIGINT NOT NULL CHECK (amount > 0),  -- centavos
    transfer_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE settlement_transfers IS 'Transferências efetivas que liquidam acertos — garante rastreabilidade.';

CREATE INDEX idx_st_settlement ON settlement_transfers(settlement_id);
CREATE INDEX idx_st_transaction ON settlement_transfers(transaction_id);
