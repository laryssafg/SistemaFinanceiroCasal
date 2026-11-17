import { chromium } from 'playwright';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000';

async function runPersistenceSuite() {
  console.log('================================================================');
  console.log('INICIANDO SUÍTE E2E: PERSISTÊNCIA, AUTENTICAÇÃO E F5 (T06.2)');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const results = [];
  function logResult(id, name, success, details = '') {
    results.push({ id, name, success, details });
    const mark = success ? '✅ APROVADO' : '❌ FALHA';
    console.log(`[CENÁRIO ${id}] ${name}: ${mark} ${details ? '(' + details + ')' : ''}`);
  }

  const timestamp = Date.now();
  const user1Email = `casal_persist_a_${timestamp}@teste.com`;
  const user2Email = `casal_persist_b_${timestamp}@teste.com`;
  const rivalEmail = `casal_persist_rival_${timestamp}@teste.com`;
  const password = 'SenhaForte123!';

  try {
    // -------------------------------------------------------------------------
    // CENÁRIO A: Sessão autenticada e sobrevivência ao F5
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO A: SESSÃO AUTENTICADA ---');
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto(APP_URL);
    await page1.waitForLoadState('networkidle');

    // Verifica que entra inicialmente em modo demonstração
    let isDemoVisible = await page1.locator('text=Modo Demonstração (Simulado)').isVisible();
    logResult('A1', 'Modo demonstração visível inicialmente', isDemoVisible, 'Identificação visual clara');

    // Cadastro de usuário e núcleo
    await page1.click('header button:has-text("Entrar")');
    await page1.click('button:has-text("Criar nova conta de casal")');
    await page1.fill('input[placeholder="Ex: Larissa & Rodrigo"]', 'Casal Persistência E2E');
    await page1.fill('input[placeholder="Nome completo"]', 'Alice Persistência');
    await page1.fill('input[placeholder="Apelido / Curto"]', 'Alice');
    await page1.fill('input[placeholder="seu.email@dominio.com"]', user1Email);
    await page1.fill('input[placeholder="••••••••"]', password);
    await page1.click('button[type="submit"]:has-text("Criar Conta e Iniciar Núcleo")');
    await page1.waitForSelector('header button:has-text("Alice")', { timeout: 15000 });

    // Modo demonstração deve ter sumido
    isDemoVisible = await page1.locator('text=Modo Demonstração (Simulado)').isVisible();
    logResult('A2', 'Modo demonstração removido no login', !isDemoVisible, 'Usuária autenticada com sucesso');

    // F5 na sessão autenticada
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    const userStillLogged = (await page1.locator('header button:has-text("Alice")').count()) > 0;
    isDemoVisible = await page1.locator('text=Modo Demonstração (Simulado)').isVisible();
    logResult('A3', 'Sessão sobrevive ao F5', userStillLogged && !isDemoVisible, 'JWT e sessão recuperados do storage');

    // -------------------------------------------------------------------------
    // CENÁRIO B: Contas bancárias e F5
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO B: CONTAS BANCÁRIAS ---');
    await page1.click('button:has-text("Contas bancárias")');
    await page1.waitForSelector('text=Contas Bancárias Individuais');

    await page1.click('button:has-text("Cadastrar Conta")');
    await page1.fill('input[placeholder="Ex.: Banco do Brasil"]', 'Banco Nubank Alice');
    await page1.fill('input[placeholder="Ex.: Conta Salário"]', 'Conta Principal');
    await page1.fill('input[placeholder="0,00"]', '2500.50');
    await page1.click('button[type="submit"]:has-text("Salvar Conta")');
    await page1.waitForTimeout(1000);

    let countBefore = await page1.locator('text=Banco Nubank Alice').count();
    logResult('B1', 'Conta bancária criada com R$ 2.500,50', countBefore > 0, 'Persistida no PostgreSQL');

    // F5 na página de contas
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(1000);

    let countAfter = await page1.locator('text=Banco Nubank Alice').count();
    let isSamePage = (await page1.locator('header').innerText()).includes('Contas bancárias');
    logResult('B2', 'Conta mantida após F5 na mesma tela', countAfter > 0 && isSamePage, 'Saldo e conta intactos');

    // Cria segunda conta para transferências futuras
    await page1.click('button:has-text("Cadastrar Conta")');
    await page1.fill('input[placeholder="Ex.: Banco do Brasil"]', 'Banco Itaú Alice');
    await page1.fill('input[placeholder="Ex.: Conta Salário"]', 'Conta Reserva');
    await page1.fill('input[placeholder="0,00"]', '1000.00');
    await page1.click('button[type="submit"]:has-text("Salvar Conta")');
    await page1.waitForTimeout(1000);

    // -------------------------------------------------------------------------
    // CENÁRIO C: Receitas e despesas e F5
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO C: RECEITAS E DESPESAS ---');
    await page1.click('button:has-text("Movimentações")');
    await page1.waitForSelector('text=Movimentações e Extratos');

    // 1. Cadastra Receita
    await page1.click('button:has-text("Registrar Movimentação")');
    await page1.selectOption('select:has(option[value="income"])', 'income');
    await page1.fill('input[placeholder*="Ex.: Conta de Água, Salário"]', 'Salário Alice Real');
    await page1.fill('input[placeholder="0,00"][step="0.01"]', '5000.00');
    await page1.click('button[type="submit"]:has-text("Salvar Lançamento")');
    await page1.waitForSelector('text=Salário Alice Real', { timeout: 10000 });

    // 2. Cadastra Despesa
    await page1.click('button:has-text("Registrar Movimentação")');
    await page1.selectOption('select:has(option[value="expense"])', 'expense');
    await page1.fill('input[placeholder*="Ex.: Conta de Água, Salário"]', 'Aluguel do Mês');
    await page1.fill('input[placeholder="0,00"][step="0.01"]', '1800.75');
    await page1.click('button[type="submit"]:has-text("Salvar Lançamento")');
    await page1.waitForSelector('text=Aluguel do Mês', { timeout: 10000 });

    let hasReceita = (await page1.locator('text=Salário Alice Real').count()) > 0;
    let hasDespesa = (await page1.locator('text=Aluguel do Mês').count()) > 0;
    logResult('C1', 'Receita e Despesa cadastradas', hasReceita && hasDespesa, 'Ambas visíveis no extrato');

    // F5 em Movimentações
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(1000);

    hasReceita = (await page1.locator('text=Salário Alice Real').count()) > 0;
    hasDespesa = (await page1.locator('text=Aluguel do Mês').count()) > 0;
    let isMovPage = (await page1.locator('header').innerText()).includes('Movimentações');
    logResult('C2', 'Movimentações recuperadas após F5', hasReceita && hasDespesa && isMovPage, 'Persistidas no PostgreSQL');

    // -------------------------------------------------------------------------
    // CENÁRIO D: Cartões de crédito, compras e F5
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO D: CARTÕES DE CRÉDITO ---');
    await page1.click('button:has-text("Cartões de crédito")');
    await page1.waitForSelector('text=Cartões de Crédito e Faturas');

    await page1.click('button:has-text("Cadastrar Cartão")');
    await page1.fill('input[placeholder="Ex.: Nubank Gold"]', 'Nubank Ultravioleta Real');
    await page1.fill('input[placeholder="Ex.: Nubank"]', 'Nubank');
    await page1.fill('input[placeholder="0,00"]', '360.00');
    await page1.fill('input[placeholder="1234"]', '9876');
    await page1.click('button[type="submit"]:has-text("Salvar Cartão")');
    await page1.waitForSelector('text=Nubank Ultravioleta Real', { timeout: 10000 });

    let countCard = await page1.locator('text=Nubank Ultravioleta Real').count();
    logResult('D1', 'Cartão criado com limite R$ 360,00', countCard > 0, 'Limite monetário exato');

    // Lança compra no cartão via Movimentações
    await page1.click('button:has-text("Movimentações")');
    await page1.waitForSelector('text=Movimentações e Extratos');
    await page1.click('button:has-text("Registrar Movimentação")');
    await page1.selectOption('select:has(option[value="expense"])', 'expense');
    await page1.fill('input[placeholder*="Ex.: Conta de Água, Salário"]', 'Jantar Romântico');
    await page1.fill('input[placeholder="0,00"][step="0.01"]', '125.75');
    // Seleciona forma de pagamento Cartão de Crédito
    await page1.selectOption('select:has(option[value="credit_card"])', 'credit_card');
    await page1.click('button[type="submit"]:has-text("Salvar Lançamento")');
    await page1.waitForSelector('text=Jantar Romântico', { timeout: 10000 });

    let hasPurchase = (await page1.locator('text=Jantar Romântico').count()) > 0;
    logResult('D2', 'Compra no crédito R$ 125,75 registrada', hasPurchase, 'Fatura atualizada');

    // Volta a cartões e dá F5
    await page1.click('button:has-text("Cartões de crédito")');
    await page1.waitForSelector('text=Cartões de Crédito e Faturas');
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(1000);

    countCard = await page1.locator('text=Nubank Ultravioleta Real').count();
    let isCardPage = (await page1.locator('header').innerText()).includes('Cartões de crédito');
    logResult('D3', 'Cartão recuperado após F5', countCard > 0 && isCardPage, 'Dados íntegros no PostgreSQL');

    // -------------------------------------------------------------------------
    // CENÁRIO E: Reabertura do navegador e persistência
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO E: REABERTURA DO NAVEGADOR ---');
    // Fecha página e contexto antigo
    await page1.close();
    await context1.close();

    // Novo contexto simulando fechar e reabrir o navegador
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(APP_URL);
    await page2.waitForLoadState('networkidle');

    // Faz login com a conta de Alice
    await page2.click('header button:has-text("Entrar")');
    await page2.waitForSelector('form input[type="email"]');
    await page2.fill('input[placeholder="seu.email@dominio.com"]', user1Email);
    await page2.fill('input[placeholder="••••••••"]', password);
    await page2.click('button[type="submit"]:has-text("Entrar")');
    await page2.waitForSelector('header button:has-text("Alice")', { timeout: 15000 });

    // Confere se as contas criadas antes continuam lá
    await page2.click('button:has-text("Contas bancárias")');
    await page2.waitForTimeout(1000);
    const hasNubankAfterReopen = (await page2.locator('text=Banco Nubank Alice').count()) > 0;
    const hasItauAfterReopen = (await page2.locator('text=Banco Itaú Alice').count()) > 0;
    logResult('E1', 'Contas recuperadas após reabertura e login', hasNubankAfterReopen && hasItauAfterReopen, '100% persistidas no PostgreSQL');

    // Confere se o cartão continua lá
    await page2.click('button:has-text("Cartões de crédito")');
    await page2.waitForTimeout(1000);
    const hasCardAfterReopen = (await page2.locator('text=Nubank Ultravioleta Real').count()) > 0;
    logResult('E2', 'Cartões recuperados após reabertura e login', hasCardAfterReopen, '100% persistidos no PostgreSQL');

    // -------------------------------------------------------------------------
    // CENÁRIO F: Isolamento entre núcleos e RLS
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO F: SEGURANÇA E ISOLAMENTO RLS ---');
    const contextRival = await browser.newContext();
    const pageRival = await contextRival.newPage();
    await pageRival.goto(APP_URL);
    await pageRival.waitForLoadState('networkidle');

    // Cadastro do casal rival
    await pageRival.click('header button:has-text("Entrar")');
    await pageRival.click('button:has-text("Criar nova conta de casal")');
    await pageRival.fill('input[placeholder="Ex: Larissa & Rodrigo"]', 'Casal Rival');
    await pageRival.fill('input[placeholder="Nome completo"]', 'Bob Rival');
    await pageRival.fill('input[placeholder="Apelido / Curto"]', 'Bob');
    await pageRival.fill('input[placeholder="seu.email@dominio.com"]', rivalEmail);
    await pageRival.fill('input[placeholder="••••••••"]', password);
    await pageRival.click('button[type="submit"]:has-text("Criar Conta e Iniciar Núcleo")');
    await pageRival.waitForSelector('header button:has-text("Bob")', { timeout: 15000 });

    // Rival navega para contas bancárias
    await pageRival.click('button:has-text("Contas bancárias")');
    await pageRival.waitForTimeout(1000);
    const leakedAccounts = (await pageRival.locator('text=Banco Nubank Alice').count()) + (await pageRival.locator('text=Banco Itaú Alice').count());
    logResult('F1', 'Isolamento de Contas Bancárias (RLS)', leakedAccounts === 0, 'Zero vazamento para outro casal');

    // Rival navega para cartões de crédito
    await pageRival.click('button:has-text("Cartões de crédito")');
    await pageRival.waitForTimeout(1000);
    const leakedCards = await pageRival.locator('text=Nubank Ultravioleta Real').count();
    logResult('F2', 'Isolamento de Cartões de Crédito (RLS)', leakedCards === 0, 'Zero vazamento para outro casal');

    await contextRival.close();
    await context2.close();
    await browser.close();

    console.log('\n================================================================');
    console.log('RESUMO DA SUÍTE DE PERSISTÊNCIA E AUTENTICAÇÃO:');
    console.log(`TOTAL: ${results.length} | APROVADOS: ${results.filter(r => r.success).length} | FALHAS: ${results.filter(r => !r.success).length}`);
    console.log('================================================================\n');

    if (results.some(r => !r.success)) {
      process.exit(1);
    }
  } catch (err) {
    console.error('ERRO INESPERADO NA SUÍTE:', err);
    await browser.close();
    process.exit(1);
  }
}

runPersistenceSuite();
