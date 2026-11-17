-- ============================================================================
-- MIGRAÇÃO 013: OPERAÇÃO ATÔMICA DE TRANSFERÊNCIA BANCÁRIA
-- ============================================================================
-- Cria função segura para transferência entre contas do mesmo núcleo
-- Realiza a inserção par ('transfer_out' e 'transfer_in') atomicamente,
-- garantindo conservação de saldo, integridade referencial mútua e
-- validação de isolamento por household_id.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_bank_transfer(
    p_from_account_id UUID,
    p_to_account_id UUID,
    p_amount BIGINT,
    p_description TEXT DEFAULT 'Transferência entre contas',
    p_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_household_id UUID := get_user_household_id();
    v_member_id UUID := get_user_member_id();
    v_from_acc RECORD;
    v_to_acc RECORD;
    v_competence TEXT;
    v_out_id UUID := gen_random_uuid();
    v_in_id UUID := gen_random_uuid();
BEGIN
    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária deve pertencer a um núcleo autenticado.';
    END IF;

    IF p_from_account_id = p_to_account_id THEN
        RAISE EXCEPTION 'A conta de origem e destino não podem ser a mesma.';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'O valor da transferência deve ser maior que zero.';
    END IF;

    -- Valida conta de origem
    SELECT * INTO v_from_acc
    FROM bank_accounts
    WHERE id = p_from_account_id AND household_id = v_household_id;

    IF v_from_acc.id IS NULL THEN
        RAISE EXCEPTION 'Conta de origem inválida ou não pertence ao seu núcleo.';
    END IF;

    -- Valida conta de destino
    SELECT * INTO v_to_acc
    FROM bank_accounts
    WHERE id = p_to_account_id AND household_id = v_household_id;

    IF v_to_acc.id IS NULL THEN
        RAISE EXCEPTION 'Conta de destino inválida ou não pertence ao seu núcleo.';
    END IF;

    v_competence := to_char(p_date, 'YYYY-MM');

    -- Insere débito (transfer_out)
    INSERT INTO transactions (
        id, household_id, member_id, account_id,
        transaction_type, status, scope, payment_method,
        amount, description, notes, transaction_date, competence_month,
        transfer_pair_id
    ) VALUES (
        v_out_id, v_household_id, v_from_acc.member_id, p_from_account_id,
        'transfer_out', 'confirmed', 'individual', 'transfer',
        p_amount, COALESCE(NULLIF(trim(p_description), ''), 'Transferência enviada'),
        p_notes, p_date, v_competence,
        v_in_id
    );

    -- Insere crédito (transfer_in)
    INSERT INTO transactions (
        id, household_id, member_id, account_id,
        transaction_type, status, scope, payment_method,
        amount, description, notes, transaction_date, competence_month,
        transfer_pair_id
    ) VALUES (
        v_in_id, v_household_id, v_to_acc.member_id, p_to_account_id,
        'transfer_in', 'confirmed', 'individual', 'transfer',
        p_amount, COALESCE(NULLIF(trim(p_description), ''), 'Transferência recebida'),
        p_notes, p_date, v_competence,
        v_out_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'transfer_out_id', v_out_id,
        'transfer_in_id', v_in_id,
        'amount', p_amount
    );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE EXECUTE ON FUNCTION create_bank_transfer(UUID, UUID, BIGINT, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_bank_transfer(UUID, UUID, BIGINT, TEXT, DATE, TEXT) TO authenticated, service_role;
