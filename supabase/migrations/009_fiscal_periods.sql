-- ============================================================================
-- MIGRAÇÃO 009: FECHAMENTO MENSAL E SNAPSHOTS
-- Sistema Financeiro do Casal
-- ============================================================================
-- Dependências: 001, 002
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. COMPETÊNCIAS FINANCEIRAS (períodos mensais)
-- ---------------------------------------------------------------------------
CREATE TABLE fiscal_periods (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    competence_month TEXT NOT NULL,
    
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'closed', 'reopened'
    )),
    
    -- Controle de versões de fechamento
    close_version   SMALLINT NOT NULL DEFAULT 0,
    
    closed_at       TIMESTAMPTZ,
    closed_by       UUID REFERENCES household_members(id),
    
    -- Reabertura
    reopened_at     TIMESTAMPTZ,
    reopened_by     UUID REFERENCES household_members(id),
    reopen_reason   TEXT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (household_id, competence_month),
    CONSTRAINT chk_fp_competence_format CHECK (competence_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

COMMENT ON TABLE fiscal_periods IS 'Competências financeiras. Meses fechados bloqueiam alterações comuns.';
COMMENT ON COLUMN fiscal_periods.close_version IS 'Incrementa a cada reabertura+fechamento. Versão 0 = nunca fechado.';

CREATE INDEX idx_fp_household_month ON fiscal_periods(household_id, competence_month);

-- ---------------------------------------------------------------------------
-- 2. SNAPSHOTS DE FECHAMENTO
-- ---------------------------------------------------------------------------
-- Captura o estado financeiro no momento do fechamento.
-- Preservado integralmente mesmo após reaberturas.
CREATE TABLE fiscal_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id       UUID NOT NULL REFERENCES fiscal_periods(id) ON DELETE CASCADE,
    snapshot_version SMALLINT NOT NULL DEFAULT 1,
    
    -- Valores em centavos
    total_income        BIGINT NOT NULL DEFAULT 0,
    total_expenses      BIGINT NOT NULL DEFAULT 0,
    total_bank_balance  BIGINT NOT NULL DEFAULT 0,
    total_benefits_balance BIGINT NOT NULL DEFAULT 0,
    total_investments   BIGINT NOT NULL DEFAULT 0,
    emergency_reserve   BIGINT NOT NULL DEFAULT 0,
    total_debts         BIGINT NOT NULL DEFAULT 0,
    gross_patrimony     BIGINT NOT NULL DEFAULT 0,
    net_worth           BIGINT NOT NULL DEFAULT 0,
    
    -- Divisão proporcional snapshot
    partner_a_income    BIGINT NOT NULL DEFAULT 0,
    partner_b_income    BIGINT NOT NULL DEFAULT 0,
    partner_a_percent   INTEGER NOT NULL DEFAULT 0,  -- basis points
    partner_b_percent   INTEGER NOT NULL DEFAULT 0,
    total_shared        BIGINT NOT NULL DEFAULT 0,
    pending_settlements BIGINT NOT NULL DEFAULT 0,
    
    -- Dados serializados adicionais (JSON para extensibilidade futura)
    extra_data          JSONB,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (period_id, snapshot_version)
);

COMMENT ON TABLE fiscal_snapshots IS 'Snapshots financeiros de fechamento. Preservados após reaberturas.';

CREATE INDEX idx_fs_period ON fiscal_snapshots(period_id);

-- ---------------------------------------------------------------------------
-- 3. FUNÇÃO E TRIGGERS: IMPEDIR ALTERAÇÕES EM MESES FECHADOS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_fiscal_period_open()
RETURNS TRIGGER AS $$
DECLARE
    target_month TEXT;
    target_household UUID;
    period_status TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_month := OLD.competence_month;
        target_household := OLD.household_id;
    ELSE
        target_month := NEW.competence_month;
        target_household := NEW.household_id;
    END IF;

    SELECT status INTO period_status
    FROM fiscal_periods
    WHERE household_id = target_household
      AND competence_month = target_month;

    IF period_status = 'closed' THEN
        RAISE EXCEPTION 'A competência % está fechada para o núcleo financeiro %. Operação % bloqueada.',
            target_month, target_household, TG_OP;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_fiscal_period_transactions
BEFORE INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION fn_check_fiscal_period_open();
