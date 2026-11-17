-- ============================================================================
-- SUÍTE DE TESTES DE SEGURANÇA RLS E ISOLAMENTO MULTITENANT
-- Ambiente: Supabase Local descartável (PostgreSQL 17.12)
-- Papéis testados: authenticated (com JWT de diferentes usuárias) e anon
-- ============================================================================

\set ON_ERROR_STOP on

SELECT 'Iniciando bateria de testes reais de segurança RLS...' AS status;

-- ---------------------------------------------------------------------------
-- PREPARAÇÃO: Criar 4 usuárias fictícias no schema auth.users
-- ---------------------------------------------------------------------------
DELETE FROM auth.users WHERE email IN (
    'ana.alpha@teste.com', 'bruno.alpha@teste.com',
    'carla.beta@teste.com', 'daniel.solto@teste.com'
);

INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES 
    ('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'ana.alpha@teste.com', crypt('Senha123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated'),
    ('11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'bruno.alpha@teste.com', crypt('Senha123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated'),
    ('22222222-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'carla.beta@teste.com', crypt('Senha123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated'),
    ('33333333-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'daniel.solto@teste.com', crypt('Senha123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated');

-- ---------------------------------------------------------------------------
-- TESTE 1: Criação de Núcleos e Aceitação de Convite
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_household_alpha UUID;
    v_household_beta UUID;
    v_token_raw TEXT := 'convite-secreto-bruno-12345';
    v_token_hash TEXT;
    v_member_a_id UUID;
    v_invite_id UUID;
BEGIN
    -- Simula Usuária A (Ana) criando o Núcleo Alpha
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub": "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated", "email": "ana.alpha@teste.com"}', true);
    
    v_household_alpha := create_household_with_creator('Casal Alpha', 'Ana Silva', 'Ana');
    v_member_a_id := get_user_member_id();

    -- Ana gera convite para Bruno (Partner B)
    v_token_hash := encode(digest(v_token_raw, 'sha256'), 'hex');
    INSERT INTO household_invites (household_id, invited_by, invited_email, token_hash, partner_role)
    VALUES (v_household_alpha, v_member_a_id, 'bruno.alpha@teste.com', v_token_hash, 'partner_b')
    RETURNING id INTO v_invite_id;

    -- Simula Usuária B (Bruno) aceitando o convite
    PERFORM set_config('request.jwt.claims', '{"sub": "11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated", "email": "bruno.alpha@teste.com"}', true);
    PERFORM accept_household_invite(v_token_hash, 'Bruno Costa', 'Bruno');

    -- Verifica se Bruno agora pertence ao Núcleo Alpha
    IF get_user_household_id() != v_household_alpha THEN
        RAISE EXCEPTION 'FALHA TESTE 1: Bruno não foi vinculado ao Núcleo Alpha!';
    END IF;

    -- Simula Usuária C (Carla) criando o Núcleo Beta
    PERFORM set_config('request.jwt.claims', '{"sub": "22222222-cccc-cccc-cccc-cccccccccccc", "role": "authenticated", "email": "carla.beta@teste.com"}', true);
    v_household_beta := create_household_with_creator('Casal Beta', 'Carla Souza', 'Carla');

    IF get_user_household_id() != v_household_beta THEN
        RAISE EXCEPTION 'FALHA TESTE 1: Carla não foi vinculada ao Núcleo Beta!';
    END IF;

    RESET ROLE;
    RAISE NOTICE 'TESTE 1 APROVADO: Núcleos Alpha e Beta criados e convite aceito com sucesso.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 2: Compartilhamento dentro do núcleo (A e B acessam dados de Alpha)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_household_alpha UUID;
    v_acc_alpha UUID;
    v_count INT;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub": "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated", "email": "ana.alpha@teste.com"}', true);
    v_household_alpha := get_user_household_id();

    -- Ana insere conta bancária e movimentação
    INSERT INTO bank_accounts (id, household_id, member_id, institution, account_name, account_type, opening_balance)
    VALUES ('aaaaaaaa-1111-1111-1111-111111111111', v_household_alpha, get_user_member_id(), 'Nubank Alpha', 'Conta Conjunta Alpha', 'checking', 50000)
    RETURNING id INTO v_acc_alpha;

    INSERT INTO transactions (household_id, member_id, account_id, transaction_type, status, scope, payment_method, amount, description, category, competence_month)
    VALUES (v_household_alpha, get_user_member_id(), v_acc_alpha, 'income', 'confirmed', 'individual', 'pix', 300000, 'Salário Ana', 'Renda', '2026-11');

    -- Agora atua como Bruno (Partner B) do mesmo núcleo
    PERFORM set_config('request.jwt.claims', '{"sub": "11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated", "email": "bruno.alpha@teste.com"}', true);

    -- Bruno deve enxergar a conta e a transação
    SELECT count(*) INTO v_count FROM bank_accounts WHERE id = v_acc_alpha;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'FALHA TESTE 2: Bruno não consegue visualizar a conta bancária do núcleo Alpha!';
    END IF;

    SELECT count(*) INTO v_count FROM transactions WHERE account_id = v_acc_alpha;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'FALHA TESTE 2: Bruno não consegue visualizar a transação do núcleo Alpha!';
    END IF;

    -- Bruno pode atualizar dados do próprio núcleo
    UPDATE transactions SET description = 'Salário Ana (Conferido por Bruno)' WHERE account_id = v_acc_alpha;

    RESET ROLE;
    RAISE NOTICE 'TESTE 2 APROVADO: Ambas participantes do núcleo Alpha compartilham visualização e edição.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 3: Isolamento RLS entre núcleos (C não acessa Alpha, A e B não acessam Beta)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_count INT;
    v_updated INT;
    v_deleted INT;
    v_acc_beta UUID;
    v_household_beta UUID;
BEGIN
    SET LOCAL ROLE authenticated;

    -- Carla (Beta) tenta visualizar dados de Alpha
    PERFORM set_config('request.jwt.claims', '{"sub": "22222222-cccc-cccc-cccc-cccccccccccc", "role": "authenticated", "email": "carla.beta@teste.com"}', true);
    
    SELECT count(*) INTO v_count FROM bank_accounts;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA TESTE 3: Carla (Beta) visualizou contas de outro núcleo!';
    END IF;

    SELECT count(*) INTO v_count FROM transactions;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA TESTE 3: Carla (Beta) visualizou transações de outro núcleo!';
    END IF;

    -- Carla tenta alterar transações de Alpha (deve afetar 0 linhas por RLS)
    UPDATE transactions SET description = 'Invasão Beta' WHERE description LIKE '%Salário Ana%';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
        RAISE EXCEPTION 'FALHA TESTE 3: Carla conseguiu alterar dados de outro núcleo!';
    END IF;

    -- Carla tenta deletar transações de Alpha
    DELETE FROM transactions WHERE description LIKE '%Salário Ana%';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted > 0 THEN
        RAISE EXCEPTION 'FALHA TESTE 3: Carla conseguiu deletar dados de outro núcleo!';
    END IF;

    -- Carla cria uma conta no Núcleo Beta
    v_household_beta := get_user_household_id();
    INSERT INTO bank_accounts (id, household_id, member_id, institution, account_name, account_type, opening_balance)
    VALUES ('cccccccc-2222-2222-2222-222222222222', v_household_beta, get_user_member_id(), 'Itaú Beta', 'Conta Carla', 'checking', 10000)
    RETURNING id INTO v_acc_beta;

    -- Ana (Alpha) tenta visualizar dados de Beta
    PERFORM set_config('request.jwt.claims', '{"sub": "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated", "email": "ana.alpha@teste.com"}', true);

    SELECT count(*) INTO v_count FROM bank_accounts WHERE id = v_acc_beta;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA TESTE 3: Ana (Alpha) visualizou conta bancária do Núcleo Beta!';
    END IF;

    RESET ROLE;
    RAISE NOTICE 'TESTE 3 APROVADO: Isolamento RLS bidirecional rigoroso entre núcleos Alpha e Beta.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 4: Usuária autenticada sem núcleo (Daniel) e Sessão Anônima (anon)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_count INT;
    v_error_caught BOOLEAN := FALSE;
BEGIN
    SET LOCAL ROLE authenticated;
    -- Daniel: autenticado, mas ainda não criou nem aceitou núcleo
    PERFORM set_config('request.jwt.claims', '{"sub": "33333333-dddd-dddd-dddd-dddddddddddd", "role": "authenticated", "email": "daniel.solto@teste.com"}', true);

    SELECT count(*) INTO v_count FROM bank_accounts;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA TESTE 4: Usuária sem núcleo visualizou dados financeiros!';
    END IF;

    -- Tentativa de inserir sem pertencer a um núcleo (get_user_household_id é NULL)
    BEGIN
        INSERT INTO bank_accounts (household_id, member_id, institution, account_name, account_type)
        VALUES ('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', gen_random_uuid(), 'Banco Inválido', 'Teste', 'checking');
    EXCEPTION WHEN check_violation OR insufficient_privilege THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 4: Usuária sem núcleo conseguiu inserir dados em um núcleo!';
    END IF;

    -- Sessão Anônima (anon)
    SET LOCAL ROLE anon;
    PERFORM set_config('request.jwt.claims', '{"role": "anon"}', true);

    SELECT count(*) INTO v_count FROM bank_accounts;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA TESTE 4: Sessão anônima conseguiu ler contas bancárias!';
    END IF;

    SELECT count(*) INTO v_count FROM transactions;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA TESTE 4: Sessão anônima conseguiu ler transações!';
    END IF;

    RESET ROLE;
    RAISE NOTICE 'TESTE 4 APROVADO: Usuária sem núcleo e sessão anônima completamente bloqueadas.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 5: Bloqueio de 3ª Participante e Forja de Vínculos
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_token_raw TEXT := 'convite-terceira-participante-invalido';
    v_token_hash TEXT := encode(digest('convite-terceira-participante-invalido', 'sha256'), 'hex');
    v_error_caught BOOLEAN := FALSE;
    v_alpha_id UUID;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub": "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated", "email": "ana.alpha@teste.com"}', true);
    v_alpha_id := get_user_household_id();

    -- Ana tenta gerar um convite quando já existem 2 participantes no núcleo
    INSERT INTO household_invites (household_id, invited_by, invited_email, token_hash, partner_role)
    VALUES (v_alpha_id, get_user_member_id(), 'daniel.solto@teste.com', v_token_hash, 'partner_b');

    -- Daniel tenta aceitar o convite para o Núcleo Alpha que já tem 2 membros
    PERFORM set_config('request.jwt.claims', '{"sub": "33333333-dddd-dddd-dddd-dddddddddddd", "role": "authenticated", "email": "daniel.solto@teste.com"}', true);

    BEGIN
        PERFORM accept_household_invite(v_token_hash, 'Daniel Terceiro', 'Daniel');
    EXCEPTION WHEN raise_exception THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 5: Banco permitiu adicionar terceira participante!';
    END IF;

    -- Daniel tenta inserir-se diretamente em household_members forjando o núcleo
    v_error_caught := FALSE;
    BEGIN
        INSERT INTO household_members (household_id, auth_user_id, partner_role, display_name)
        VALUES (v_alpha_id, '33333333-dddd-dddd-dddd-dddddddddddd', 'partner_b', 'Daniel Invasor');
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 5: Banco permitiu inserção direta em household_members!';
    END IF;

    RESET ROLE;
    RAISE NOTICE 'TESTE 5 APROVADO: Bloqueio estrito de terceira participante e forja de vínculos.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 6: Proteção de Identidade e Imutabilidade de Auditoria sob RLS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_error_caught BOOLEAN := FALSE;
    v_log_id UUID;
    v_household_alpha UUID;
    v_updated INT;
    v_deleted INT;
    v_action TEXT;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub": "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated", "email": "ana.alpha@teste.com"}', true);
    v_household_alpha := get_user_household_id();

    -- Ana tenta alterar seu auth_user_id em household_members
    BEGIN
        UPDATE household_members
        SET auth_user_id = '33333333-dddd-dddd-dddd-dddddddddddd'
        WHERE auth_user_id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    EXCEPTION WHEN raise_exception THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 6: Banco permitiu alterar auth_user_id de participante!';
    END IF;

    -- Ana insere log de auditoria
    INSERT INTO audit_logs (household_id, actor_member_id, action, entity_type)
    VALUES (v_household_alpha, get_user_member_id(), 'LOGIN', 'auth')
    RETURNING id INTO v_log_id;

    -- Ana tenta fazer UPDATE no log de auditoria (deve atualizar 0 linhas pois não há policy de UPDATE)
    UPDATE audit_logs SET action = 'HACK' WHERE id = v_log_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
        RAISE EXCEPTION 'FALHA TESTE 6: Banco permitiu UPDATE em audit_logs!';
    END IF;

    -- Confirma que a ação continua inalterada
    SELECT action INTO v_action FROM audit_logs WHERE id = v_log_id;
    IF v_action != 'LOGIN' THEN
        RAISE EXCEPTION 'FALHA TESTE 6: Registro de auditoria foi alterado!';
    END IF;

    -- Ana tenta fazer DELETE no log de auditoria (deve deletar 0 linhas pois não há policy de DELETE)
    DELETE FROM audit_logs WHERE id = v_log_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted > 0 THEN
        RAISE EXCEPTION 'FALHA TESTE 6: Banco permitiu DELETE em audit_logs!';
    END IF;

    RESET ROLE;
    RAISE NOTICE 'TESTE 6 APROVADO: Identidade protegida e auditoria imutável mesmo para usuária autenticada.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 7: Prevenção Relacional de Vínculos Cruzados entre Núcleos (Cross-Household)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_household_alpha UUID;
    v_acc_beta UUID := 'cccccccc-2222-2222-2222-222222222222'; -- Conta do Núcleo Beta
    v_error_caught BOOLEAN := FALSE;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub": "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated", "email": "ana.alpha@teste.com"}', true);
    v_household_alpha := get_user_household_id();

    -- Ana (Alpha) tenta criar uma despesa no Núcleo Alpha apontando para a conta bancária do Núcleo Beta
    BEGIN
        INSERT INTO transactions (
            household_id, member_id, account_id, transaction_type, status,
            payment_method, amount, description, category, competence_month
        ) VALUES (
            v_household_alpha, get_user_member_id(), v_acc_beta,
            'expense', 'confirmed', 'pix', 5000, 'Tentativa Fraude Cruzada', 'Outros', '2026-11'
        );
    EXCEPTION WHEN raise_exception OR check_violation THEN
        v_error_caught := TRUE;
    END;

    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'FALHA TESTE 7: Banco permitiu vincular transação do Núcleo Alpha à conta bancária do Núcleo Beta!';
    END IF;

    RESET ROLE;
    RAISE NOTICE 'TESTE 7 APROVADO: Bloqueio relacional impede transações cruzadas entre núcleos diferentes.';
END $$;

-- ---------------------------------------------------------------------------
-- TESTE 8: Views Seguras com security_invoker = true (Não há bypass de RLS)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_count INT;
BEGIN
    SET LOCAL ROLE authenticated;
    -- Carla (Beta) consulta v_bank_account_balances
    PERFORM set_config('request.jwt.claims', '{"sub": "22222222-cccc-cccc-cccc-cccccccccccc", "role": "authenticated", "email": "carla.beta@teste.com"}', true);

    -- Carla deve ver APENAS 1 conta (a sua do Núcleo Beta). As contas de Alpha não podem aparecer!
    SELECT count(*) INTO v_count FROM v_bank_account_balances;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'FALHA TESTE 8: View expôs contas de outro núcleo! Contas obtidas: %', v_count;
    END IF;

    -- Sessão anônima na view
    SET LOCAL ROLE anon;
    PERFORM set_config('request.jwt.claims', '{"role": "anon"}', true);

    SELECT count(*) INTO v_count FROM v_bank_account_balances;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA TESTE 8: View expôs contas para sessão anônima!';
    END IF;

    RESET ROLE;
    RAISE NOTICE 'TESTE 8 APROVADO: Views com security_invoker herdam RLS e impedem qualquer bypass.';
END $$;

SELECT 'TODOS OS 8 TESTES REAIS DE SEGURANÇA E RLS FORAM EXECUTADOS E APROVADOS COM SUCESSO!' AS resultado_seguranca;
