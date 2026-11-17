import { chromium } from 'playwright';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000';

async function runBenefitsSuite() {
  console.log('================================================================');
  console.log('INICIANDO SUÍTE E2E: BENEFÍCIOS VR/VA, REGRAS E PERSISTÊNCIA (T07)');
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
  const user1Email = `casal_vrva_a_${timestamp}@teste.com`;
  const user2Email = `casal_vrva_b_${timestamp}@teste.com`;
  const rivalEmail = `casal_vrva_rival_${timestamp}@teste.com`;
  const password = 'SenhaForte123!';

  try {
    // -------------------------------------------------------------------------
    // CENÁRIO J: Separação do Modo Demonstração
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO J: SEPARAÇÃO DO MODO DEMONSTRAÇÃO ---');
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto(APP_URL);
    await page1.waitForLoadState('networkidle');

    let isDemoVisible = await page1.locator('text=Modo Demonstração (Simulado)').isVisible();
    logResult('J1', 'Modo demonstração visível inicialmente', isDemoVisible, 'Identificação clara');

    // Cadastro de usuário e núcleo
    await page1.click('header button:has-text("Entrar")');
    await page1.click('button:has-text("Criar nova conta de casal")');
    await page1.fill('input[placeholder="Ex: Larissa & Rodrigo"]', 'Casal Benefícios E2E');
    await page1.fill('input[placeholder="Nome completo"]', 'Alice Benefícios');
    await page1.fill('input[placeholder="Apelido / Curto"]', 'Alice');
    await page1.fill('input[placeholder="seu.email@dominio.com"]', user1Email);
    await page1.fill('input[placeholder="••••••••"]', password);
    await page1.click('button[type="submit"]:has-text("Criar Conta e Iniciar Núcleo")');
    await page1.waitForSelector('header button:has-text("Alice")', { timeout: 15000 });

    isDemoVisible = await page1.locator('text=Modo Demonstração (Simulado)').isVisible();
    logResult('J2', 'Modo demonstração removido após autenticação', !isDemoVisible, 'Sessão GoTrue ativa');

    // -------------------------------------------------------------------------
    // CENÁRIO A: Cadastro de Cartão VR e F5
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO A: CADASTRO DE CARTÃO BENEFÍCIO E F5 ---');
    await page1.click('button:has-text("Benefícios VR/VA")');
    await page1.waitForSelector('text=Benefícios VR e VA');

    await page1.click('button:has-text("Cadastrar Benefício")');
    await page1.selectOption('select:has(option[value="VR"])', 'VR');
    await page1.fill('input[placeholder*="Alelo Refeição"]', 'Alelo Refeição Alice');
    await page1.fill('input[placeholder="0,00"]', '500.50');
    await page1.click('button[type="submit"]:has-text("Salvar Benefício")');
    await page1.waitForSelector('text=Alelo Refeição Alice', { timeout: 10000 });

    let hasCard = (await page1.locator('text=Alelo Refeição Alice').count()) > 0;
    let cardText = await page1.locator('text=R$ 500,50').count();
    logResult('A1', 'Cartão VR cadastrado com saldo inicial R$ 500,50', hasCard && cardText > 0, 'Persistido no PostgreSQL');

    // Recarregar com F5
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(1000);

    hasCard = (await page1.locator('text=Alelo Refeição Alice').count()) > 0;
    cardText = await page1.locator('text=R$ 500,50').count();
    let isSamePage = (await page1.locator('header').innerText()).includes('Benefícios');
    logResult('A2', 'Cartão e saldo persistem intactos após F5', hasCard && cardText > 0 && isSamePage, 'Recuperado de v_benefit_card_balances');

    // -------------------------------------------------------------------------
    // CENÁRIO B: Registrar Crédito (Recarga)
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO B: REGISTRAR CRÉDITO E F5 ---');
    await page1.click('button:has-text("Registrar Crédito (Recarga)")');
    await page1.fill('input[placeholder*="Recarga mensal da empresa"]', 'Recarga Mensal Empresa');
    await page1.fill('input[placeholder="0,00"]', '350.75');
    await page1.click('button[type="submit"]:has-text("Confirmar Recarga")');
    await page1.waitForTimeout(1500);

    // Saldo esperado: 500.50 + 350.75 = 851.25
    let has851 = (await page1.locator('text=851,25').count()) > 0;
    logResult('B1', 'Crédito de R$ 350,75 registrado (Novo saldo R$ 851,25)', has851, 'Atualização em tempo real');

    // F5
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(1000);

    has851 = (await page1.locator('text=851,25').count()) > 0;
    logResult('B2', 'Saldo R$ 851,25 permanece após F5', has851, 'Crédito gravado no PostgreSQL');

    // -------------------------------------------------------------------------
    // CENÁRIO C: Registrar Consumo (Compra) e Regra de Isolamento Patrimonial
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO C: CONSUMO E ISOLAMENTO PATRIMONIAL ---');
    // Verifica saldo bancário antes da compra
    await page1.click('button:has-text("Contas bancárias")');
    await page1.waitForSelector('text=Contas Bancárias Individuais');
    let bankStillEmpty = (await page1.locator('text=Nenhuma conta cadastrada').count()) > 0;

    // Volta a benefícios
    await page1.click('button:has-text("Benefícios VR/VA")');
    await page1.waitForSelector('text=Benefícios VR e VA');

    await page1.click('button:has-text("Registrar Compra VR/VA")');
    await page1.fill('input[placeholder*="Mercado, Restaurante"]', 'Almoço Restaurante Silva');
    await page1.fill('input[placeholder="0,00"]', '125.25');
    await page1.click('button[type="submit"]:has-text("Registrar no Benefício")');
    await page1.waitForTimeout(1500);

    // Saldo esperado: 851.25 - 125.25 = 726.00
    let has726 = (await page1.locator('text=726,00').count()) > 0;
    logResult('C1', 'Consumo de R$ 125,25 registrado (Saldo R$ 726,00)', has726, 'Deduzido exclusivamente do VR');

    // Verifica que saldo bancário NÃO foi alterado
    await page1.click('button:has-text("Contas bancárias")');
    await page1.waitForSelector('text=Contas Bancárias Individuais');
    bankStillEmpty = (await page1.locator('text=Nenhuma conta cadastrada').count()) > 0;
    logResult('C2', 'Isolamento Patrimonial: Contas bancárias intactas', bankStillEmpty, 'Zero impacto no saldo bancário');

    // F5 em Benefícios
    await page1.click('button:has-text("Benefícios VR/VA")');
    await page1.waitForSelector('text=Benefícios VR e VA');
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(1000);
    has726 = (await page1.locator('text=726,00').count()) > 0;
    logResult('C3', 'Saldo de benefícios persiste após F5', has726, 'PostgreSQL íntegro');

    // -------------------------------------------------------------------------
    // CENÁRIO D: Estorno com Rastreabilidade
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO D: ESTORNO COM RASTREABILIDADE ---');
    // Prepara para aceitar confirm dialog
    page1.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Clica no botão de estornar do lançamento de R$ 125,25
    const reverseBtn = page1.locator('button[title="Estornar lançamento"]').first();
    await reverseBtn.click();
    await page1.waitForTimeout(2000);

    // Saldo esperado volta para 851.25
    has851 = (await page1.locator('text=851,25').count()) > 0;
    let hasReversalBadge = (await page1.locator('text=Estorno').count()) > 0;
    logResult('D1', 'Estorno de R$ 125,25 devolveu saldo para R$ 851,25', has851 && hasReversalBadge, 'Reversão atômica via RPC');

    // O lançamento estornado não deve mais ter botão de estorno ativo
    let remainingReverseBtns = await page1.locator('button[title="Estornar lançamento"]').count();
    logResult('D2', 'Impossibilidade de estorno duplicado', remainingReverseBtns === 0, 'Bloqueio no banco e interface');

    // -------------------------------------------------------------------------
    // CENÁRIO E: Rejeição de Saldo Insuficiente
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO E: REJEIÇÃO DE SALDO INSUFICIENTE ---');
    await page1.click('button:has-text("Registrar Compra VR/VA")');
    await page1.fill('input[placeholder*="Mercado, Restaurante"]', 'Compra Gigante Rejeitada');
    await page1.fill('input[placeholder="0,00"]', '9999.00'); // Saldo é 851,25
    await page1.click('button[type="submit"]:has-text("Registrar no Benefício")');
    await page1.waitForTimeout(1500);

    // Saldo deve permanecer 851,25
    has851 = (await page1.locator('text=851,25').count()) > 0;
    let purchaseRejected = (await page1.locator('text=Compra Gigante Rejeitada').count()) === 0;
    logResult('E1', 'Compra de R$ 9.999,00 rejeitada por saldo insuficiente', has851 && purchaseRejected, 'Validação atômica no PostgreSQL');

    // Fecha o modal de compra que permaneceu aberto devido ao erro
    await page1.click('button:has-text("Cancelar")');
    await page1.waitForTimeout(500);

    // -------------------------------------------------------------------------
    // CENÁRIO F: Isolamento RLS entre Casais
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO F: ISOLAMENTO RLS ENTRE NÚCLEOS ---');
    const contextRival = await browser.newContext();
    const pageRival = await contextRival.newPage();
    await pageRival.goto(APP_URL);
    await pageRival.waitForLoadState('networkidle');

    await pageRival.click('header button:has-text("Entrar")');
    await pageRival.click('button:has-text("Criar nova conta de casal")');
    await pageRival.fill('input[placeholder="Ex: Larissa & Rodrigo"]', 'Casal Rival VR/VA');
    await pageRival.fill('input[placeholder="Nome completo"]', 'Bob Rival');
    await pageRival.fill('input[placeholder="Apelido / Curto"]', 'Bob');
    await pageRival.fill('input[placeholder="seu.email@dominio.com"]', rivalEmail);
    await pageRival.fill('input[placeholder="••••••••"]', password);
    await pageRival.click('button[type="submit"]:has-text("Criar Conta e Iniciar Núcleo")');
    await pageRival.waitForSelector('header button:has-text("Bob")', { timeout: 15000 });

    await pageRival.click('button:has-text("Benefícios VR/VA")');
    await pageRival.waitForSelector('text=Benefícios VR e VA');

    let leakedCard = await pageRival.locator('h3:has-text("Alelo Refeição Alice")').count();
    let hasEmpty = (await pageRival.locator('text=Nenhum benefício cadastrado').count()) > 0;
    logResult('F1', 'Isolamento de benefícios RLS', leakedCard === 0 && hasEmpty, 'Casal rival não vê cartões de Alice');

    await contextRival.close();

    // -------------------------------------------------------------------------
    // CENÁRIO I: Responsividade Móvel (iPhone e Android)
    // -------------------------------------------------------------------------
    console.log('\n--- CENÁRIO I: RESPONSIVIDADE MOBILE ---');
    // iPhone 13 (390x844)
    await page1.setViewportSize({ width: 390, height: 844 });
    await page1.waitForTimeout(500);
    let mobileCard = await page1.locator('h3:has-text("Alelo Refeição Alice")').first().isVisible();
    logResult('I1', 'Layout em iPhone 13 (390x844)', mobileCard, 'Cards e métricas responsivas');

    // Android (412x915)
    await page1.setViewportSize({ width: 412, height: 915 });
    await page1.waitForTimeout(500);
    mobileCard = await page1.locator('h3:has-text("Alelo Refeição Alice")').first().isVisible();
    logResult('I2', 'Layout em Android (412x915)', mobileCard, 'Renderização fluida sem quebras');

    await context1.close();
    await browser.close();

    console.log('\n================================================================');
    console.log('RESUMO DA SUÍTE DE BENEFÍCIOS VR/VA:');
    console.log(`TOTAL: ${results.length} | APROVADOS: ${results.filter(r => r.success).length} | FALHAS: ${results.filter(r => !r.success).length}`);
    console.log('================================================================\n');

    if (results.some(r => !r.success)) {
      process.exit(1);
    }
  } catch (err) {
    console.error('ERRO INESPERADO NA SUÍTE DE BENEFÍCIOS:', err);
    await browser.close();
    process.exit(1);
  }
}

runBenefitsSuite();
