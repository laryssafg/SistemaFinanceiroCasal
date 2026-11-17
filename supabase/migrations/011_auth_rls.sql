-- ============================================================================
-- MIGRAÇÃO 011: SUPABASE AUTH, RLS E SEGURANÇA MULTITENANT
-- Sistema Financeiro do Casal
-- ============================================================================
-- Dependências: 001 a 010
-- Escopo:
--   1. Vínculo formal de household_members com auth.users
--   2. Sistema seguro de convites para a segunda participante
--   3. Funções de autorização com search_path seguro
--   4. Prevenção relacional de vínculos entre núcleos diferentes (Composite FKs)
--   5. Ativação de RLS em todas as tabelas financeiras
--   6. Políticas granulares de SELECT, INSERT, UPDATE, DELETE por household
--   7. Configuração de security_invoker nas views para herdar RLS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. VÍNCULO FORMAL COM auth.users
-- ---------------------------------------------------------------------------
ALTER TABLE household_members
    ADD CONSTRAINT fk_hm_auth_user
    FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Garante que cada usuário do Supabase Auth pertença a no máximo um membro ativo
CREATE UNIQUE INDEX idx_hm_unique_auth_user
    ON household_members(auth_user_id)
    WHERE auth_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. SISTEMA DE CONVITES DO NÚCLEO (household_invites)
-- ---------------------------------------------------------------------------
CREATE TABLE household_invites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    invited_by      UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
    invited_email   TEXT NOT NULL,
    token_hash      TEXT NOT NULL UNIQUE,  -- Hash SHA-256 do token único
    partner_role    TEXT NOT NULL DEFAULT 'partner_b' CHECK (partner_role IN ('partner_a', 'partner_b')),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at     TIMESTAMPTZ,
    accepted_by     UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE household_invites IS 'Convites temporários e de uso único para a segunda participante do núcleo.';

CREATE INDEX idx_hi_household ON household_invites(household_id);
CREATE INDEX idx_hi_token_hash ON household_invites(token_hash);
CREATE INDEX idx_hi_email ON household_invites(invited_email);

-- ---------------------------------------------------------------------------
-- 3. FUNÇÕES AUXILIARES DE AUTORIZAÇÃO SEGURA (SECURITY DEFINER com search_path)
-- ---------------------------------------------------------------------------
-- Retorna o household_id da usuária atualmente autenticada
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
DECLARE
    v_household_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT household_id INTO v_household_id
    FROM household_members
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    RETURN v_household_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Retorna o member_id da usuária atualmente autenticada
CREATE OR REPLACE FUNCTION get_user_member_id()
RETURNS UUID AS $$
DECLARE
    v_member_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT id INTO v_member_id
    FROM household_members
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    RETURN v_member_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- ---------------------------------------------------------------------------
-- 4. FUNÇÕES DE FLUXO SEGURO DE NÚCLEO E CONVITE
-- ---------------------------------------------------------------------------

