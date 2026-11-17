-- ============================================================================
-- SUÍTE DE TESTES DE INTEGRIDADE RELACIONAL E REGRAS FINANCEIRAS
-- Ambiente: Supabase Local descartável (PostgreSQL 17)
-- Dados: 100% fictícios e descartáveis
-- ============================================================================

\set ON_ERROR_STOP on

SELECT 'Iniciando bateria de testes de integridade...' AS status;

-- ---------------------------------------------------------------------------
-- TESTE 1: Núcleo Financeiro e Membros (Unicidade e Limite de 2 por casal)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_household_id UUID;
    v_member_a UUID;
    v_member_b UUID;
    v_error_caught BOOLEAN := FALSE;
BEGIN
    -- Criação do núcleo financeiro
    INSERT INTO households (id, display_name)
    VALUES ('11111111-1111-1111-1111-111111111111', 'Casal Teste Alpha')
    RETURNING id INTO v_household_id;

    -- Inserção de Partner A
    INSERT INTO household_members (id, household_id, partner_role, display_name, short_name, email)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v_household_id, 'partner_a', 'Ana Silva', 'Ana', 'ana.teste@exemplo.com')
    RETURNING id INTO v_member_a;

    -- Inserção de Partner B
    INSERT INTO household_members (id, household_id, partner_role, display_name, short_name, email)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', v_household_id, 'partner_b', 'Bruno Costa', 'Bruno', 'bruno.teste@exemplo.com')
    RETURNING id INTO v_member_b;

    -- Tentativa de inserir segundo partner_a no mesmo núcleo (deve falhar por UNIQUE)
    BEGIN
        INSERT INTO household_members (household_id, partner_role, display_name)
        VALUES (v_household_id, 'partner_a', 'Terceira Pessoa');
    EXCEPTION WHEN unique_violation THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 1: Banco permitiu dois membros com partner_a no mesmo núcleo!';
    END IF;

    RAISE NOTICE 'TESTE 1 APROVADO: Núcleo criado e unicidade de parceiras garantida.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 2: Isolamento entre núcleos diferentes
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_h2_id UUID;
    v_h2_member_a UUID;
BEGIN
    INSERT INTO households (id, display_name)
    VALUES ('22222222-2222-2222-2222-222222222222', 'Casal Teste Beta')
    RETURNING id INTO v_h2_id;

    -- Casal Beta pode ter seu próprio partner_a sem conflitar com o Casal Alpha
    INSERT INTO household_members (household_id, partner_role, display_name)
    VALUES (v_h2_id, 'partner_a', 'Carlos Beta')
    RETURNING id INTO v_h2_member_a;

    RAISE NOTICE 'TESTE 2 APROVADO: Isolamento entre núcleos independentes verificado.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 3: Contas Bancárias e Cálculo de Saldos Derivados
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_acc_a UUID;
    v_balance BIGINT;
    v_credits BIGINT;
    v_debits BIGINT;
