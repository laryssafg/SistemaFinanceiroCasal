-- ============================================================================
-- MIGRAÇÃO 007: INVESTIMENTOS E RESERVA DE EMERGÊNCIA
-- Sistema Financeiro do Casal
-- ============================================================================
-- Dependências: 001, 002
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ATIVOS DE INVESTIMENTO
-- ---------------------------------------------------------------------------
CREATE TABLE investment_assets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    owner_id            UUID REFERENCES household_members(id) ON DELETE SET NULL,
    
    asset_name          TEXT NOT NULL,
    institution         TEXT NOT NULL,
    asset_class         TEXT NOT NULL CHECK (asset_class IN (
        'renda_fixa', 'tesouro_direto', 'acoes_fiis', 'internacional', 'previdencia'
    )),
    
    -- Escopo: individual ou planejamento conjunto
    scope               TEXT NOT NULL DEFAULT 'individual' CHECK (scope IN ('individual', 'joint')),
    is_joint_planning   BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Flag: este investimento é a reserva de emergência?
    -- Se TRUE, o saldo NÃO é contado separadamente no patrimônio (evita dupla contagem)
    is_emergency_reserve BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Valores em centavos
    invested_amount     BIGINT NOT NULL DEFAULT 0 CHECK (invested_amount >= 0),
    
    -- Rentabilidade anual (basis points, 10000 = 100.00%)
    annual_return_bps   INTEGER NOT NULL DEFAULT 0,
    
    liquidity           TEXT NOT NULL DEFAULT 'D+0',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE investment_assets IS 'Ativos de investimento. Saldo atual é derivado de aportes e resgates.';
COMMENT ON COLUMN investment_assets.is_emergency_reserve IS 'Se TRUE, saldo pertence à reserva de emergência (sem dupla contagem no patrimônio).';

CREATE INDEX idx_ia_household ON investment_assets(household_id);
CREATE INDEX idx_ia_owner ON investment_assets(owner_id) WHERE owner_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. MOVIMENTAÇÕES DE INVESTIMENTO (aportes, resgates, rendimentos)
-- ---------------------------------------------------------------------------
CREATE TABLE investment_movements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    asset_id            UUID NOT NULL REFERENCES investment_assets(id) ON DELETE CASCADE,
    member_id           UUID REFERENCES household_members(id) ON DELETE SET NULL,
    
    movement_type       TEXT NOT NULL CHECK (movement_type IN (
        'contribution', 'withdrawal', 'yield_update'
    )),
    amount              BIGINT NOT NULL CHECK (amount >= 0),  -- centavos
    
    -- Conta bancária de origem/destino (para aportes/resgates)
    account_id          UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
    -- Transação bancária vinculada
    transaction_id      UUID REFERENCES transactions(id) ON DELETE SET NULL,
    
    movement_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    notes               TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE investment_movements IS 'Aportes, resgates e atualizações de rendimento dos investimentos.';

CREATE INDEX idx_im_asset ON investment_movements(asset_id);
CREATE INDEX idx_im_household ON investment_movements(household_id);

-- ---------------------------------------------------------------------------
-- 3. AVALIAÇÕES PATRIMONIAIS (snapshots de saldo do ativo)
-- ---------------------------------------------------------------------------
-- Permite registrar manualmente o saldo atualizado do investimento
-- sem necessidade de integração automática com corretoras.
CREATE TABLE investment_valuations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id        UUID NOT NULL REFERENCES investment_assets(id) ON DELETE CASCADE,
    valuation_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    balance         BIGINT NOT NULL CHECK (balance >= 0),  -- centavos
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (asset_id, valuation_date)
);

COMMENT ON TABLE investment_valuations IS 'Snapshots manuais de saldo atualizado do investimento.';

CREATE INDEX idx_iv_asset ON investment_valuations(asset_id);

