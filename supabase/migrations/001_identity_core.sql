-- ============================================================================
-- MIGRAÇÃO 001: SCHEMA PRINCIPAL — NÚCLEO DE IDENTIDADE
-- Sistema Financeiro do Casal
-- ============================================================================
-- Dependências: nenhuma (migração raiz)
-- Escopo: tabelas de identidade, núcleo financeiro e participantes
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensões
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. NÚCLEO FINANCEIRO (household)
-- ---------------------------------------------------------------------------
-- Cada casal possui um único núcleo financeiro que isola seus dados.
-- Todas as entidades financeiras serão vinculadas a um household_id.
CREATE TABLE households (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name    TEXT NOT NULL DEFAULT 'Nosso Núcleo Financeiro',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE households IS 'Núcleo financeiro do casal — unidade de isolamento de dados.';

-- ---------------------------------------------------------------------------
-- 2. MEMBROS DO NÚCLEO (household_members)
-- ---------------------------------------------------------------------------
-- Vincula um usuário do Supabase Auth ao núcleo financeiro.
-- Cada núcleo tem exatamente 2 membros (partner_a e partner_b).
-- A coluna auth_user_id referencia auth.users(id) mas a FK real será
-- habilitada na Tarefa 04 quando a autenticação for implementada.
CREATE TABLE household_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    auth_user_id    UUID,  -- FK para auth.users será habilitada na Tarefa 04
    partner_role    TEXT NOT NULL CHECK (partner_role IN ('partner_a', 'partner_b')),
    display_name    TEXT NOT NULL DEFAULT '',
    short_name      TEXT NOT NULL DEFAULT '',
    email           TEXT NOT NULL DEFAULT '',
    role_label      TEXT NOT NULL DEFAULT '',
    photo_url       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (household_id, partner_role)
);

COMMENT ON TABLE household_members IS 'Participantes do núcleo financeiro — máximo 2 por household.';
COMMENT ON COLUMN household_members.partner_role IS 'Papel fixo dentro do casal: partner_a ou partner_b.';

CREATE INDEX idx_hm_household ON household_members(household_id);
CREATE INDEX idx_hm_auth_user ON household_members(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. PREFERÊNCIAS / CONFIGURAÇÕES DO NÚCLEO
-- ---------------------------------------------------------------------------
CREATE TABLE household_settings (
    id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id                    UUID NOT NULL UNIQUE REFERENCES households(id) ON DELETE CASCADE,
    default_closing_day             SMALLINT NOT NULL DEFAULT 30 CHECK (default_closing_day BETWEEN 1 AND 31),
    auto_monthly_reset              BOOLEAN NOT NULL DEFAULT TRUE,
    require_transfer_for_settlement BOOLEAN NOT NULL DEFAULT TRUE,
    theme                           TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE household_settings IS 'Configurações globais do núcleo financeiro.';