BEGIN
    -- Conta Corrente Ana: saldo de abertura R$ 1.000,00 (100.000 centavos)
    INSERT INTO bank_accounts (
        id, household_id, member_id, institution, account_name, account_type, opening_balance
    ) VALUES (
        'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Banco do Brasil', 'Conta Corrente Principal', 'checking', 100000
    ) RETURNING id INTO v_acc_a;

    -- 1. Receita confirmada de R$ 5.000,00 (500.000 centavos)
    INSERT INTO transactions (
        household_id, member_id, account_id, transaction_type, status, scope,
        payment_method, amount, description, category, competence_month
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        v_acc_a, 'income', 'confirmed', 'individual',
        'pix', 500000, 'Salário Ana', 'Renda', '2026-11'
    );

    -- 2. Despesa confirmada Pix de R$ 1.200,00 (120.000 centavos)
    INSERT INTO transactions (
        household_id, member_id, account_id, transaction_type, status, scope,
        payment_method, amount, paid_amount, description, category, competence_month
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        v_acc_a, 'expense', 'confirmed', 'shared',
        'pix', 120000, 120000, 'Supermercado Mensal', 'Alimentação', '2026-11'
    );

    -- 3. Despesa pendente de R$ 800,00 (80.000 centavos) - NÃO deve afetar saldo confirmado
    INSERT INTO transactions (
        household_id, member_id, account_id, transaction_type, status, scope,
        payment_method, amount, description, category, competence_month
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        v_acc_a, 'expense', 'pending', 'individual',
        'boleto', 80000, 'Boleto Faculdade', 'Educação', '2026-11'
    );

    -- Consulta saldo na View
    SELECT current_balance, total_credits, total_debits
    INTO v_balance, v_credits, v_debits
    FROM v_bank_account_balances
    WHERE account_id = v_acc_a;

    -- Esperado: 100.000 (abertura) + 500.000 (créditos) - 120.000 (débitos) = 480.000 centavos (R$ 4.800,00)
    IF v_balance != 480000 OR v_credits != 500000 OR v_debits != 120000 THEN
        RAISE EXCEPTION 'FALHA TESTE 3: Saldo calculado incorreto! Obtido: %, Esperado: 480000', v_balance;
    END IF;

    RAISE NOTICE 'TESTE 3 APROVADO: Saldo derivado bate exatamente R$ 4.800,00 e ignora pendências.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 4: Transferências entre contas (Rastreabilidade e Conservação)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_acc_a UUID := 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
    v_acc_b UUID;
    v_t_out UUID;
    v_t_in UUID;
    v_bal_a BIGINT;
    v_bal_b BIGINT;
BEGIN
    -- Conta Poupança Bruno: saldo de abertura R$ 0,00
    INSERT INTO bank_accounts (
        id, household_id, member_id, institution, account_name, account_type, opening_balance
    ) VALUES (
        'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
        '11111111-1111-1111-1111-111111111111',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'Nubank', 'Conta Poupança Bruno', 'savings', 0
    ) RETURNING id INTO v_acc_b;

    -- Transferência de R$ 500,00 (50.000 centavos) da Conta A para a Conta B
    INSERT INTO transactions (
        household_id, member_id, account_id, transaction_type, status, scope,
        payment_method, amount, description, category, competence_month
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        v_acc_a, 'transfer_out', 'confirmed', 'individual',
        'transfer', 50000, 'TED para Bruno', 'Transferência', '2026-11'
    ) RETURNING id INTO v_t_out;

    INSERT INTO transactions (
        household_id, member_id, account_id, transaction_type, status, scope,
        payment_method, amount, description, category, competence_month, transfer_pair_id
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        v_acc_b, 'transfer_in', 'confirmed', 'individual',
        'transfer', 50000, 'TED recebida de Ana', 'Transferência', '2026-11', v_t_out
    ) RETURNING id INTO v_t_in;

    UPDATE transactions SET transfer_pair_id = v_t_in WHERE id = v_t_out;

    -- Checa saldos
    SELECT current_balance INTO v_bal_a FROM v_bank_account_balances WHERE account_id = v_acc_a;
    SELECT current_balance INTO v_bal_b FROM v_bank_account_balances WHERE account_id = v_acc_b;

    -- Conta A: 480.000 - 50.000 = 430.000 (R$ 4.300,00)
    -- Conta B: 0 + 50.000 = 50.000 (R$ 500,00)
    -- Soma total do casal = 480.000 (inalterado!)
    IF v_bal_a != 430000 OR v_bal_b != 50000 THEN
        RAISE EXCEPTION 'FALHA TESTE 4: Transferência inconsistente! A: %, B: %', v_bal_a, v_bal_b;
    END IF;

    RAISE NOTICE 'TESTE 4 APROVADO: Transferência efetuada com conservação total do patrimônio bancário.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 5: Estornos Vinculados e Restrições de Integridade
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_acc_a UUID := 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
    v_orig_tx UUID;
    v_bal_a BIGINT;
    v_error_caught BOOLEAN := FALSE;
