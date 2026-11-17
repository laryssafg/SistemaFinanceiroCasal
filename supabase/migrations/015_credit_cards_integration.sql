-- =============================================================================
-- Migração 015 — Módulo de Cartões de Crédito: Views, Faturas e Pagamento Atômico
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. View: v_credit_card_details
-- -----------------------------------------------------------------------------
-- Calcula limite total, faturas abertas e fechadas de cada cartão do núcleo
CREATE OR REPLACE VIEW public.v_credit_card_details
WITH (security_invoker = true)
AS
SELECT
    cc.id,
    cc.household_id,
    cc.owner_id,
    cc.additional_holder_id,
    cc.card_name,
    cc.bank,
    cc.brand,
    cc.credit_limit,
    cc.closing_day,
    cc.due_day,
    cc.last_four_digits,
    cc.additional_last_four,
    cc.is_active,
    cc.created_at,
    cc.updated_at,
    -- Fatura aberta atual (soma das parcelas/compras ativas para a fatura aberta)
    COALESCE(open_inv.total_amount - open_inv.paid_amount, 0) AS current_invoice_amount,
    -- Fatura fechada pendente (se houver)
    COALESCE(closed_inv.total_amount - closed_inv.paid_amount, 0) AS closed_invoice_amount,
    -- Status se a fatura fechada está paga
    CASE 
        WHEN closed_inv.id IS NULL THEN TRUE
        WHEN closed_inv.status = 'paid' THEN TRUE
        ELSE FALSE
    END AS closed_invoice_paid,
    -- ID da fatura aberta atual
    open_inv.id AS current_invoice_id,
    -- ID da fatura fechada atual
    closed_inv.id AS closed_invoice_id
FROM public.credit_cards cc
LEFT JOIN LATERAL (
    SELECT id, total_amount, paid_amount, status
    FROM public.credit_card_invoices inv
    WHERE inv.card_id = cc.id
      AND inv.status IN ('open', 'partially_paid')
    ORDER BY inv.reference_month DESC
    LIMIT 1
) open_inv ON TRUE
LEFT JOIN LATERAL (
    SELECT id, total_amount, paid_amount, status
    FROM public.credit_card_invoices inv
    WHERE inv.card_id = cc.id
      AND inv.status = 'closed'
    ORDER BY inv.reference_month DESC
    LIMIT 1
) closed_inv ON TRUE;

COMMENT ON VIEW public.v_credit_card_details IS 'Visão detalhada de cartões com saldos derivados de faturas e segurança RLS invoker.';