-- ---------------------------------------------------------------------------
-- 4. VIEW: SALDO ATUAL DE INVESTIMENTOS
-- ---------------------------------------------------------------------------
-- Usa a avaliação mais recente, ou calcula com base em aportes/resgates.
CREATE OR REPLACE VIEW v_investment_balances AS
SELECT
    ia.id AS asset_id,
    ia.household_id,
    ia.owner_id,
    ia.asset_name,
    ia.asset_class,
    ia.scope,
    ia.is_emergency_reserve,
    ia.invested_amount,
    ia.is_active,
    COALESCE(
        latest_val.balance,
        ia.invested_amount + COALESCE(movements.net, 0)
    ) AS current_balance,
    latest_val.valuation_date AS last_valuation_date
FROM investment_assets ia
LEFT JOIN LATERAL (
    SELECT iv.balance, iv.valuation_date
    FROM investment_valuations iv
    WHERE iv.asset_id = ia.id
    ORDER BY iv.valuation_date DESC
    LIMIT 1
) latest_val ON TRUE
LEFT JOIN LATERAL (
    SELECT
        SUM(CASE WHEN im.movement_type = 'contribution' THEN im.amount ELSE 0 END)
        - SUM(CASE WHEN im.movement_type = 'withdrawal' THEN im.amount ELSE 0 END)
        + SUM(CASE WHEN im.movement_type = 'yield_update' THEN im.amount ELSE 0 END)
        AS net
    FROM investment_movements im
    WHERE im.asset_id = ia.id
) movements ON TRUE;

COMMENT ON VIEW v_investment_balances IS 'Saldo atual de investimentos: última avaliação ou cálculo de movimentações.';

-- ---------------------------------------------------------------------------
-- 5. CONFIGURAÇÃO DA RESERVA DE EMERGÊNCIA
-- ---------------------------------------------------------------------------
CREATE TABLE emergency_reserve_configs (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id                UUID NOT NULL UNIQUE REFERENCES households(id) ON DELETE CASCADE,
    is_configured               BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Referência ao investimento que serve como reserva
    linked_asset_id             UUID REFERENCES investment_assets(id) ON DELETE SET NULL,
    
    -- Parâmetros em centavos
    essential_monthly_baseline  BIGINT NOT NULL DEFAULT 0 CHECK (essential_monthly_baseline >= 0),
    target_months               SMALLINT NOT NULL DEFAULT 12 CHECK (target_months >= 1),
    target_amount               BIGINT NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
    monthly_planned_deposit     BIGINT NOT NULL DEFAULT 0 CHECK (monthly_planned_deposit >= 0),
    
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE emergency_reserve_configs IS 'Configuração da reserva de emergência conjunta. Meta: 12 meses de essenciais.';

-- ---------------------------------------------------------------------------
-- 6. MOVIMENTAÇÕES DA RESERVA DE EMERGÊNCIA
-- ---------------------------------------------------------------------------
CREATE TABLE emergency_reserve_movements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    config_id       UUID NOT NULL REFERENCES emergency_reserve_configs(id) ON DELETE CASCADE,
    member_id       UUID NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    
    movement_type   TEXT NOT NULL CHECK (movement_type IN ('deposit', 'withdrawal')),
    amount          BIGINT NOT NULL CHECK (amount > 0),  -- centavos
    
    -- Retiradas exigem motivo registrado
    reason          TEXT,
    
    -- Conta de origem/destino
    destination_or_origin TEXT NOT NULL DEFAULT '',
    
    -- Vínculo com investimento/transação
    investment_movement_id UUID REFERENCES investment_movements(id) ON DELETE SET NULL,
    transaction_id  UUID REFERENCES transactions(id) ON DELETE SET NULL,
    
    movement_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_erm_withdrawal_reason CHECK (
        movement_type != 'withdrawal' OR (reason IS NOT NULL AND reason != '')
    )
);

COMMENT ON TABLE emergency_reserve_movements IS 'Contribuições e retiradas da reserva de emergência. Retiradas exigem justificativa.';

CREATE INDEX idx_erm_household ON emergency_reserve_movements(household_id);
CREATE INDEX idx_erm_config ON emergency_reserve_movements(config_id);
CREATE INDEX idx_erm_member ON emergency_reserve_movements(member_id);