BEGIN
    SELECT id INTO v_orig_tx FROM transactions
    WHERE account_id = v_acc_a AND transaction_type = 'expense' LIMIT 1;

    -- 1. Testar constraint: não pode vincular refunded_transaction_id se type != 'refund'
    BEGIN
        INSERT INTO transactions (
            household_id, member_id, account_id, transaction_type, status,
            payment_method, amount, competence_month, refunded_transaction_id
        ) VALUES (
            '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            v_acc_a, 'expense', 'confirmed', 'pix', 1000, '2026-11', v_orig_tx
        );
    EXCEPTION WHEN check_violation THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 5: Banco permitiu refunded_transaction_id em transação não-refund!';
    END IF;

    -- 2. Inserir estorno válido de R$ 200,00 (20.000 centavos)
    INSERT INTO transactions (
        household_id, member_id, account_id, transaction_type, status, scope,
        payment_method, amount, description, category, competence_month, refunded_transaction_id
    ) VALUES (
        '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        v_acc_a, 'refund', 'confirmed', 'individual',
        'pix', 20000, 'Estorno produto devolvido', 'Alimentação', '2026-11', v_orig_tx
    );

    -- Saldo Conta A: 430.000 + 20.000 = 450.000 centavos (R$ 4.500,00)
    SELECT current_balance INTO v_bal_a FROM v_bank_account_balances WHERE account_id = v_acc_a;
    IF v_bal_a != 450000 THEN
        RAISE EXCEPTION 'FALHA TESTE 5: Saldo após estorno incorreto! Obtido: %', v_bal_a;
    END IF;

    RAISE NOTICE 'TESTE 5 APROVADO: Estornos vinculados funcionam e credenciam o saldo corretamente.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 6: Benefícios VR/VA (Regra Inegociável: Não afeta saldo bancário)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_card_id UUID;
    v_bal_vr BIGINT;
    v_bal_bank BIGINT;
    v_acc_a UUID := 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
BEGIN
    -- Cartão VR Ana
    INSERT INTO benefit_cards (
        household_id, member_id, benefit_type, provider_name, monthly_credit
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'VR', 'Alelo Refeição', 80000
    ) RETURNING id INTO v_card_id;

    -- 1. Recarga mensal de R$ 800,00 (80.000 centavos)
    INSERT INTO benefit_movements (
        household_id, benefit_card_id, movement_type, amount, description, competence_month
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        v_card_id, 'credit', 80000, 'Crédito Mensal VR', '2026-11'
    );

    -- 2. Compra restaurante R$ 150,00 (15.000 centavos)
    INSERT INTO benefit_movements (
        household_id, benefit_card_id, movement_type, amount, description, competence_month
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        v_card_id, 'purchase', 15000, 'Almoço Restaurante', '2026-11'
    );

    -- Verifica saldo VR: 80.000 - 15.000 = 65.000 (R$ 650,00)
    SELECT current_balance INTO v_bal_vr FROM v_benefit_card_balances WHERE benefit_card_id = v_card_id;
    IF v_bal_vr != 65000 THEN
        RAISE EXCEPTION 'FALHA TESTE 6: Saldo VR incorreto! Obtido: %', v_bal_vr;
    END IF;

    -- REGRA INEGOCIÁVEL: Saldo da Conta Bancária DEVE permanecer exatamente 450.000 centavos!
    SELECT current_balance INTO v_bal_bank FROM v_bank_account_balances WHERE account_id = v_acc_a;
    IF v_bal_bank != 450000 THEN
        RAISE EXCEPTION 'FALHA TESTE 6: COMPRA VR DEBITOU A CONTA BANCÁRIA! Saldo obtido: %', v_bal_bank;
    END IF;

    RAISE NOTICE 'TESTE 6 APROVADO: VR segregado com saldo R$ 650,00 e saldo bancário 100%% protegido.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 7: Cartões de Crédito, Compras Parceladas e Pagamentos de Fatura
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_card_id UUID;
    v_inv_id UUID;
    v_purchase_id UUID;
    v_acc_a UUID := 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
    v_bal_bank BIGINT;
    v_error_caught BOOLEAN := FALSE;
