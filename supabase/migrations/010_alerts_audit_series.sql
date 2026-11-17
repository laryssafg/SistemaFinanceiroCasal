-- ============================================================================
-- MIGRAÇÃO 010: ALERTAS, AUDITORIA E SÉRIE MENSAL
-- Sistema Financeiro do Casal
-- ============================================================================
-- Dependências: 001
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ALERTAS DO SISTEMA
-- ---------------------------------------------------------------------------
CREATE TABLE system_alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    severity        TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info')),
    module          TEXT NOT NULL DEFAULT 'dashboard',
    alert_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    is_dismissed    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_alerts IS 'Alertas gerados pelo sistema para o casal.';

CREATE INDEX idx_sa_household ON system_alerts(household_id);
CREATE INDEX idx_sa_unread ON system_alerts(household_id, is_read) WHERE NOT is_read;

-- ---------------------------------------------------------------------------
-- 2. TRILHA DE AUDITORIA
-- ---------------------------------------------------------------------------
-- Protegida contra edição por usuárias comuns (via RLS na Tarefa 04).
-- Não armazena senhas, tokens ou segredos.
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    
    -- Autora: referência ao membro ou 'system' para operações automáticas
    actor_member_id UUID REFERENCES household_members(id) ON DELETE SET NULL,
    actor_type      TEXT NOT NULL DEFAULT 'member' CHECK (actor_type IN ('member', 'system')),
    
    -- Operação
    action          TEXT NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE', etc.
    entity_type     TEXT NOT NULL,  -- nome da tabela afetada
    entity_id       UUID,          -- PK do registro afetado
    
    -- Valores (JSONB) — antes e depois
    old_values      JSONB,
    new_values      JSONB,
    
    -- Contexto
    module          TEXT,
    reason          TEXT,
    ip_or_origin    TEXT,
    
    -- Timestamp do servidor (imutável)
    logged_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_logs IS 'Trilha de auditoria imutável. Protegida contra edição por RLS (Tarefa 04).';
COMMENT ON COLUMN audit_logs.old_values IS 'Estado anterior do registro (JSONB). NULL para INSERT.';
COMMENT ON COLUMN audit_logs.new_values IS 'Estado posterior do registro (JSONB). NULL para DELETE.';

-- Apenas INSERT é permitido; UPDATE e DELETE serão bloqueados por RLS na Tarefa 04.
CREATE INDEX idx_al_household ON audit_logs(household_id);
CREATE INDEX idx_al_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_al_logged_at ON audit_logs(logged_at);
CREATE INDEX idx_al_actor ON audit_logs(actor_member_id) WHERE actor_member_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. SÉRIE MENSAL (dados agregados por mês para gráficos)
-- ---------------------------------------------------------------------------
-- Dados computados e armazenados no fechamento para performance de relatórios.
CREATE TABLE monthly_series (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    competence_month TEXT NOT NULL,
    
    -- Valores em centavos
    total_income    BIGINT NOT NULL DEFAULT 0,
    total_expenses  BIGINT NOT NULL DEFAULT 0,
    patrimony       BIGINT NOT NULL DEFAULT 0,
    net_worth       BIGINT NOT NULL DEFAULT 0,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (household_id, competence_month),
    CONSTRAINT chk_ms_competence_format CHECK (competence_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

COMMENT ON TABLE monthly_series IS 'Série mensal agregada para gráficos de evolução patrimonial.';

CREATE INDEX idx_ms_household ON monthly_series(household_id);
