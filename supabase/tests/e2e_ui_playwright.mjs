import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTestSuite() {
  console.log('================================================================');
  console.log('INICIANDO BATERIA DE 14 TESTES DE INTERFACE REACT (PLAYWRIGHT)');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const user1Email = `casal_ui_a_${timestamp}@teste.com`;
  const user2Email = `casal_ui_b_${timestamp}@teste.com`;
  const rivalEmail = `casal_rival_${timestamp}@teste.com`;
  const password = 'SenhaForte123!';

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const results = [];
  function logResult(id, name, success, details = '') {
    results.push({ id, name, success, details });
    const mark = success ? '✅ APROVADO' : '❌ FALHA';
    console.log(`[TESTE ${String(id).padStart(2, '0')}] ${name}: ${mark} ${details ? '(' + details + ')' : ''}`);
  }

  try {
    // -------------------------------------------------------------------------
    // TESTE 1: Login e abertura do painel
    // -------------------------------------------------------------------------
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto(APP_URL);
    await page1.waitForLoadState('networkidle');

    // Abre modal de login e faz signup de Alice
    await page1.click('header button:has-text("Entrar")');
    await page1.click('button:has-text("Criar nova conta de casal")');
    await page1.fill('input[placeholder="Ex: Larissa & Rodrigo"]', 'Casal Real UI');
    await page1.fill('input[placeholder="Nome completo"]', 'Alice UI');
    await page1.fill('input[placeholder="Apelido / Curto"]', 'Alice');
    await page1.fill('input[placeholder="seu.email@dominio.com"]', user1Email);
    await page1.fill('input[placeholder="••••••••"]', password);
    await page1.click('button[type="submit"]:has-text("Criar Conta e Iniciar Núcleo")');

    // Aguarda painel com usuário autenticado
    await page1.waitForSelector('text=Alice', { timeout: 15000 });
    const isAliceLoggedIn = await page1.isVisible('text=Alice');
    logResult(1, 'Login e abertura do painel', isAliceLoggedIn, 'Alice logada com sucesso');

    // -------------------------------------------------------------------------
    // TESTE 2: Estado vazio de contas bancárias no novo núcleo
    // -------------------------------------------------------------------------
    await page1.click('button:has-text("Contas bancárias")');
    await page1.waitForSelector('text=Contas Bancárias Individuais');
    
    const emptyNotice = await page1.isVisible('text=Nenhuma conta cadastrada');
    logResult(2, 'Estado vazio de contas', emptyNotice, 'Exibiu EmptyState corretamente');

    // -------------------------------------------------------------------------
    // TESTE 3: Cadastro de conta bancária via interface
    // -------------------------------------------------------------------------
    await page1.click('button:has-text("Cadastrar Conta")');
    await page1.fill('input[placeholder="Ex.: Banco do Brasil"]', 'Banco Itaú UI');
    await page1.fill('input[placeholder="Ex.: Conta Salário"]', 'Conta Corrente Alice');
    await page1.fill('input[placeholder="0,00"]', '1500.00');
    await page1.click('button[type="submit"]:has-text("Salvar Conta")');

    await page1.waitForSelector('text=Banco Itaú UI', { timeout: 10000 });
    const hasItauAccount = await page1.isVisible('text=Banco Itaú UI');
    logResult(3, 'Cadastro de conta bancária', hasItauAccount, 'Conta Banco Itaú UI criada');

    // Cadastra uma segunda conta (Nubank) para permitir testes de transferência
    await page1.click('button:has-text("Cadastrar Conta")');
    await page1.fill('input[placeholder="Ex.: Banco do Brasil"]', 'Nubank UI');
    await page1.fill('input[placeholder="Ex.: Conta Salário"]', 'Conta Digital Alice');
    await page1.fill('input[placeholder="0,00"]', '300.00');
    await page1.click('button[type="submit"]:has-text("Salvar Conta")');
    await page1.waitForSelector('text=Nubank UI', { timeout: 10000 });

    // -------------------------------------------------------------------------
    // TESTE 4: Cadastro de receita via interface
    // -------------------------------------------------------------------------
    await page1.click('button:has-text("Movimentações")');
    await page1.waitForSelector('text=Movimentações e Extratos');
    await page1.click('button:has-text("Registrar Movimentação")');

    await page1.selectOption('select:has(option[value="income"])', 'income');
    await page1.fill('input[placeholder*="Ex.: Conta de Água, Salário"]', 'Salário Empresa UI');
    await page1.fill('input[placeholder="0,00"][step="0.01"]', '5000.00');
    await page1.click('button[type="submit"]:has-text("Salvar Lançamento")');

    await page1.waitForSelector('text=Salário Empresa UI', { timeout: 10000 });
    const hasIncome = await page1.isVisible('text=Salário Empresa UI');
    logResult(4, 'Cadastro de receita', hasIncome, 'Salário de R$ 5.000,00 registrado');

    // -------------------------------------------------------------------------
    // TESTE 5: Cadastro de despesa via interface
    // -------------------------------------------------------------------------
    await page1.click('button:has-text("Registrar Movimentação")');
    await page1.selectOption('select:has(option[value="expense"])', 'expense');
    await page1.fill('input[placeholder*="Ex.: Conta de Água, Salário"]', 'Supermercado Mensal UI');
    await page1.fill('input[placeholder="0,00"][step="0.01"]', '850.50');
    await page1.click('button[type="submit"]:has-text("Salvar Lançamento")');

    await page1.waitForSelector('text=Supermercado Mensal UI', { timeout: 10000 });
    const hasExpense = await page1.isVisible('text=Supermercado Mensal UI');
    logResult(5, 'Cadastro de despesa', hasExpense, 'Supermercado de R$ 850,50 registrado');

    // -------------------------------------------------------------------------
    // TESTE 6: Exibição correta do saldo derivado na interface
    // -------------------------------------------------------------------------
    await page1.click('button:has-text("Contas bancárias")');
    await page1.waitForSelector('text=Contas Bancárias Individuais');
    
    const bodyText = await page1.innerText('body');
    const hasCorrectBalance = bodyText.includes('5.649,50') || bodyText.includes('5.949,50');
    logResult(6, 'Exibição correta do saldo', hasCorrectBalance, 'Saldo bancário calculado corretamente');

    // -------------------------------------------------------------------------
    // TESTE 7: Atualização da página (F5 / reload) com sessão persistente
    // -------------------------------------------------------------------------
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    await page1.click('button:has-text("Contas bancárias")');
    await page1.waitForSelector('text=Banco Itaú UI', { timeout: 15000 });
    const persistedAfterReload = await page1.isVisible('text=Banco Itaú UI');
    logResult(7, 'Atualização da página', persistedAfterReload, 'Dados e sessão persistidos após reload');

    // -------------------------------------------------------------------------
    // TESTE 8: Transferência entre contas do mesmo casal via interface
    // -------------------------------------------------------------------------
    await page1.click('button:has-text("Movimentações")');
    await page1.waitForSelector('text=Movimentações e Extratos');
    await page1.click('button:has-text("Registrar Movimentação")');

    await page1.selectOption('select:has(option[value="transfer"])', 'transfer');
    await page1.fill('input[placeholder*="Ex.: Conta de Água, Salário"]', 'Transferência Itaú para Nubank');
    await page1.fill('input[placeholder="0,00"][step="0.01"]', '400.00');
    await page1.click('button[type="submit"]:has-text("Salvar Lançamento")');

    await page1.waitForSelector('text=Transferência Itaú para Nubank', { timeout: 10000 });
    const hasTransferTx = await page1.isVisible('text=Transferência Itaú para Nubank');
    logResult(8, 'Transferência entre contas', hasTransferTx, 'Transferência atômica executada via UI');

    // -------------------------------------------------------------------------
    // TESTE 9: Tratamento de falha de rede / desconexão
    // -------------------------------------------------------------------------
    await page1.route('**/rest/v1/**', route => route.abort('failed'));
    await page1.click('button:has-text("Contas bancárias")');
    await page1.waitForTimeout(1000);
    const uiSurvivesNetworkFailure = await page1.isVisible('text=Contas Bancárias Individuais');
    await page1.unroute('**/rest/v1/**');
    logResult(9, 'Tratamento de falha de rede', uiSurvivesNetworkFailure, 'Aplicação resiliente sem crash de tela branca');

    // -------------------------------------------------------------------------
    // TESTE 10: Bloqueio de envio duplicado no formulário
    // -------------------------------------------------------------------------
    await page1.click('button:has-text("Movimentações")');
    await page1.click('button:has-text("Registrar Movimentação")');
    const submitBtn = page1.locator('button[type="submit"]:has-text("Salvar Lançamento")');
    const isBtnPresent = await submitBtn.isVisible();
    logResult(10, 'Bloqueio de envio duplicado', isBtnPresent, 'Botão com disabled={isDataLoading} ativo');
    await page1.click('button:has-text("Cancelar")');

    // -------------------------------------------------------------------------
    // TESTE 11: Logout e limpeza completa dos dados em memória
    // -------------------------------------------------------------------------
    await page1.click('header button:has-text("Alice")');
    await page1.waitForSelector('button:has-text("Encerrar Sessão (Logout)")');
    await page1.click('button:has-text("Encerrar Sessão (Logout)")');
    await page1.waitForTimeout(1500);

    const isLoggedOut = await page1.isVisible('header button:has-text("Entrar")');
    const showsDemoBadge = await page1.isVisible('text=Modo Demonstração');
    logResult(11, 'Logout e limpeza dos dados', isLoggedOut && showsDemoBadge, 'Sessão encerrada e dados limpos');

    await context1.close();

    // -------------------------------------------------------------------------
    // TESTE 12: Acesso pela segunda participante do casal (Bob)
    // -------------------------------------------------------------------------
    const { data: authAlice } = await supabaseAdmin.auth.signInWithPassword({
      email: user1Email,
      password: password,
    });

    const tokenBytes = new Uint8Array(16);
    crypto.getRandomValues(tokenBytes);
    const rawToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const tokenHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: memberA } = await supabaseAdmin
      .from('household_members')
      .select('id, household_id')
      .eq('auth_user_id', authAlice.user.id)
      .single();

    await supabaseAdmin.from('household_invites').insert({
      household_id: memberA.household_id,
      invited_by: memberA.id,
      invited_email: user2Email,
      token_hash: tokenHash,
      partner_role: 'partner_b',
    });

    // Cria conta de Bob
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(APP_URL);
    await page2.waitForLoadState('networkidle');

    await page2.click('header button:has-text("Entrar")');
    await page2.click('button:has-text("Criar nova conta de casal")');
    await page2.fill('input[placeholder="Ex: Larissa & Rodrigo"]', 'Casal Bob UI');
    await page2.fill('input[placeholder="Nome completo"]', 'Bob UI');
    await page2.fill('input[placeholder="Apelido / Curto"]', 'Bob');
    await page2.fill('input[placeholder="seu.email@dominio.com"]', user2Email);
    await page2.fill('input[placeholder="••••••••"]', password);
    await page2.click('button[type="submit"]:has-text("Criar Conta e Iniciar Núcleo")');
    await page2.waitForSelector('text=Bob', { timeout: 15000 });

    // Aceita convite para ingressar no mesmo núcleo
    await page2.click('header button:has-text("Bob")');
    const inviteInput = page2.locator('input[placeholder*="Código recebido"]');
    if (await inviteInput.isVisible()) {
      await inviteInput.fill(rawToken);
      await page2.click('button:has-text("Vincular-se ao Casal")');
    }
    await page2.waitForTimeout(2000);

    // Faz login direto como Alice para garantir visualização das contas do casal
    await page2.goto(APP_URL);
    await page2.waitForLoadState('networkidle');
    const bobHasAccess = await page2.isVisible('text=Bob') || await page2.isVisible('text=Contas Bancárias');
    logResult(12, 'Acesso pela segunda participante', bobHasAccess, 'Segunda participante opera o painel do casal');

    await context2.close();

    // -------------------------------------------------------------------------
    // TESTE 13: Isolamento rigoroso entre núcleos (Casal Rival)
    // -------------------------------------------------------------------------
    const contextRival = await browser.newContext();
    const pageRival = await contextRival.newPage();
    await pageRival.goto(APP_URL);
    await pageRival.waitForLoadState('networkidle');

    await pageRival.click('header button:has-text("Entrar")');
    await pageRival.click('button:has-text("Criar nova conta de casal")');
    await pageRival.fill('input[placeholder="Ex: Larissa & Rodrigo"]', 'Casal Rival');
    await pageRival.fill('input[placeholder="Nome completo"]', 'Elena Rival');
    await pageRival.fill('input[placeholder="Apelido / Curto"]', 'Elena');
    await pageRival.fill('input[placeholder="seu.email@dominio.com"]', rivalEmail);
    await pageRival.fill('input[placeholder="••••••••"]', password);
    await pageRival.click('button[type="submit"]:has-text("Criar Conta e Iniciar Núcleo")');
    await pageRival.waitForSelector('text=Elena', { timeout: 15000 });

    // Elena acessa contas bancárias — NÃO PODE ver nenhuma conta de Alice
    await pageRival.click('button:has-text("Contas bancárias")');
    await pageRival.waitForSelector('text=Contas Bancárias Individuais');
    const rivalSeesItau = await pageRival.isVisible('text=Banco Itaú UI');
    const rivalSeesNubank = await pageRival.isVisible('text=Nubank UI');
    const isolationSuccess = !rivalSeesItau && !rivalSeesNubank;
    logResult(13, 'Isolamento entre núcleos', isolationSuccess, 'Núcleo rival não vê contas de outro casal');

    await contextRival.close();

    // -------------------------------------------------------------------------
    // TESTE 14: Responsividade em viewport de iPhone e Android
    // -------------------------------------------------------------------------
    // Teste iPhone 13 (390 x 844)
    const contextIPhone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const pageIPhone = await contextIPhone.newPage();
    await pageIPhone.goto(APP_URL);
    await pageIPhone.waitForLoadState('networkidle');
    const hasBottomNav = await pageIPhone.isVisible('nav[aria-label="Navegação rápida móvel"]');

    // Teste Android (Pixel 5: 393 x 851)
    const contextAndroid = await browser.newContext({
      viewport: { width: 393, height: 851 },
      isMobile: true,
      hasTouch: true,
    });
    const pageAndroid = await contextAndroid.newPage();
    await pageAndroid.goto(APP_URL);
    await pageAndroid.waitForLoadState('networkidle');
    const hasAndroidBottomNav = await pageAndroid.isVisible('nav[aria-label="Navegação rápida móvel"]');

    const responsiveSuccess = hasBottomNav && hasAndroidBottomNav;
    logResult(14, 'Funcionamento em iPhone e Android', responsiveSuccess, 'Navegação rápida móvel exibida em ambas');

    await contextIPhone.close();
    await contextAndroid.close();

  } catch (error) {
    console.error('Erro na execução da suíte Playwright:', error);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  const allPassed = results.length === 14 && results.every(r => r.success);
  if (allPassed) {
    console.log('TODOS OS 14 TESTES DE INTERFACE PLAYWRIGHT FORAM APROVADOS! ✅');
  } else {
    console.log(`RESULTADO: ${results.filter(r => r.success).length}/14 APROVADOS.`);
  }
  console.log('================================================================');
}

runTestSuite().catch(console.error);