BEGIN
    -- Cartão de Crédito Ana
    INSERT INTO credit_cards (
        household_id, owner_id, card_name, bank, brand, credit_limit, closing_day, due_day, last_four_digits
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Nubank Ultravioleta', 'Nubank', 'Mastercard', 1000000, 25, 5, '1234'
    ) RETURNING id INTO v_card_id;

    -- Fatura de Novembro/2026
    INSERT INTO credit_card_invoices (
        household_id, card_id, reference_month, status, total_amount, paid_amount
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        v_card_id, '2026-11', 'open', 30000, 0
    ) RETURNING id INTO v_inv_id;

    -- Compra parcelada em 3x de R$ 100,00 (total R$ 300,00 = 30.000 centavos)
    INSERT INTO credit_card_purchases (
        household_id, card_id, buyer_id, description, total_amount, total_installments
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        v_card_id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Geladeira Nova', 30000, 3
    ) RETURNING id INTO v_purchase_id;

    -- Parcela 1 vinculada à fatura aberta
    INSERT INTO credit_card_installments (
        household_id, purchase_id, invoice_id, installment_number, installment_amount, due_month
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        v_purchase_id, v_inv_id, 1, 10000, '2026-11'
    );

    -- Testar constraint: paid_amount não pode ser maior que total_amount
    BEGIN
        UPDATE credit_card_invoices SET paid_amount = 40000 WHERE id = v_inv_id;
    EXCEPTION WHEN check_violation THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 7: Fatura permitiu paid_amount superior ao total_amount!';
    END IF;

    -- Pagamento parcial de fatura: R$ 200,00 (20.000 centavos)
    UPDATE credit_card_invoices SET paid_amount = 20000, status = 'partially_paid' WHERE id = v_inv_id;

    -- Registra transação bancária de saída tipo invoice_payment
    INSERT INTO transactions (
        household_id, member_id, account_id, card_id, transaction_type, status,
        payment_method, amount, paid_amount, description, category, competence_month
    ) VALUES (
        '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        v_acc_a, v_card_id, 'invoice_payment', 'confirmed',
        'pix', 20000, 20000, 'Pagamento Parcial Fatura Nubank', 'Cartão de Crédito', '2026-11'
    );

    -- Saldo bancário Conta A: 450.000 - 20.000 = 430.000 centavos (R$ 4.300,00)
    SELECT current_balance INTO v_bal_bank FROM v_bank_account_balances WHERE account_id = v_acc_a;
    IF v_bal_bank != 430000 THEN
        RAISE EXCEPTION 'FALHA TESTE 7: Pagamento de fatura não debitou o banco corretamente! Obtido: %', v_bal_bank;
    END IF;

    RAISE NOTICE 'TESTE 7 APROVADO: Faturas, parcelas e pagamento parcial debitando o banco corretamente.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 8: Divisão Proporcional e Conservação Exata de Centavos
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_period_id UUID;
    v_error_caught BOOLEAN := FALSE;
BEGIN
    -- Renda Ana: R$ 6.000,00 (600.000 centavos) - 60,00% (6000 bps)
    -- Renda Bruno: R$ 4.000,00 (400.000 centavos) - 40,00% (4000 bps)
    INSERT INTO proportional_periods (
        household_id, competence_month, partner_a_income, partner_b_income,
        partner_a_percent, partner_b_percent, split_mode, total_shared
    ) VALUES (
        '11111111-1111-1111-1111-111111111111', '2026-11',
        600000, 400000, 6000, 4000, 'proportional', 10001
    ) RETURNING id INTO v_period_id;

    -- Despesa de R$ 100,01 (10.001 centavos)
    -- Parte A: 6.001 centavos | Parte B: 4.000 centavos (soma = 10.001)
    INSERT INTO shared_responsibilities (
        household_id, period_id, description, total_amount, paid_by_member_id,
        partner_a_share, partner_b_share, applied_a_percent, applied_b_percent
    ) VALUES (
        '11111111-1111-1111-1111-111111111111', v_period_id,
        'Conta de Luz Compartilhada', 10001, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        6001, 4000, 6000, 4000
    );

    -- Testar constraint: soma das partes diferente do total DEVE falhar
    BEGIN
        INSERT INTO shared_responsibilities (
            household_id, period_id, description, total_amount, paid_by_member_id,
            partner_a_share, partner_b_share, applied_a_percent, applied_b_percent
        ) VALUES (
            '11111111-1111-1111-1111-111111111111', v_period_id,
            'Teste Erro Arredondamento', 10001, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            6000, 4000, 6000, 4000 -- soma 10000 != 10001
        );
    EXCEPTION WHEN check_violation THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 8: Banco permitiu divisão sem conservação exata de centavos!';
    END IF;

    RAISE NOTICE 'TESTE 8 APROVADO: Divisão proporcional conserva centavos rigorosamente.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 9: Acertos Financeiros e Prevenção de Liquidação Duplicada
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_settlement_id UUID;
    v_tx_id UUID;
    v_acc_a UUID := 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
    v_error_caught BOOLEAN := FALSE;
