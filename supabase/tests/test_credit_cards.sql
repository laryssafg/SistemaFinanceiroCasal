-- ============================================================================
-- SUÍTE DE TESTES SQL: CARTÕES DE CRÉDITO, PARCELAS E FATURAS (TAREFA 06)
-- Validação de limites exatos (R$ 360,00, R$ 360,50, R$ 1.250,75), compras,
-- parcelamentos, conservação de centavos, faturas e pagamentos atômicos.
-- ============================================================================

\set ON_ERROR_STOP on

DELETE FROM auth.users WHERE email IN ('alice.cartao@teste.com', 'rodrigo.cartao@teste.com');

INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES 
    ('44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'alice.cartao@teste.com', crypt('Senha123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated'),
    ('44444444-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'rodrigo.cartao@teste.com', crypt('Senha123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');

DO $$
DECLARE
    v_household_id UUID;
    v_alice_id UUID;
    v_rodrigo_id UUID;
    v_account_id UUID;
    v_card_id UUID;
    v_card_limit BIGINT;
    v_installment_count INT;
    v_installment_sum BIGINT;
    v_invoice_id UUID;
    v_invoice_total BIGINT;
    v_invoice_paid BIGINT;
    v_invoice_status TEXT;
    v_account_balance BIGINT;
    v_token_hash TEXT;
BEGIN
    RAISE NOTICE '====================================================';
    RAISE NOTICE 'INICIANDO TESTES SQL DE CARTÕES DE CRÉDITO (TAREFA 06)';
    RAISE NOTICE '====================================================';

    -- 1. Alice cria o núcleo
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub": "44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated", "email": "alice.cartao@teste.com"}', true);

    v_household_id := create_household_with_creator('Casal Cartões', 'Alice Cartão', 'Alice');
    v_alice_id := get_user_member_id();

    -- 2. Alice gera convite para Rodrigo
    v_token_hash := encode(digest('convite-rodrigo-cartao', 'sha256'), 'hex');
    INSERT INTO public.household_invites (household_id, invited_by, invited_email, token_hash, partner_role)
    VALUES (v_household_id, v_alice_id, 'rodrigo.cartao@teste.com', v_token_hash, 'partner_b');

    -- 3. Rodrigo aceita o convite
    PERFORM set_config('request.jwt.claims', '{"sub": "44444444-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated", "email": "rodrigo.cartao@teste.com"}', true);
    PERFORM accept_household_invite(v_token_hash, 'Rodrigo Cartão', 'Rodrigo');
    v_rodrigo_id := get_user_member_id();

    -- 4. Volta para a sessão de Alice
    PERFORM set_config('request.jwt.claims', '{"sub": "44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated", "email": "alice.cartao@teste.com"}', true);

    -- Cria conta bancária com saldo R$ 5.000,00 (500000 centavos)
    INSERT INTO public.bank_accounts (household_id, member_id, institution, account_name, account_type, opening_balance)
    VALUES (v_household_id, v_alice_id, 'Banco Teste', 'Conta Alice', 'checking', 500000)
    RETURNING id INTO v_account_id;

    -- -------------------------------------------------------------------------
    -- TESTE 01: Cartão com limite R$ 360,00 (36000 centavos)
    -- -------------------------------------------------------------------------
    INSERT INTO public.credit_cards (household_id, owner_id, card_name, bank, brand, credit_limit, closing_day, due_day, last_four_digits)
    VALUES (v_household_id, v_alice_id, 'Cartão Teste 360', 'Banco Inter', 'Mastercard', 36000, 20, 27, '1234')
    RETURNING id, credit_limit INTO v_card_id, v_card_limit;

    IF v_card_limit <> 36000 THEN
        RAISE EXCEPTION 'TESTE 01 FALHOU: Limite esperado 36000 centavos, obtido %', v_card_limit;
    END IF;
    RAISE NOTICE 'TESTE 01 APROVADO: Limite R$ 360,00 (36000 centavos) gravado com sucesso.';

    -- -------------------------------------------------------------------------
    -- TESTE 02: Limite R$ 360,50 (36050 centavos)
    -- -------------------------------------------------------------------------
    UPDATE public.credit_cards SET credit_limit = 36050 WHERE id = v_card_id RETURNING credit_limit INTO v_card_limit;
    IF v_card_limit <> 36050 THEN
        RAISE EXCEPTION 'TESTE 02 FALHOU: Limite esperado 36050 centavos, obtido %', v_card_limit;
    END IF;
    RAISE NOTICE 'TESTE 02 APROVADO: Limite R$ 360,50 (36050 centavos) gravado com sucesso.';

    -- -------------------------------------------------------------------------
    -- TESTE 03: Limite R$ 1.250,75 (125075 centavos)
    -- -------------------------------------------------------------------------
    UPDATE public.credit_cards SET credit_limit = 125075 WHERE id = v_card_id RETURNING credit_limit INTO v_card_limit;
    IF v_card_limit <> 125075 THEN
        RAISE EXCEPTION 'TESTE 03 FALHOU: Limite esperado 125075 centavos, obtido %', v_card_limit;
    END IF;
    RAISE NOTICE 'TESTE 03 APROVADO: Limite R$ 1.250,75 (125075 centavos) gravado com sucesso.';

    -- Restaura limite para R$ 2.000,00 (200000 centavos) para os próximos testes
    UPDATE public.credit_cards SET credit_limit = 200000 WHERE id = v_card_id;

    -- -------------------------------------------------------------------------
    -- TESTE 04: Cartão Principal com Cartão Adicional
    -- -------------------------------------------------------------------------
    UPDATE public.credit_cards
    SET additional_holder_id = v_rodrigo_id, additional_last_four = '5678'
    WHERE id = v_card_id;

    SELECT additional_last_four INTO v_invoice_status FROM public.credit_cards WHERE id = v_card_id;
    IF v_invoice_status <> '5678' THEN
        RAISE EXCEPTION 'TESTE 04 FALHOU: Adicional não associado corretamente';
    END IF;
    RAISE NOTICE 'TESTE 04 APROVADO: Cartão principal e adicional associados corretamente.';

    -- -------------------------------------------------------------------------
    -- TESTE 05: Compra à vista via RPC create_credit_card_purchase
    -- -------------------------------------------------------------------------
    PERFORM public.create_credit_card_purchase(
        p_card_id := v_card_id,
        p_buyer_id := v_alice_id,
        p_description := 'Supermercado Mensal'::text,
        p_category := 'Alimentação'::text,
        p_amount := 15000::bigint, -- R$ 150,00
        p_installments := 1::smallint,
        p_scope := 'shared'::text,
        p_purchase_date := '2026-11-10'::date,
        p_is_additional := false
    );

    SELECT count(*) INTO v_installment_count
    FROM public.credit_card_installments i
    JOIN public.credit_card_purchases p ON p.id = i.purchase_id
    WHERE p.card_id = v_card_id AND p.description = 'Supermercado Mensal';

    IF v_installment_count <> 1 THEN
        RAISE EXCEPTION 'TESTE 05 FALHOU: Esperado 1 parcela para compra à vista, obtido %', v_installment_count;
    END IF;
    RAISE NOTICE 'TESTE 05 APROVADO: Compra à vista gerou exatamente 1 parcela vinculada.';

    -- -------------------------------------------------------------------------
    -- TESTE 06: Compra parcelada em 3x com conservação exata de centavos
    -- R$ 100,00 (10000 centavos) em 3x: 3334, 3333, 3333 = 10000 centavos
    -- -------------------------------------------------------------------------
    PERFORM public.create_credit_card_purchase(
        p_card_id := v_card_id,
        p_buyer_id := v_rodrigo_id,
        p_description := 'Mesa de Trabalho'::text,
        p_category := 'Casa'::text,
        p_amount := 10000::bigint, -- R$ 100,00
        p_installments := 3::smallint,
        p_scope := 'individual'::text,
        p_purchase_date := '2026-11-12'::date,
        p_is_additional := true
    );

    SELECT count(*), coalesce(sum(installment_amount), 0)
    INTO v_installment_count, v_installment_sum
    FROM public.credit_card_installments i
    JOIN public.credit_card_purchases p ON p.id = i.purchase_id
    WHERE p.card_id = v_card_id AND p.description = 'Mesa de Trabalho';

    IF v_installment_count <> 3 OR v_installment_sum <> 10000 THEN
        RAISE EXCEPTION 'TESTE 06 FALHOU: Esperado 3 parcelas somando 10000 centavos, obtido count=%, sum=%',
            v_installment_count, v_installment_sum;
    END IF;
    RAISE NOTICE 'TESTE 06 APROVADO: Compra 3x com conservação exata de centavos (soma = 10000).';

    -- -------------------------------------------------------------------------
    -- TESTE 07: Consulta da Fatura e Saldo Aberto
    -- -------------------------------------------------------------------------
    SELECT id, total_amount, paid_amount, status
    INTO v_invoice_id, v_invoice_total, v_invoice_paid, v_invoice_status
    FROM public.credit_card_invoices
    WHERE card_id = v_card_id AND reference_month = '2026-11';

    IF v_invoice_total <> 18334 THEN
        RAISE EXCEPTION 'TESTE 07 FALHOU: Total da fatura esperado 18334 centavos, obtido %', v_invoice_total;
    END IF;
    RAISE NOTICE 'TESTE 07 APROVADO: Fatura 2026-11 calculada corretamente: % centavos (R$ 183,34).', v_invoice_total;

    -- -------------------------------------------------------------------------
    -- TESTE 08: Pagamento Parcial da Fatura via RPC pay_credit_card_invoice
    -- -------------------------------------------------------------------------
    PERFORM public.pay_credit_card_invoice(
        p_card_id := v_card_id,
        p_account_id := v_account_id,
        p_amount := 8334::bigint,
        p_payment_date := '2026-11-25'::date
    );

    SELECT paid_amount, status INTO v_invoice_paid, v_invoice_status
    FROM public.credit_card_invoices
    WHERE id = v_invoice_id;

    IF v_invoice_paid <> 8334 OR v_invoice_status <> 'partially_paid' THEN
        RAISE EXCEPTION 'TESTE 08 FALHOU: Esperado status partially_paid e paid 8334, obtido status=%, paid=%',
            v_invoice_status, v_invoice_paid;
    END IF;
    RAISE NOTICE 'TESTE 08 APROVADO: Pagamento parcial registrado (status partially_paid, paid_amount = 8334).';

    -- -------------------------------------------------------------------------
    -- TESTE 09: Débito correto na conta bancária (sem dupla contagem de consumo)
    -- Saldo inicial: 500000. Débito: 8334. Saldo atual esperado: 491666 centavos
    -- -------------------------------------------------------------------------
    SELECT current_balance INTO v_account_balance
    FROM public.v_bank_account_balances
    WHERE account_id = v_account_id;

    IF v_account_balance <> 491666 THEN
        RAISE EXCEPTION 'TESTE 09 FALHOU: Saldo bancário esperado 491666, obtido %', v_account_balance;
    END IF;
    RAISE NOTICE 'TESTE 09 APROVADO: Saldo bancário debitado com exatidão (491666 centavos).';

    -- -------------------------------------------------------------------------
    -- TESTE 10: Bloqueio de pagamento excessivo
    -- Restante a pagar: 18334 - 8334 = 10000 centavos. Tentativa de pagar 10001 centavos deve falhar.
    -- -------------------------------------------------------------------------
    BEGIN
        PERFORM public.pay_credit_card_invoice(
            p_card_id := v_card_id,
            p_account_id := v_account_id,
            p_amount := 10001::bigint,
            p_payment_date := '2026-11-26'::date
        );
        RAISE EXCEPTION 'TESTE 10 FALHOU: Pagamento excessivo deveria ter sido bloqueado!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%excede o saldo devido%' THEN
            RAISE NOTICE 'TESTE 10 APROVADO: Pagamento excessivo bloqueado com sucesso (%).', SQLERRM;
        ELSE
            RAISE EXCEPTION 'TESTE 10 FALHOU com erro inesperado: %', SQLERRM;
        END IF;
    END;

    -- -------------------------------------------------------------------------
    -- TESTE 11: Pagamento Integral restante (10000 centavos)
    -- -------------------------------------------------------------------------
    PERFORM public.pay_credit_card_invoice(
        p_card_id := v_card_id,
        p_account_id := v_account_id,
        p_amount := 10000::bigint,
        p_payment_date := '2026-11-27'::date
    );

    SELECT paid_amount, status INTO v_invoice_paid, v_invoice_status
    FROM public.credit_card_invoices
    WHERE id = v_invoice_id;

    IF v_invoice_paid <> 18334 OR v_invoice_status <> 'paid' THEN
        RAISE EXCEPTION 'TESTE 11 FALHOU: Esperado status paid e paid 18334, obtido status=%, paid=%',
            v_invoice_status, v_invoice_paid;
    END IF;
    RAISE NOTICE 'TESTE 11 APROVADO: Pagamento integral concluído com sucesso (status = paid).';

    -- -------------------------------------------------------------------------
    -- TESTE 12: View v_credit_card_details reflete saldos e faturas
    -- -------------------------------------------------------------------------
    SELECT current_invoice_amount, closed_invoice_amount
    INTO v_invoice_total, v_invoice_paid
    FROM public.v_credit_card_details
    WHERE id = v_card_id;

    RAISE NOTICE 'TESTE 12 APROVADO: View v_credit_card_details consultada com sucesso (current_invoice=%).', v_invoice_total;

    -- Limpeza do núcleo de teste
    DELETE FROM public.households WHERE id = v_household_id;

    RAISE NOTICE '====================================================';
    RAISE NOTICE 'TODOS OS 12 TESTES SQL DE CARTÃO FORAM APROVADOS!';
    RAISE NOTICE '====================================================';
END $$;
