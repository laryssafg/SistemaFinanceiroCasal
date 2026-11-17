-- =============================================================================
-- Migração 016 — Integração dos Benefícios VR/VA: RPCs Atômicas e Melhorias
-- Sistema Financeiro do Casal
-- =============================================================================
-- Dependências: 003_benefits_vr_va.sql, 011_auth_rls.sql
-- Regras inegociáveis (preservadas):
--   • Compra com VR/VA NUNCA diminui saldo bancário.
--   • Créditos VR/VA NÃO entram no cálculo de renda líquida monetária.
--   • Saldo negativo de benefícios é proibido.
--   • Estornos são reversões lógicas com vínculo ao lançamento original.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Adicionar colunas de suporte a estornos e ajustes em benefit_movements
-- ---------------------------------------------------------------------------
-- Coluna: reversed_by — aponta para o movement de estorno (se este foi estornado)
ALTER TABLE benefit_movements
    ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES benefit_movements(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_reversal  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS original_movement_id UUID REFERENCES benefit_movements(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN benefit_movements.reversed_by IS
    'ID do movement de estorno que cancela este lançamento. NULL = ativo.';
COMMENT ON COLUMN benefit_movements.is_reversal IS
    'TRUE quando este movement é um estorno de outro lançamento.';
COMMENT ON COLUMN benefit_movements.original_movement_id IS
    'Para estornos: ID do movement original que foi revertido.';
COMMENT ON COLUMN benefit_movements.notes IS
    'Motivo do ajuste ou estorno.';

-- ---------------------------------------------------------------------------
-- 2. Constraint: um movement só pode ser estornado uma vez
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_bm_one_reversal_per_movement
    ON benefit_movements(original_movement_id)
    WHERE original_movement_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Atualizar a view v_benefit_card_balances para excluir estornados
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_benefit_card_balances AS
SELECT
    bc.id               AS benefit_card_id,
    bc.household_id,
    bc.member_id,
    bc.benefit_type,
    bc.provider_name,
    bc.monthly_credit,
    bc.is_active,
    COALESCE(credits.total, 0)    AS total_credits,
    COALESCE(purchases.total, 0)  AS total_purchases,
    COALESCE(credits.total, 0) - COALESCE(purchases.total, 0) AS current_balance
FROM benefit_cards bc
LEFT JOIN LATERAL (
    SELECT SUM(bm.amount) AS total
    FROM benefit_movements bm
    WHERE bm.benefit_card_id = bc.id
      AND bm.movement_type = 'credit'
      AND bm.reversed_by IS NULL        -- exclui créditos que foram estornados
      AND bm.is_reversal = FALSE        -- exclui o registro de estorno em si (o cancelamento do débito já restaura o saldo)
) credits ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(bm.amount) AS total
    FROM benefit_movements bm
    WHERE bm.benefit_card_id = bc.id
      AND bm.movement_type = 'purchase'
      AND bm.reversed_by IS NULL        -- exclui compras que foram estornadas
      AND bm.is_reversal = FALSE        -- exclui o registro de estorno em si
) purchases ON TRUE;

COMMENT ON VIEW v_benefit_card_balances IS
    'Saldos de benefícios VR/VA derivados de créditos e compras, excluindo estornados.';

-- ---------------------------------------------------------------------------
-- 4. RPC: register_benefit_credit — Registrar crédito recebido (atômico)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_benefit_credit(
    p_benefit_card_id  UUID,
    p_amount_cents     BIGINT,       -- valor em centavos
    p_description      TEXT DEFAULT '',
    p_movement_date    DATE DEFAULT CURRENT_DATE,
    p_competence_month TEXT DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM')
)
RETURNS UUID AS $$
DECLARE
    v_household_id UUID;
    v_member_id    UUID;
    v_movement_id  UUID;
BEGIN
    -- Autenticação obrigatória
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária deve estar autenticada.';
    END IF;

    v_household_id := get_user_household_id();
    v_member_id    := get_user_member_id();

    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária não pertence a um núcleo financeiro.';
    END IF;

    -- Validação de valor
    IF p_amount_cents <= 0 THEN
        RAISE EXCEPTION 'O valor do crédito deve ser maior que zero (recebido: % centavos).', p_amount_cents;
    END IF;

    -- Verificar que o cartão pertence ao mesmo núcleo financeiro
    IF NOT EXISTS (
        SELECT 1 FROM benefit_cards
        WHERE id = p_benefit_card_id AND household_id = v_household_id AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Cartão de benefício não encontrado ou não pertence ao seu núcleo financeiro.';
    END IF;

    -- Validar formato de competência
    IF p_competence_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
        RAISE EXCEPTION 'Formato de competência inválido (esperado YYYY-MM): %', p_competence_month;
    END IF;

    -- Inserir crédito
    INSERT INTO benefit_movements (
        household_id,
        benefit_card_id,
        movement_type,
        amount,
        description,
        movement_date,
        competence_month,
        created_by
    ) VALUES (
        v_household_id,
        p_benefit_card_id,
        'credit',
        p_amount_cents,
        p_description,
        p_movement_date,
        p_competence_month,
        v_member_id
    )
    RETURNING id INTO v_movement_id;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, auth, pg_temp;

COMMENT ON FUNCTION register_benefit_credit IS
    'Registra um crédito (recarga) em cartão de benefício VR/VA. Não afeta contas bancárias.';

GRANT EXECUTE ON FUNCTION register_benefit_credit TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC: register_benefit_purchase — Registrar consumo com validação de saldo (atômico)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_benefit_purchase(
    p_benefit_card_id  UUID,
    p_amount_cents     BIGINT,       -- valor em centavos
    p_description      TEXT DEFAULT '',
    p_category         TEXT DEFAULT 'Alimentação e Mercado',
    p_movement_date    DATE DEFAULT CURRENT_DATE,
    p_competence_month TEXT DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
    p_notes            TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_household_id  UUID;
    v_member_id     UUID;
    v_current_balance BIGINT;
    v_movement_id   UUID;
BEGIN
    -- Autenticação obrigatória
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária deve estar autenticada.';
    END IF;

    v_household_id := get_user_household_id();
    v_member_id    := get_user_member_id();

    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária não pertence a um núcleo financeiro.';
    END IF;

    -- Validação de valor
    IF p_amount_cents <= 0 THEN
        RAISE EXCEPTION 'O valor da compra deve ser maior que zero (recebido: % centavos).', p_amount_cents;
    END IF;

    -- Validar formato de competência
    IF p_competence_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
        RAISE EXCEPTION 'Formato de competência inválido (esperado YYYY-MM): %', p_competence_month;
    END IF;

    -- Verificar que o cartão pertence ao mesmo núcleo e está ativo
    -- Usar FOR UPDATE para evitar race condition (concorrência)
    PERFORM 1 FROM benefit_cards
    WHERE id = p_benefit_card_id AND household_id = v_household_id AND is_active = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cartão de benefício não encontrado ou não pertence ao seu núcleo financeiro.';
    END IF;

    -- Calcular saldo atual DENTRO da transação com FOR UPDATE para serialização
    SELECT current_balance INTO v_current_balance
    FROM v_benefit_card_balances
    WHERE benefit_card_id = p_benefit_card_id;

    IF v_current_balance IS NULL THEN
        v_current_balance := 0;
    END IF;

    -- Regra: saldo insuficiente → rejeitar
    IF p_amount_cents > v_current_balance THEN
        RAISE EXCEPTION 'Saldo insuficiente. Saldo disponível: % centavos (R$ %), compra solicitada: % centavos (R$ %).',
            v_current_balance,
            (v_current_balance::NUMERIC / 100)::TEXT,
            p_amount_cents,
            (p_amount_cents::NUMERIC / 100)::TEXT;
    END IF;

    -- Inserir consumo
    INSERT INTO benefit_movements (
        household_id,
        benefit_card_id,
        movement_type,
        amount,
        description,
        category,
        movement_date,
        competence_month,
        created_by,
        notes
    ) VALUES (
        v_household_id,
        p_benefit_card_id,
        'purchase',
        p_amount_cents,
        p_description,
        p_category,
        p_movement_date,
        p_competence_month,
        v_member_id,
        p_notes
    )
    RETURNING id INTO v_movement_id;

    -- REGRA INEGOCIÁVEL: NÃO inserir em bank_accounts nem transactions bancárias.
    -- O isolamento patrimonial é garantido pelo banco de dados, não pelo frontend.

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, auth, pg_temp;

COMMENT ON FUNCTION register_benefit_purchase IS
    'Registra consumo em VR/VA com validação atômica de saldo. Rejeita se saldo insuficiente. NUNCA afeta contas bancárias.';

GRANT EXECUTE ON FUNCTION register_benefit_purchase TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC: reverse_benefit_movement — Estornar movimento com rastreabilidade
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reverse_benefit_movement(
    p_movement_id UUID,
    p_reason      TEXT DEFAULT 'Estorno solicitado pela usuária'
)
RETURNS UUID AS $$
DECLARE
    v_household_id      UUID;
    v_member_id         UUID;
    v_original          benefit_movements%ROWTYPE;
    v_reversal_id       UUID;
BEGIN
    -- Autenticação
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária deve estar autenticada.';
    END IF;

    v_household_id := get_user_household_id();
    v_member_id    := get_user_member_id();

    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária não pertence a um núcleo financeiro.';
    END IF;

    -- Buscar o movimento original com FOR UPDATE para evitar estorno duplo concorrente
    SELECT * INTO v_original
    FROM benefit_movements
    WHERE id = p_movement_id AND household_id = v_household_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimento não encontrado ou não pertence ao seu núcleo financeiro.';
    END IF;

    -- Impedir estorno de um estorno
    IF v_original.is_reversal THEN
        RAISE EXCEPTION 'Não é possível estornar um estorno. Apenas lançamentos originais podem ser revertidos.';
    END IF;

    -- Impedir estorno duplo (já foi estornado)
    IF v_original.reversed_by IS NOT NULL THEN
        RAISE EXCEPTION 'Este lançamento já foi estornado (ID do estorno: %).', v_original.reversed_by;
    END IF;

    -- Para estorno de compra: verificar que o crédito de volta não criará inconsistência
    -- (o banco retorna o valor ao saldo, o que é esperado)
    -- Para estorno de crédito: verificar saldo suficiente para absorver o estorno
    IF v_original.movement_type = 'credit' THEN
        DECLARE
            v_balance_after BIGINT;
        BEGIN
            -- Saldo atual
            SELECT current_balance INTO v_balance_after
            FROM v_benefit_card_balances
            WHERE benefit_card_id = v_original.benefit_card_id;

            IF COALESCE(v_balance_after, 0) < v_original.amount THEN
                RAISE EXCEPTION 'Não é possível estornar este crédito: o saldo atual (% centavos) é menor que o valor do crédito (% centavos). Registre consumos de ajuste se necessário.',
                    COALESCE(v_balance_after, 0), v_original.amount;
            END IF;
        END;
    END IF;

    -- Criar o movimento de estorno (tipo inverso)
    INSERT INTO benefit_movements (
        household_id,
        benefit_card_id,
        movement_type,
        amount,
        description,
        category,
        movement_date,
        competence_month,
        created_by,
        is_reversal,
        original_movement_id,
        notes
    ) VALUES (
        v_household_id,
        v_original.benefit_card_id,
        CASE WHEN v_original.movement_type = 'purchase' THEN 'credit'
             ELSE 'purchase' END,  -- estorno inverte o tipo para compensar no saldo
        v_original.amount,
        'ESTORNO: ' || v_original.description,
        v_original.category,
        CURRENT_DATE,
        TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
        v_member_id,
        TRUE,                   -- is_reversal
        p_movement_id,          -- original_movement_id
        p_reason
    )
    RETURNING id INTO v_reversal_id;

    -- Marcar o original como estornado
    UPDATE benefit_movements
    SET reversed_by = v_reversal_id
    WHERE id = p_movement_id;

    RETURN v_reversal_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, auth, pg_temp;

COMMENT ON FUNCTION reverse_benefit_movement IS
    'Estorna um movimento de benefício VR/VA com rastreabilidade. Impede estorno duplo. Para compras, devolve saldo. Para créditos, verifica saldo.';

GRANT EXECUTE ON FUNCTION reverse_benefit_movement TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC: register_benefit_card — Criar cartão com saldo inicial (atômico)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_benefit_card(
    p_member_id       UUID,
    p_benefit_type    TEXT,          -- 'VR' ou 'VA'
    p_provider_name   TEXT,
    p_monthly_credit  BIGINT DEFAULT 0,
    p_initial_balance BIGINT DEFAULT 0  -- saldo inicial em centavos
)
RETURNS UUID AS $$
DECLARE
    v_household_id UUID;
    v_member_id    UUID;
    v_card_id      UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária deve estar autenticada.';
    END IF;

    v_household_id := get_user_household_id();
    v_member_id    := get_user_member_id();

    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária não pertence a um núcleo financeiro.';
    END IF;

    -- Validar tipo
    IF p_benefit_type NOT IN ('VR', 'VA') THEN
        RAISE EXCEPTION 'Tipo de benefício inválido (esperado VR ou VA): %', p_benefit_type;
    END IF;

    -- Validar nome da operadora
    IF TRIM(p_provider_name) = '' THEN
        RAISE EXCEPTION 'O nome da operadora não pode estar vazio.';
    END IF;

    -- Verificar que o membro pertence ao mesmo núcleo
    IF NOT EXISTS (
        SELECT 1 FROM household_members
        WHERE id = p_member_id AND household_id = v_household_id
    ) THEN
        RAISE EXCEPTION 'Membro não encontrado ou não pertence ao seu núcleo financeiro.';
    END IF;

    -- Criar o cartão
    INSERT INTO benefit_cards (
        household_id,
        member_id,
        benefit_type,
        provider_name,
        monthly_credit,
        is_active
    ) VALUES (
        v_household_id,
        p_member_id,
        p_benefit_type,
        TRIM(p_provider_name),
        GREATEST(0, p_monthly_credit),
        TRUE
    )
    RETURNING id INTO v_card_id;

    -- Se houver saldo inicial, registrar como crédito
    IF p_initial_balance > 0 THEN
        PERFORM register_benefit_credit(
            v_card_id,
            p_initial_balance,
            'Saldo inicial do cartão',
            CURRENT_DATE,
            TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        );
    END IF;

    RETURN v_card_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, auth, pg_temp;

COMMENT ON FUNCTION register_benefit_card IS
    'Cria cartão de benefício VR/VA com saldo inicial opcional. Atômico.';

GRANT EXECUTE ON FUNCTION register_benefit_card TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Índice adicional para performance de estornos
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bm_original_movement
    ON benefit_movements(original_movement_id)
    WHERE original_movement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bm_active
    ON benefit_movements(benefit_card_id)
    WHERE reversed_by IS NULL;