BEGIN
    -- Bruno deve acertar R$ 1.500,00 com Ana
    INSERT INTO couple_settlements (
        household_id, reference_month, from_member_id, to_member_id, amount, description
    ) VALUES (
        '11111111-1111-1111-1111-111111111111', '2026-11',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        150000, 'Acerto Despesas Compartilhadas Nov/2026'
    ) RETURNING id INTO v_settlement_id;

    -- Transferência bancária efetiva
    INSERT INTO transactions (
        household_id, member_id, account_id, transaction_type, status, scope,
        payment_method, amount, description, category, competence_month
    ) VALUES (
        '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        v_acc_a, 'transfer_in', 'confirmed', 'individual',
        'pix', 150000, 'Pix Acerto Bruno para Ana', 'Acerto', '2026-11'
    ) RETURNING id INTO v_tx_id;

    -- Vínculo de liquidação em settlement_transfers
    INSERT INTO settlement_transfers (
        household_id, settlement_id, transaction_id, amount
    ) VALUES (
        '11111111-1111-1111-1111-111111111111', v_settlement_id, v_tx_id, 150000
    );

    -- Tentativa de reutilizar a mesma transferência para liquidar outro acerto (deve falhar por UNIQUE)
    BEGIN
        INSERT INTO settlement_transfers (
            household_id, settlement_id, transaction_id, amount
        ) VALUES (
            '11111111-1111-1111-1111-111111111111', v_settlement_id, v_tx_id, 150000
        );
    EXCEPTION WHEN unique_violation THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 9: Banco permitiu reutilização da mesma transferência em acertos!';
    END IF;

    RAISE NOTICE 'TESTE 9 APROVADO: Liquidação de acertos protegida contra duplicidade.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 10: Reserva de Emergência (Investimento OU Conta Bancária)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_asset_id UUID;
    v_acc_a UUID := 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
    v_cfg_id UUID;
    v_error_caught BOOLEAN := FALSE;
BEGIN
    -- Ativo CDB Liquidez Diária
    INSERT INTO investment_assets (
        household_id, asset_name, institution, asset_class, is_emergency_reserve, invested_amount
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        'CDB 100% CDI Liquidez Diária', 'Sofisa Direto', 'renda_fixa', TRUE, 5000000
    ) RETURNING id INTO v_asset_id;

    -- 1. Testar constraint: não pode apontar para asset e conta bancária simultaneamente
    BEGIN
        INSERT INTO emergency_reserve_configs (
            household_id, is_configured, linked_asset_id, linked_account_id,
            essential_monthly_baseline, target_months, target_amount
        ) VALUES (
            '11111111-1111-1111-1111-111111111111', TRUE, v_asset_id, v_acc_a,
            500000, 12, 6000000
        );
    EXCEPTION WHEN check_violation THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 10: Banco permitiu vincular ativo E conta à reserva simultaneamente!';
    END IF;

    -- 2. Configuração válida apontando para o investimento
    INSERT INTO emergency_reserve_configs (
        household_id, is_configured, linked_asset_id, essential_monthly_baseline, target_months, target_amount
    ) VALUES (
        '11111111-1111-1111-1111-111111111111', TRUE, v_asset_id, 500000, 12, 6000000
    ) RETURNING id INTO v_cfg_id;

    -- 3. Testar retirada sem motivo: deve falhar por chk_erm_withdrawal_reason
    v_error_caught := FALSE;
    BEGIN
        INSERT INTO emergency_reserve_movements (
            household_id, config_id, member_id, movement_type, amount, reason
        ) VALUES (
            '11111111-1111-1111-1111-111111111111', v_cfg_id,
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'withdrawal', 100000, NULL
        );
    EXCEPTION WHEN check_violation THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 10: Banco permitiu retirada da reserva sem motivo registrado!';
    END IF;

    RAISE NOTICE 'TESTE 10 APROVADO: Reserva de emergência suporta ativo/conta com exclusão mútua e justificativa obrigatória.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 11: Bloqueio de Alterações em Competências Fechadas (Trigger)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_acc_a UUID := 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
    v_error_caught BOOLEAN := FALSE;