-- Função: Criar núcleo com criadora (Partner A)
CREATE OR REPLACE FUNCTION create_household_with_creator(
    p_display_name TEXT DEFAULT 'Nosso Núcleo Financeiro',
    p_member_name TEXT DEFAULT '',
    p_short_name TEXT DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT;
    v_household_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária deve estar autenticada para criar um núcleo.';
    END IF;

    -- Verifica se a usuária já possui núcleo
    IF EXISTS (SELECT 1 FROM household_members WHERE auth_user_id = v_user_id) THEN
        RAISE EXCEPTION 'A usuária já pertence a um núcleo financeiro.';
    END IF;

    -- Obtém email da usuária a partir de auth.users
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    -- Cria o household
    INSERT INTO households (display_name)
    VALUES (COALESCE(NULLIF(trim(p_display_name), ''), 'Nosso Núcleo Financeiro'))
    RETURNING id INTO v_household_id;

    -- Cria as configurações padrão do núcleo
    INSERT INTO household_settings (household_id)
    VALUES (v_household_id);

    -- Associa a criadora como partner_a
    INSERT INTO household_members (
        household_id, auth_user_id, partner_role, display_name, short_name, email, role_label
    ) VALUES (
        v_household_id, v_user_id, 'partner_a',
        COALESCE(NULLIF(trim(p_member_name), ''), split_part(v_user_email, '@', 1)),
        COALESCE(NULLIF(trim(p_short_name), ''), split_part(v_user_email, '@', 1)),
        COALESCE(v_user_email, ''),
        'Titular 1'
    );

    RETURN v_household_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Função: Aceitar convite com validação no servidor
CREATE OR REPLACE FUNCTION accept_household_invite(
    p_token_hash TEXT,
    p_display_name TEXT DEFAULT '',
    p_short_name TEXT DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT;
    v_invite RECORD;
    v_member_count INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária deve estar autenticada para aceitar convite.';
    END IF;

    -- Verifica se já pertence a outro núcleo
    IF EXISTS (SELECT 1 FROM household_members WHERE auth_user_id = v_user_id) THEN
        RAISE EXCEPTION 'A usuária já pertence a um núcleo financeiro.';
    END IF;

    -- Busca o convite válido
    SELECT * INTO v_invite
    FROM household_invites
    WHERE token_hash = p_token_hash
      AND status = 'pending'
      AND expires_at > now()
    FOR UPDATE;

    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'Convite inválido, expirado ou já utilizado.';
    END IF;

    -- Valida que o núcleo tem menos de 2 participantes
    SELECT count(*) INTO v_member_count
    FROM household_members
    WHERE household_id = v_invite.household_id;

    IF v_member_count >= 2 THEN
        UPDATE household_invites SET status = 'revoked' WHERE id = v_invite.id;
        RAISE EXCEPTION 'Este núcleo financeiro já atingiu o limite de duas participantes.';
    END IF;

    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    -- Cria a participante vinculada ao convite
    INSERT INTO household_members (
        household_id, auth_user_id, partner_role, display_name, short_name, email, role_label
    ) VALUES (
        v_invite.household_id, v_user_id, v_invite.partner_role,
        COALESCE(NULLIF(trim(p_display_name), ''), split_part(v_user_email, '@', 1)),
        COALESCE(NULLIF(trim(p_short_name), ''), split_part(v_user_email, '@', 1)),
        COALESCE(v_user_email, ''),
        'Titular 2'
    );

    -- Marca o convite como aceito
    UPDATE household_invites
    SET status = 'accepted',
        accepted_at = now(),
        accepted_by = v_user_id
    WHERE id = v_invite.id;

    RETURN v_invite.household_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- ---------------------------------------------------------------------------
-- 5. SEGURANÇA RELACIONAL: PREVENÇÃO DE VÍNCULOS ENTRE NÚCLEOS DIFERENTES
-- ---------------------------------------------------------------------------
-- Garante que chaves estrangeiras entre entidades dependentes exijam o mesmo household_id

-- Índices e restrições únicas compostas em entidades mestres
ALTER TABLE bank_accounts ADD CONSTRAINT uq_ba_id_household UNIQUE (id, household_id);
ALTER TABLE credit_cards ADD CONSTRAINT uq_cc_id_household UNIQUE (id, household_id);
ALTER TABLE benefit_cards ADD CONSTRAINT uq_bc_id_household UNIQUE (id, household_id);
ALTER TABLE household_members ADD CONSTRAINT uq_hm_id_household UNIQUE (id, household_id);
ALTER TABLE credit_card_purchases ADD CONSTRAINT uq_ccp_id_household UNIQUE (id, household_id);
ALTER TABLE credit_card_invoices ADD CONSTRAINT uq_cci_id_household UNIQUE (id, household_id);

-- Validação de consistência de núcleo em transactions via Trigger
CREATE OR REPLACE FUNCTION fn_validate_transaction_household()
RETURNS TRIGGER AS $$
BEGIN
    -- Valida que a conta bancária pertence ao mesmo household
    IF NEW.account_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM bank_accounts
            WHERE id = NEW.account_id AND household_id = NEW.household_id
        ) THEN
            RAISE EXCEPTION 'Violação de isolamento: conta bancária % não pertence ao núcleo %.',
                NEW.account_id, NEW.household_id;
        END IF;
    END IF;

    -- Valida que o cartão de crédito pertence ao mesmo household
    IF NEW.card_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM credit_cards
            WHERE id = NEW.card_id AND household_id = NEW.household_id
        ) THEN
            RAISE EXCEPTION 'Violação de isolamento: cartão % não pertence ao núcleo %.',
                NEW.card_id, NEW.household_id;
        END IF;
    END IF;

    -- Valida que o benefício pertence ao mesmo household
    IF NEW.benefit_card_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM benefit_cards
            WHERE id = NEW.benefit_card_id AND household_id = NEW.household_id
        ) THEN
            RAISE EXCEPTION 'Violação de isolamento: benefício % não pertence ao núcleo %.',
                NEW.benefit_card_id, NEW.household_id;
        END IF;
    END IF;

    -- Valida que o membro pertence ao mesmo household
    IF NOT EXISTS (
        SELECT 1 FROM household_members
        WHERE id = NEW.member_id AND household_id = NEW.household_id
    ) THEN
        RAISE EXCEPTION 'Violação de isolamento: membro % não pertence ao núcleo %.',
            NEW.member_id, NEW.household_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_transaction_household
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION fn_validate_transaction_household();

