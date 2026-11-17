-- =============================================================================
-- Migração 014 — Correção do RPC create_bank_transfer (FK circular)
-- =============================================================================
-- Problema: A versão anterior inseria transfer_out com transfer_pair_id = v_in_id
-- antes de v_in_id existir na tabela, causando violação de FK (código 23503).
-- Solução: Inserir ambas as linhas sem transfer_pair_id e depois atualizar
-- os dois registros para referenciarem um ao outro.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_bank_transfer(
  p_from_account_id UUID,
  p_to_account_id   UUID,
  p_amount          BIGINT,          -- valor em centavos
  p_description     TEXT    DEFAULT 'Transferência entre contas',
  p_date            DATE    DEFAULT CURRENT_DATE,
  p_notes           TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_household_id UUID;
  v_member_id    UUID;
  v_out_id       UUID := gen_random_uuid();
  v_in_id        UUID := gen_random_uuid();
  v_month        TEXT;
  v_from_acc     RECORD;
  v_to_acc       RECORD;
BEGIN
  -- Obter household e member do usuário autenticado via funções existentes
  v_household_id := get_user_household_id();
  v_member_id    := get_user_member_id();

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: usuária deve pertencer a um núcleo autenticado.';
  END IF;

  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'A conta de origem e destino não podem ser a mesma.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor da transferência deve ser maior que zero.';
  END IF;

  -- Validar conta de origem pertence ao household
  SELECT * INTO v_from_acc
  FROM bank_accounts
  WHERE id = p_from_account_id AND household_id = v_household_id AND is_active = TRUE;

  IF v_from_acc.id IS NULL THEN
    RAISE EXCEPTION 'Conta de origem inválida, inativa ou não pertence ao seu núcleo.';
  END IF;

  -- Validar conta de destino pertence ao household
  SELECT * INTO v_to_acc
  FROM bank_accounts
  WHERE id = p_to_account_id AND household_id = v_household_id AND is_active = TRUE;

  IF v_to_acc.id IS NULL THEN
    RAISE EXCEPTION 'Conta de destino inválida, inativa ou não pertence ao seu núcleo.';
  END IF;

  -- Calcular competência
  v_month := TO_CHAR(p_date, 'YYYY-MM');

  -- -----------------------------------------------------------------------
  -- PASSO 1: Inserir as duas transações SEM transfer_pair_id
  -- (evita violação de FK circular — a constraint é avaliada por INSERT)
  -- -----------------------------------------------------------------------
  INSERT INTO transactions (
    id, household_id, member_id, account_id,
    transaction_type, status, scope, payment_method,
    amount, description, notes,
    transaction_date, competence_month
  ) VALUES (
    v_out_id, v_household_id, v_from_acc.member_id, p_from_account_id,
    'transfer_out', 'confirmed', 'individual', 'transfer',
    p_amount,
    COALESCE(NULLIF(TRIM(p_description), ''), 'Transferência enviada'),
    p_notes,
    p_date, v_month
  );

  INSERT INTO transactions (
    id, household_id, member_id, account_id,
    transaction_type, status, scope, payment_method,
    amount, description, notes,
    transaction_date, competence_month
  ) VALUES (
    v_in_id, v_household_id, v_to_acc.member_id, p_to_account_id,
    'transfer_in', 'confirmed', 'individual', 'transfer',
    p_amount,
    COALESCE(NULLIF(TRIM(p_description), ''), 'Transferência recebida'),
    p_notes,
    p_date, v_month
  );

  -- -----------------------------------------------------------------------
  -- PASSO 2: Atualizar ambas para se referenciarem mutuamente
  -- (agora ambas existem na tabela — sem risco de violação de FK)
  -- -----------------------------------------------------------------------
  UPDATE transactions SET transfer_pair_id = v_in_id  WHERE id = v_out_id;
  UPDATE transactions SET transfer_pair_id = v_out_id WHERE id = v_in_id;

  RETURN jsonb_build_object(
    'success',          TRUE,
    'transfer_out_id',  v_out_id,
    'transfer_in_id',   v_in_id,
    'amount',           p_amount
  );
END;
$$;

-- Garantir que apenas usuários autenticados podem chamar esta função
REVOKE EXECUTE ON FUNCTION public.create_bank_transfer(UUID, UUID, BIGINT, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_bank_transfer(UUID, UUID, BIGINT, TEXT, DATE, TEXT) TO authenticated, service_role;