-- -----------------------------------------------------------------------------
-- 2. Função de criação/registro de compra no cartão com parcelas atômicas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_credit_card_purchase(
    p_card_id UUID,
    p_buyer_id UUID,
    p_description TEXT,
    p_category TEXT,
    p_amount BIGINT,            -- valor total em centavos
    p_installments SMALLINT,    -- quantidade de parcelas (>= 1)
    p_scope TEXT,               -- 'individual' | 'shared'
    p_purchase_date DATE DEFAULT CURRENT_DATE,
    p_is_additional BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_household_id UUID := get_user_household_id();
    v_card RECORD;
    v_purchase_id UUID := gen_random_uuid();
    v_installment_amount BIGINT;
    v_remainder BIGINT;
    v_due_month DATE;
    v_ref_month TEXT;
    v_invoice_id UUID;
    v_i SMALLINT;
    v_current_inst_amount BIGINT;
    v_tx_id UUID;
BEGIN
    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária deve pertencer a um núcleo autenticado.';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Valor da compra deve ser maior que zero.';
    END IF;

    IF p_installments < 1 THEN
        RAISE EXCEPTION 'Número de parcelas deve ser pelo menos 1.';
    END IF;

    -- Validar existência e household do cartão
    SELECT * INTO v_card
    FROM public.credit_cards
    WHERE id = p_card_id AND household_id = v_household_id AND is_active = TRUE;

    IF v_card.id IS NULL THEN
        RAISE EXCEPTION 'Cartão de crédito não encontrado, inativo ou não pertence ao seu núcleo.';
    END IF;

    -- Inserir a compra original
    INSERT INTO public.credit_card_purchases (
        id, household_id, card_id, buyer_id,
        is_additional_card, scope, description, category,
        purchase_date, total_amount, total_installments,
        status, created_by
    ) VALUES (
        v_purchase_id, v_household_id, p_card_id, p_buyer_id,
        p_is_additional, p_scope, TRIM(p_description), COALESCE(NULLIF(TRIM(p_category), ''), 'Outros'),
        p_purchase_date, p_amount, p_installments,
        'active', p_buyer_id
    );

    -- Divisão exata de centavos para as parcelas
    v_installment_amount := p_amount / p_installments;
    v_remainder := p_amount % p_installments;

    -- Data base da primeira competência: se a compra foi feita após o dia de fechamento, cai no próximo mês
    IF EXTRACT(DAY FROM p_purchase_date) >= v_card.closing_day THEN
        v_due_month := (p_purchase_date + INTERVAL '1 month')::DATE;
    ELSE
        v_due_month := p_purchase_date;
    END IF;

    -- Gerar parcelas e associar ou criar faturas
    FOR v_i IN 1..p_installments LOOP
        v_ref_month := TO_CHAR(v_due_month + ((v_i - 1) || ' month')::INTERVAL, 'YYYY-MM');
        
        -- Primeira parcela recebe o resto da divisão para conservação exata de centavos
        IF v_i = 1 THEN
            v_current_inst_amount := v_installment_amount + v_remainder;
        ELSE
            v_current_inst_amount := v_installment_amount;
        END IF;

        -- Obter ou criar fatura correspondente
        SELECT id INTO v_invoice_id
        FROM public.credit_card_invoices
        WHERE card_id = p_card_id AND reference_month = v_ref_month;

        IF v_invoice_id IS NULL THEN
            v_invoice_id := gen_random_uuid();
            INSERT INTO public.credit_card_invoices (
                id, household_id, card_id, reference_month, status, total_amount, paid_amount
            ) VALUES (
                v_invoice_id, v_household_id, p_card_id, v_ref_month, 'open', v_current_inst_amount, 0
            );
        ELSE
            UPDATE public.credit_card_invoices
            SET total_amount = total_amount + v_current_inst_amount
            WHERE id = v_invoice_id;
        END IF;

        -- Inserir parcela
        INSERT INTO public.credit_card_installments (
            household_id, purchase_id, invoice_id,
            installment_number, installment_amount, due_month
        ) VALUES (
            v_household_id, v_purchase_id, v_invoice_id,
            v_i, v_current_inst_amount, v_ref_month
        );
    END LOOP;

    -- Registrar transação do tipo despesa para alimentar extrato e orçamentos (sem debitar banco)
    v_tx_id := gen_random_uuid();
    INSERT INTO public.transactions (
        id, household_id, member_id, card_id,
        transaction_type, status, scope, payment_method,
        amount, description, category,
        transaction_date, competence_month,
        installment_current, installment_total
    ) VALUES (
        v_tx_id, v_household_id, p_buyer_id, p_card_id,
        'expense', 'confirmed', p_scope, 'credit_card',
        p_amount, TRIM(p_description), COALESCE(NULLIF(TRIM(p_category), ''), 'Outros'),
        p_purchase_date, TO_CHAR(p_purchase_date, 'YYYY-MM'),
        1, p_installments
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'purchase_id', v_purchase_id,
        'amount', p_amount,
        'installments', p_installments
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Função de Pagamento Atômico de Fatura
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_credit_card_invoice(
    p_card_id UUID,
    p_account_id UUID,
    p_amount BIGINT,                -- centavos a pagar
    p_payment_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_household_id UUID := get_user_household_id();
    v_member_id UUID := get_user_member_id();
    v_card RECORD;
    v_account RECORD;
    v_invoice RECORD;
    v_payment_id UUID := gen_random_uuid();
    v_tx_id UUID := gen_random_uuid();
    v_month TEXT := TO_CHAR(p_payment_date, 'YYYY-MM');
BEGIN
    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: usuária deve pertencer a um núcleo autenticado.';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Valor do pagamento deve ser positivo.';
    END IF;

    -- Validar cartão
    SELECT * INTO v_card
    FROM public.credit_cards
    WHERE id = p_card_id AND household_id = v_household_id AND is_active = TRUE;

    IF v_card.id IS NULL THEN
        RAISE EXCEPTION 'Cartão de crédito não encontrado ou inativo.';
    END IF;

    -- Validar conta bancária pagadora
    SELECT * INTO v_account
    FROM public.bank_accounts
    WHERE id = p_account_id AND household_id = v_household_id AND is_active = TRUE;

    IF v_account.id IS NULL THEN
        RAISE EXCEPTION 'Conta bancária de pagamento não encontrada ou inativa.';
    END IF;

    -- Localizar fatura aberta ou fechada com saldo devedor
    SELECT * INTO v_invoice
    FROM public.credit_card_invoices
    WHERE card_id = p_card_id
      AND status IN ('open', 'closed', 'partially_paid')
      AND (total_amount - paid_amount) > 0
    ORDER BY reference_month ASC
    LIMIT 1;

    -- Se não houver fatura aberta com valor, cria ou seleciona a fatura do mês atual
    IF v_invoice.id IS NULL THEN
        SELECT * INTO v_invoice
        FROM public.credit_card_invoices
        WHERE card_id = p_card_id AND reference_month = v_month;

        IF v_invoice.id IS NULL THEN
            v_invoice.id := gen_random_uuid();
            INSERT INTO public.credit_card_invoices (
                id, household_id, card_id, reference_month, status, total_amount, paid_amount
            ) VALUES (
                v_invoice.id, v_household_id, p_card_id, v_month, 'open', p_amount, 0
            );
            v_invoice.total_amount := p_amount;
            v_invoice.paid_amount := 0;
        END IF;
    END IF;

    -- Bloqueio de pagamento excessivo
    IF (v_invoice.paid_amount + p_amount) > v_invoice.total_amount THEN
        RAISE EXCEPTION 'Valor de pagamento (R$ %) excede o saldo devido da fatura (R$ %).',
            (p_amount / 100.0)::NUMERIC(12,2),
            ((v_invoice.total_amount - v_invoice.paid_amount) / 100.0)::NUMERIC(12,2);
    END IF;

    -- 1. Debitar da conta bancária via transação do tipo invoice_payment
    INSERT INTO public.transactions (
        id, household_id, member_id, account_id, card_id,
        transaction_type, status, scope, payment_method,
        amount, paid_amount, description, category,
        transaction_date, competence_month
    ) VALUES (
        v_tx_id, v_household_id, v_member_id, p_account_id, p_card_id,
        'invoice_payment', 'confirmed', 'individual', 'transfer',
        p_amount, p_amount,
        'Pagamento Fatura — ' || v_card.card_name,
        'Pagamento de Fatura',
        p_payment_date, v_month
    );

    -- 2. Registrar o pagamento de fatura na tabela invoice_payments
    INSERT INTO public.invoice_payments (
        id, household_id, invoice_id, account_id, transaction_id,
        amount, payment_date, created_by
    ) VALUES (
        v_payment_id, v_household_id, v_invoice.id, p_account_id, v_tx_id,
        p_amount, p_payment_date, v_member_id
    );

    -- 3. Atualizar a fatura (paid_amount e status)
    UPDATE public.credit_card_invoices
    SET paid_amount = paid_amount + p_amount,
        status = CASE
            WHEN (paid_amount + p_amount) >= total_amount THEN 'paid'
            ELSE 'partially_paid'
        END,
        updated_at = NOW()
    WHERE id = v_invoice.id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', v_payment_id,
        'transaction_id', v_tx_id,
        'invoice_id', v_invoice.id,
        'amount', p_amount
    );
END;
$$;

-- Permissões de execução seguras
REVOKE EXECUTE ON FUNCTION public.create_credit_card_purchase(UUID, UUID, TEXT, TEXT, BIGINT, SMALLINT, TEXT, DATE, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_credit_card_purchase(UUID, UUID, TEXT, TEXT, BIGINT, SMALLINT, TEXT, DATE, BOOLEAN) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pay_credit_card_invoice(UUID, UUID, BIGINT, DATE) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pay_credit_card_invoice(UUID, UUID, BIGINT, DATE) TO authenticated, service_role;