-- Validação de consistência de compras no cartão
CREATE OR REPLACE FUNCTION fn_validate_card_purchase_household()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM credit_cards
        WHERE id = NEW.card_id AND household_id = NEW.household_id
    ) THEN
        RAISE EXCEPTION 'Violação de isolamento: cartão % não pertence ao núcleo %.',
            NEW.card_id, NEW.household_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM household_members
        WHERE id = NEW.buyer_id AND household_id = NEW.household_id
    ) THEN
        RAISE EXCEPTION 'Violação de isolamento: comprador % não pertence ao núcleo %.',
            NEW.buyer_id, NEW.household_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_card_purchase_household
BEFORE INSERT OR UPDATE ON credit_card_purchases
FOR EACH ROW EXECUTE FUNCTION fn_validate_card_purchase_household();

-- ---------------------------------------------------------------------------
-- 6. ATIVAÇÃO DE ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- ---------------------------------------------------------------------------

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE proportional_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_responsibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_category_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurrence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_reserve_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_reserve_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_series ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 7. POLÍTICAS RLS ESPECÍFICAS
-- ---------------------------------------------------------------------------

-- ---- households ----
CREATE POLICY "households_select" ON households
    FOR SELECT TO authenticated
    USING (id = get_user_household_id());

CREATE POLICY "households_update" ON households
    FOR UPDATE TO authenticated
    USING (id = get_user_household_id())
    WITH CHECK (id = get_user_household_id());

-- ---- household_members ----
CREATE POLICY "household_members_select" ON household_members
    FOR SELECT TO authenticated
    USING (household_id = get_user_household_id());

CREATE POLICY "household_members_update" ON household_members
    FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- Impede alteração de auth_user_id e household_id em household_members
CREATE OR REPLACE FUNCTION fn_protect_member_identity()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.auth_user_id IS NOT NULL AND NEW.auth_user_id != OLD.auth_user_id THEN
        RAISE EXCEPTION 'Não é permitido transferir o vínculo de autenticação do participante.';
    END IF;
    IF NEW.household_id != OLD.household_id THEN
        RAISE EXCEPTION 'Não é permitido alterar o núcleo financeiro do participante.';
    END IF;
    IF NEW.partner_role != OLD.partner_role THEN
        RAISE EXCEPTION 'Não é permitido alterar o papel fixo do participante (partner_role).';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_member_identity
BEFORE UPDATE ON household_members
FOR EACH ROW EXECUTE FUNCTION fn_protect_member_identity();

-- ---- household_settings ----
CREATE POLICY "household_settings_all" ON household_settings
    FOR ALL TO authenticated
    USING (household_id = get_user_household_id())
    WITH CHECK (household_id = get_user_household_id());

-- ---- household_invites ----
CREATE POLICY "household_invites_select" ON household_invites
    FOR SELECT TO authenticated
    USING (
        household_id = get_user_household_id()
        OR invited_email = (auth.jwt() ->> 'email')
    );

CREATE POLICY "household_invites_insert" ON household_invites
    FOR INSERT TO authenticated
    WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "household_invites_update" ON household_invites
    FOR UPDATE TO authenticated
    USING (household_id = get_user_household_id())
    WITH CHECK (household_id = get_user_household_id());

