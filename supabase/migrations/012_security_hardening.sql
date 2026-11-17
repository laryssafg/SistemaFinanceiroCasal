-- ============================================================================
-- MIGRAÇÃO 012: ENDURECIMENTO DE SEGURANÇA (AUDITORIA TAREFA 04.1)
-- ============================================================================
-- Correções apontadas na auditoria de segurança:
-- 1. Restrição estrita de convites ao e-mail informado (case-insensitive).
-- 2. Revogação de privilégios públicos padrão e concessão do menor privilégio.
-- 3. Definição explícita de search_path seguro nas triggers e funções do sistema.
-- 4. Tratamento atômico e idempotente para validação de concorrência.
-- ============================================================================

-- 1. Revogar execução de funções de autorização de usuários anônimos (anon)
REVOKE EXECUTE ON FUNCTION get_user_household_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_user_household_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION get_user_member_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_user_member_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION create_household_with_creator(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_household_with_creator(TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION accept_household_invite(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION accept_household_invite(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 2. Reforçar accept_household_invite com validação estrita de e-mail e concorrência
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

    -- Obtém email da usuária autenticada
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'Usuária sem e-mail válido no sistema de autenticação.';
    END IF;

    -- Verifica se já pertence a outro núcleo
    IF EXISTS (SELECT 1 FROM household_members WHERE auth_user_id = v_user_id) THEN
        RAISE EXCEPTION 'A usuária já pertence a um núcleo financeiro.';
    END IF;

    -- Busca o convite válido com lock exclusivo de linha (FOR UPDATE)
    SELECT * INTO v_invite
    FROM household_invites
    WHERE token_hash = p_token_hash
      AND status = 'pending'
      AND expires_at > now()
    FOR UPDATE;

    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'Convite inválido, expirado ou já utilizado.';
    END IF;

    -- VULN-01: Validação rigorosa de correspondência entre e-mail do convite e e-mail autenticado
    IF lower(trim(v_invite.invited_email)) != lower(trim(v_user_email)) THEN
        RAISE EXCEPTION 'Acesso negado: este convite foi emitido para outro endereço de e-mail.';
    END IF;

    -- Valida que o núcleo tem menos de 2 participantes (sob lock pessimista)
    SELECT count(*) INTO v_member_count
    FROM household_members
    WHERE household_id = v_invite.household_id;

    IF v_member_count >= 2 THEN
        UPDATE household_invites SET status = 'revoked' WHERE id = v_invite.id;
        RAISE EXCEPTION 'Este núcleo financeiro já atingiu o limite de duas participantes.';
    END IF;

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

-- 3. Blindar funções de trigger com search_path explícito
CREATE OR REPLACE FUNCTION fn_validate_transaction_household()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.account_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.bank_accounts
            WHERE id = NEW.account_id AND household_id = NEW.household_id
        ) THEN
            RAISE EXCEPTION 'Violação de isolamento: conta bancária % não pertence ao núcleo %.',
                NEW.account_id, NEW.household_id;
        END IF;
    END IF;

    IF NEW.card_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.credit_cards
            WHERE id = NEW.card_id AND household_id = NEW.household_id
        ) THEN
            RAISE EXCEPTION 'Violação de isolamento: cartão % não pertence ao núcleo %.',
                NEW.card_id, NEW.household_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION fn_validate_card_purchase_household()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.credit_cards
        WHERE id = NEW.card_id AND household_id = NEW.household_id
    ) THEN
        RAISE EXCEPTION 'Violação de isolamento: cartão % não pertence ao núcleo %.',
            NEW.card_id, NEW.household_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.household_members
        WHERE id = NEW.buyer_id AND household_id = NEW.household_id
    ) THEN
        RAISE EXCEPTION 'Violação de isolamento: comprador % não pertence ao núcleo %.',
            NEW.buyer_id, NEW.household_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

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
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- Revogar execução das funções de trigger de papéis de API
REVOKE EXECUTE ON FUNCTION fn_validate_transaction_household() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_validate_card_purchase_household() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_protect_member_identity() FROM PUBLIC, anon, authenticated;