BEGIN
    -- Fecha a competência '2026-10'
    INSERT INTO fiscal_periods (
        household_id, competence_month, status, close_version, closed_at
    ) VALUES (
        '11111111-1111-1111-1111-111111111111', '2026-10', 'closed', 1, now()
    );

    -- Tentativa de inserir transação com competence_month = '2026-10' (deve ser bloqueada pelo TRIGGER)
    BEGIN
        INSERT INTO transactions (
            household_id, member_id, account_id, transaction_type, status,
            payment_method, amount, description, category, competence_month
        ) VALUES (
            '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            v_acc_a, 'expense', 'confirmed', 'pix', 5000, 'Gasto em Mês Fechado', 'Outros', '2026-10'
        );
    EXCEPTION WHEN raise_exception THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 11: Trigger não bloqueou lançamento em competência fechada!';
    END IF;

    RAISE NOTICE 'TESTE 11 APROVADO: Gatilho bloqueia operações em meses contábeis fechados.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 12: Imutabilidade Absoluta da Trilha de Auditoria (Trigger)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_log_id UUID;
    v_error_update BOOLEAN := FALSE;
    v_error_delete BOOLEAN := FALSE;
BEGIN
    -- Inserção de registro de auditoria (permitido)
    INSERT INTO audit_logs (
        household_id, actor_member_id, action, entity_type, old_values, new_values
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'UPDATE', 'bank_accounts', '{"opening_balance": 1000}'::jsonb, '{"opening_balance": 2000}'::jsonb
    ) RETURNING id INTO v_log_id;

    -- Tentativa de UPDATE (deve ser bloqueada pelo TRIGGER)
    BEGIN
        UPDATE audit_logs SET action = 'HACKED' WHERE id = v_log_id;
    EXCEPTION WHEN raise_exception THEN
        v_error_update := TRUE;
    END;

    -- Tentativa de DELETE (deve ser bloqueada pelo TRIGGER)
    BEGIN
        DELETE FROM audit_logs WHERE id = v_log_id;
    EXCEPTION WHEN raise_exception THEN
        v_error_delete := TRUE;
    END;

    IF NOT v_error_update OR NOT v_error_delete THEN
        RAISE EXCEPTION 'FALHA TESTE 12: Trilha de auditoria permitiu mutação ou exclusão!';
    END IF;

    RAISE NOTICE 'TESTE 12 APROVADO: Trilha de auditoria é estritamente append-only e imutável.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 13: Integridade de Chaves Estrangeiras (ON DELETE RESTRICT)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_error_caught BOOLEAN := FALSE;
BEGIN
    -- Tentativa de deletar membro Ana que possui contas bancárias vinculadas (deve falhar por RESTRICT)
    BEGIN
        DELETE FROM household_members WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    EXCEPTION WHEN foreign_key_violation THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 13: Banco permitiu deletar membro com dados financeiros ativos!';
    END IF;

    RAISE NOTICE 'TESTE 13 APROVADO: Integridade referencial protege exclusão acidental de participantes.';
END $$;

SELECT 'TODOS OS 13 TESTES DE INTEGRIDADE FORAM EXECUTADOS E APROVADOS COM SUCESSO!' AS resultado_final;