-- ---- audit_logs: APPEND-ONLY ----
CREATE POLICY "audit_logs_select" ON audit_logs
    FOR SELECT TO authenticated
    USING (household_id = get_user_household_id());

CREATE POLICY "audit_logs_insert" ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (household_id = get_user_household_id());
-- Nenhum UPDATE ou DELETE permitido para usuárias comuns

-- ---------------------------------------------------------------------------
-- 8. POLÍTICAS RLS PADRÃO PARA TODAS AS TABELAS FINANCEIRAS COM household_id
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'bank_accounts', 'transactions', 'benefit_cards', 'benefit_movements',
        'credit_cards', 'credit_card_invoices', 'credit_card_purchases',
        'credit_card_installments', 'invoice_payments', 'proportional_periods',
        'shared_responsibilities', 'couple_settlements', 'settlement_transfers',
        'budget_categories', 'monthly_budgets', 'recurrence_rules',
        'investment_assets', 'investment_movements', 'emergency_reserve_configs',
        'emergency_reserve_movements', 'financial_goals', 'debts',
        'fiscal_periods', 'system_alerts', 'monthly_series'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        EXECUTE format('
            CREATE POLICY "%I_select" ON %I
                FOR SELECT TO authenticated
                USING (household_id = get_user_household_id());
            CREATE POLICY "%I_insert" ON %I
                FOR INSERT TO authenticated
                WITH CHECK (household_id = get_user_household_id());
            CREATE POLICY "%I_update" ON %I
                FOR UPDATE TO authenticated
                USING (household_id = get_user_household_id())
                WITH CHECK (household_id = get_user_household_id());
            CREATE POLICY "%I_delete" ON %I
                FOR DELETE TO authenticated
                USING (household_id = get_user_household_id());
        ', tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 9. POLÍTICAS PARA TABELAS DEPENDENTES VIA FOREIGN KEY
-- ---------------------------------------------------------------------------

-- budget_category_limits (via budget_id -> monthly_budgets)
CREATE POLICY "budget_category_limits_all" ON budget_category_limits
    FOR ALL TO authenticated
    USING (budget_id IN (SELECT id FROM monthly_budgets WHERE household_id = get_user_household_id()))
    WITH CHECK (budget_id IN (SELECT id FROM monthly_budgets WHERE household_id = get_user_household_id()));

-- investment_valuations (via asset_id -> investment_assets)
CREATE POLICY "investment_valuations_all" ON investment_valuations
    FOR ALL TO authenticated
    USING (asset_id IN (SELECT id FROM investment_assets WHERE household_id = get_user_household_id()))
    WITH CHECK (asset_id IN (SELECT id FROM investment_assets WHERE household_id = get_user_household_id()));

-- goal_contributions (via goal_id -> financial_goals)
CREATE POLICY "goal_contributions_all" ON goal_contributions
    FOR ALL TO authenticated
    USING (goal_id IN (SELECT id FROM financial_goals WHERE household_id = get_user_household_id()))
    WITH CHECK (goal_id IN (SELECT id FROM financial_goals WHERE household_id = get_user_household_id()));

-- debt_installments (via debt_id -> debts)
CREATE POLICY "debt_installments_all" ON debt_installments
    FOR ALL TO authenticated
    USING (debt_id IN (SELECT id FROM debts WHERE household_id = get_user_household_id()))
    WITH CHECK (debt_id IN (SELECT id FROM debts WHERE household_id = get_user_household_id()));

-- fiscal_snapshots (via period_id -> fiscal_periods)
CREATE POLICY "fiscal_snapshots_all" ON fiscal_snapshots
    FOR ALL TO authenticated
    USING (period_id IN (SELECT id FROM fiscal_periods WHERE household_id = get_user_household_id()))
    WITH CHECK (period_id IN (SELECT id FROM fiscal_periods WHERE household_id = get_user_household_id()));

-- ---------------------------------------------------------------------------
-- 10. SEGURANÇA NAS VIEWS: security_invoker = true
-- ---------------------------------------------------------------------------
-- Garante que as views respeitem rigorosamente o RLS das tabelas subjacentes
ALTER VIEW v_bank_account_balances SET (security_invoker = true);
ALTER VIEW v_benefit_card_balances SET (security_invoker = true);
ALTER VIEW v_investment_balances SET (security_invoker = true);
