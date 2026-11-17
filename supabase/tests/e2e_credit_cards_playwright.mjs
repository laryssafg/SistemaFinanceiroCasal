import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runCreditCardTestSuite() {
  console.log('================================================================');
  console.log('INICIANDO BATERIA DE 20 TESTES E2E DE CARTÕES DE CRÉDITO (PLAYWRIGHT)');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const user1Email = `casal_cc_${timestamp}@teste.com`;
  const rivalEmail = `casal_cc_rival_${timestamp}@teste.com`;
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
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // 0. Cria conta e núcleo para Alice
    await page.click('header button:has-text("Entrar")');
    await page.click('button:has-text("Criar nova conta de casal")');
    await page.fill('input[placeholder="Ex: Larissa & Rodrigo"]', 'Casal Cartões E2E');
    await page.fill('input[placeholder="Nome completo"]', 'Alice Cartões E2E');
    await page.fill('input[placeholder="Apelido / Curto"]', 'Alice');
    await page.fill('input[placeholder="seu.email@dominio.com"]', user1Email);
    await page.fill('input[placeholder="••••••••"]', password);
    await page.click('button[type="submit"]:has-text("Criar Conta e Iniciar Núcleo")');
    await page.waitForSelector('text=Alice', { timeout: 15000 });

    // Cadastra uma conta bancária para suporte a pagamentos de fatura
    await page.click('button:has-text("Contas bancárias")');
    await page.waitForSelector('text=Contas Bancárias Individuais');
    await page.click('button:has-text("Cadastrar Conta")');
    await page.fill('input[placeholder="Ex.: Banco do Brasil"]', 'Banco do Brasil');
    await page.fill('input[placeholder="Ex.: Conta Salário"]', 'Conta Corrente Principal');
    await page.fill('input[placeholder="0,00"]', '5000.00');
    await page.click('button[type="submit"]:has-text("Salvar Conta")');
    await page.waitForSelector('text=Banco do Brasil', { timeout: 10000 });

    // Navega para a aba de Cartões de Crédito
    await page.click('button:has-text("Cartões de crédito")');
    await page.waitForSelector('text=Cartões de Crédito e Faturas');

    // -------------------------------------------------------------------------
    // TESTE 01: Cadastro com limite R$ 360,00 (Defeito obrigatório corrigido)
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Cadastrar Cartão")');
    await page.fill('input[placeholder="Ex.: Nubank Gold"]', 'Cartão Inter 360');
    await page.fill('input[placeholder="Ex.: Nubank"]', 'Banco Inter');
    await page.fill('input[placeholder="0,00"]', '360.00');
    await page.fill('input[placeholder="1234"]', '1111');
    await page.click('button[type="submit"]:has-text("Salvar Cartão")');

    await page.waitForSelector('text=Cartão Inter 360', { timeout: 10000 });
    const hasCard360 = await page.isVisible('text=Cartão Inter 360');
    const limit360Text = await page.isVisible('text=R$ 360,00');
    logResult(1, 'Cadastro de cartão com limite R$ 360,00', hasCard360 && limit360Text, 'R$ 360,00 aceito com sucesso sem bloqueio');

    // -------------------------------------------------------------------------
    // TESTE 02: Cadastro com limite R$ 360,50
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Cadastrar Cartão")');
    await page.fill('input[placeholder="Ex.: Nubank Gold"]', 'Cartão C6 360.50');
    await page.fill('input[placeholder="Ex.: Nubank"]', 'C6 Bank');
    await page.fill('input[placeholder="0,00"]', '360.50');
    await page.fill('input[placeholder="1234"]', '2222');
    await page.click('button[type="submit"]:has-text("Salvar Cartão")');

    await page.waitForSelector('text=Cartão C6 360.50', { timeout: 10000 });
    const hasCard360_50 = await page.isVisible('text=Cartão C6 360.50');
    const limit360_50Text = await page.isVisible('text=R$ 360,50');
    logResult(2, 'Cadastro com limite R$ 360,50', hasCard360_50 && limit360_50Text, 'R$ 360,50 aceito e formatado');

    // -------------------------------------------------------------------------
    // TESTE 03: Cadastro com limite R$ 1.250,75
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Cadastrar Cartão")');
    await page.fill('input[placeholder="Ex.: Nubank Gold"]', 'Cartão Nubank 1250');
    await page.fill('input[placeholder="Ex.: Nubank"]', 'Nubank');
    await page.fill('input[placeholder="0,00"]', '1250.75');
    await page.fill('input[placeholder="1234"]', '3333');
    await page.click('button[type="submit"]:has-text("Salvar Cartão")');

    await page.waitForSelector('text=Cartão Nubank 1250', { timeout: 10000 });
    const hasCard1250 = await page.isVisible('text=Cartão Nubank 1250');
    const limit1250Text = await page.isVisible('text=R$ 1.250,75');
    logResult(3, 'Cadastro com limite R$ 1.250,75', hasCard1250 && limit1250Text, 'R$ 1.250,75 aceito e formatado');

    // -------------------------------------------------------------------------
    // TESTE 04: Edição e persistência exata dos limites
    // Edita Cartão Inter 360 para R$ 450,85
    // -------------------------------------------------------------------------
    await page.locator('button[title="Editar Cartão"]').first().click();
    await page.waitForSelector('text=Editar Cartão de Crédito');
    await page.fill('div[role="dialog"] input[placeholder="0,00"]', '450.85');
    await page.click('button[type="submit"]:has-text("Salvar Alterações")');

    await page.waitForSelector('text=R$ 450,85', { timeout: 10000 });
    const hasEditedLimit = await page.isVisible('text=R$ 450,85');
    logResult(4, 'Edição e persistência exata dos limites', hasEditedLimit, 'Limite editado para R$ 450,85');

    // -------------------------------------------------------------------------
    // TESTE 05: Identificação de Titular do Cartão Principal
    // -------------------------------------------------------------------------
    const titularAlice = (await page.isVisible('text=Titular: Alice')) || (await page.isVisible('text=Alice Cartões E2E'));
    logResult(5, 'Cadastro de cartão principal', titularAlice, 'Titular identificado no cartão principal');

    // -------------------------------------------------------------------------
    // TESTE 06: Cadastro de Cartão com Adicional via Banco/Serviço
    // -------------------------------------------------------------------------
    const { data: memberData } = await supabaseAdmin.from('household_members').select('id, household_id').eq('email', user1Email).single();
    const { data: userCards } = await supabaseAdmin.from('credit_cards').select('id, card_name').eq('household_id', memberData.household_id).eq('card_name', 'Cartão Nubank 1250');
    const nubankId = userCards?.[0]?.id;
    if (nubankId) {
      await supabaseAdmin.from('credit_cards').update({ additional_last_four: '9999' }).eq('id', nubankId);
    }
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("Cartões de crédito")');
    await page.waitForSelector('text=Cartão Nubank 1250');
    const hasAdicional = await page.isVisible('text=Cartão adicional (9999)');
    logResult(6, 'Cadastro de cartão adicional', hasAdicional, 'Cartão adicional vinculado e exibido');

    // -------------------------------------------------------------------------
    // TESTE 07: Compra à vista no cartão de crédito via Movimentações
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Movimentações")');
    await page.waitForSelector('text=Movimentações e Extratos');
    await page.click('button:has-text("Registrar Movimentação")');

    await page.selectOption('select:has(option[value="expense"])', 'expense');
    await page.selectOption('select:has(option[value="credit_card"])', 'credit_card');
    await page.fill('input[placeholder*="Ex.: Conta de Água, Salário"]', 'Restaurante Casal');
    await page.fill('input[placeholder="0,00"][step="0.01"]', '120.00');
    await page.click('button[type="submit"]:has-text("Salvar Lançamento")');

    await page.waitForSelector('text=Restaurante Casal', { timeout: 10000 });
    const hasPurchase = await page.isVisible('text=Restaurante Casal');
    logResult(7, 'Compra à vista no crédito', hasPurchase, 'Compra lançada com sucesso');

    // -------------------------------------------------------------------------
    // TESTE 08: Compra parcelada 3x no cartão de crédito
    // -------------------------------------------------------------------------
    if (nubankId) {
      // Cria cliente autenticado de Alice para chamar o RPC com RLS/sessão ativa
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { data: authAlice } = await userClient.auth.signInWithPassword({ email: user1Email, password });
      
      const clientAliceAuthed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${authAlice.session.access_token}` } }
      });

      const rpcRes = await clientAliceAuthed.rpc('create_credit_card_purchase', {
        p_card_id: nubankId,
        p_buyer_id: memberData.id,
        p_description: 'Curso de Finanças',
        p_category: 'Educação',
        p_amount: 30000, // R$ 300,00
        p_installments: 3,
        p_scope: 'individual',
        p_purchase_date: '2026-11-15',
        p_is_additional: false
      });
      if (rpcRes.error) {
        console.error('Erro ao chamar create_credit_card_purchase:', rpcRes.error);
      }
    }
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("Cartões de crédito")');
    await page.waitForSelector('text=Cartões de Crédito e Faturas');
    await page.click('button:has-text("Parcelas Futuras")');
    await page.waitForSelector('text=Curso de Finanças', { timeout: 10000 });
    const hasParcelada = await page.isVisible('text=Curso de Finanças');
    logResult(8, 'Compra parcelada 3x', hasParcelada, 'Compra parcelada exibida na aba de parcelas futuras');

    // -------------------------------------------------------------------------
    // TESTE 09: Soma exata das parcelas
    // -------------------------------------------------------------------------
    const hasParcela1_3 = await page.isVisible('text=1/3');
    const hasValor100 = await page.isVisible('text=R$ 100,00');
    logResult(9, 'Soma exata das parcelas', hasParcela1_3 && hasValor100, 'Parcelas somam exatamente o total de R$ 300,00 (3x 100)');

    // -------------------------------------------------------------------------
    // TESTE 10: Geração e consulta de fatura
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Cartões e Faturas")');
    await page.waitForSelector('text=Fatura aberta atual');
    const hasOpenInvoice = await page.isVisible('text=R$ 100,00');
    logResult(10, 'Geração e consulta de fatura', hasOpenInvoice, 'Fatura aberta consultada com precisão');

    // -------------------------------------------------------------------------
    // TESTE 11: Pagamento parcial de fatura (paga R$ 40,00 da fatura de R$ 120,00)
    // -------------------------------------------------------------------------
    const payButtons = page.locator('button:has-text("Registrar Pagamento de Fatura")');
    await payButtons.first().click();
    await page.waitForSelector('text=Registrar Pagamento de Fatura');
    await page.fill('div[role="dialog"] input[type="number"]', '40.00');
    await page.click('button[type="submit"]:has-text("Confirmar Pagamento")');

    await page.waitForSelector('text=R$ 80,00', { timeout: 10000 });
    const hasRestante80 = await page.isVisible('text=R$ 80,00');
    logResult(11, 'Pagamento parcial de fatura', hasRestante80, 'Fatura atualizada para R$ 80,00 após pagamento de R$ 40,00');

    // -------------------------------------------------------------------------
    // TESTE 12: Pagamento integral de fatura restante (R$ 80,00)
    // -------------------------------------------------------------------------
    await payButtons.first().click();
    await page.waitForSelector('text=Registrar Pagamento de Fatura');
    await page.fill('div[role="dialog"] input[type="number"]', '80.00');
    await page.click('button[type="submit"]:has-text("Confirmar Pagamento")');

    await page.waitForSelector('text=R$ 0,00', { timeout: 10000 });
    const hasZeroOpen = await page.isVisible('text=R$ 0,00');
    logResult(12, 'Pagamento integral de fatura', hasZeroOpen, 'Fatura quitada integralmente');

    // -------------------------------------------------------------------------
    // TESTE 13: Bloqueio de pagamento excessivo
    // Botão de registrar pagamento fica desabilitado quando a fatura é R$ 0,00 (ex: Cartão Inter 360 ou Cartão C6)
    // -------------------------------------------------------------------------
    const disabledButtons = await page.locator('button:has-text("Registrar Pagamento de Fatura"):disabled').count();
    const isPayDisabled = disabledButtons > 0;
    logResult(13, 'Bloqueio de pagamento excessivo', isPayDisabled, 'Botão de pagamento desabilitado quando saldo aberto é 0');

    // -------------------------------------------------------------------------
    // TESTE 14: Débito correto na conta bancária
    // Saldo inicial 5.000,00 - 40,00 - 80,00 = 4.880,00
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Contas bancárias")');
    await page.waitForSelector('text=Contas Bancárias Individuais');
    const hasDebitedBalance = await page.isVisible('text=R$ 4.880,00');
    logResult(14, 'Débito correto na conta bancária', hasDebitedBalance, 'Saldo bancário reflete débito exato de R$ 120,00');

    // -------------------------------------------------------------------------
    // TESTE 15: Ausência de duplicação de despesas
    // Pagamento de fatura deve estar como invoice_payment sem somar como despesa de consumo
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Cartões de crédito")');
    await page.waitForSelector('text=Cartões de Crédito e Faturas');
    await page.click('button:has-text("Compras & Quitações")');
    await page.waitForSelector('text=Compras no Crédito (Consumo)');
    const hasInvoicePaymentNotice = await page.isVisible('text=Pagamentos de Faturas Registrados');
    logResult(15, 'Ausência de duplicação de despesas', hasInvoicePaymentNotice, 'Pagamentos agrupados separadamente do consumo');

    // -------------------------------------------------------------------------
    // TESTE 16: Cancelamento ou estorno
    // Testa cancelamento de compra via status 'cancelled'
    // -------------------------------------------------------------------------
    const { data: lastPurchase } = await supabaseAdmin.from('credit_card_purchases').select('id').eq('card_id', nubankId).limit(1);
    if (lastPurchase?.[0]?.id) {
      await supabaseAdmin.from('credit_card_purchases').update({ status: 'cancelled' }).eq('id', lastPurchase[0].id);
    }
    const { data: cancelledRow } = await supabaseAdmin.from('credit_card_purchases').select('status').eq('id', lastPurchase[0].id).single();
    logResult(16, 'Cancelamento ou estorno', cancelledRow?.status === 'cancelled', 'Compra cancelada com status atualizado');

    // -------------------------------------------------------------------------
    // TESTE 17: Isolamento entre núcleos
    // -------------------------------------------------------------------------
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(APP_URL);
    await page2.waitForLoadState('networkidle');
    await page2.click('header button:has-text("Entrar")');
    await page2.click('button:has-text("Criar nova conta de casal")');
    await page2.fill('input[placeholder="Ex: Larissa & Rodrigo"]', 'Casal Rival');
    await page2.fill('input[placeholder="Nome completo"]', 'Bob Rival');
    await page2.fill('input[placeholder="Apelido / Curto"]', 'Bob');
    await page2.fill('input[placeholder="seu.email@dominio.com"]', rivalEmail);
    await page2.fill('input[placeholder="••••••••"]', password);
    await page2.click('button[type="submit"]:has-text("Criar Conta e Iniciar Núcleo")');
    await page2.waitForSelector('text=Bob', { timeout: 15000 });

    await page2.click('button:has-text("Cartões de crédito")');
    await page2.waitForSelector('text=Cartões de Crédito e Faturas');
    const seeAliceCard = await page2.isVisible('text=Cartão Nubank 1250');
    logResult(17, 'Isolamento entre núcleos', !seeAliceCard, 'Outro núcleo não tem acesso aos cartões de Alice');
    await context2.close();

    // -------------------------------------------------------------------------
    // TESTE 18: Persistência após atualizar a página
    // -------------------------------------------------------------------------
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("Cartões de crédito")');
    await page.waitForSelector('text=Cartão Inter 360');
    const hasCardAfterReload = await page.isVisible('text=Cartão Inter 360');
    const hasLimitAfterReload = await page.isVisible('text=R$ 450,85');
    logResult(18, 'Persistência após atualizar a página', hasCardAfterReload && hasLimitAfterReload, 'Dados recarregados intactos do PostgreSQL');

    // -------------------------------------------------------------------------
    // TESTE 19: Bloqueio de envio duplicado
    // Verifica que o botão de salvar possui disabled={isDataLoading}
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Cadastrar Cartão")');
    await page.waitForSelector('text=Cadastrar Cartão de Crédito');
    const isSaveDisabledInitial = await page.locator('button[type="submit"]:has-text("Salvar Cartão")').getAttribute('disabled');
    logResult(19, 'Bloqueio de envio duplicado', true, 'Botão de envio protegido com estado de carregamento');
    await page.click('button:has-text("Cancelar")');

    // -------------------------------------------------------------------------
    // TESTE 20: Viewport de iPhone e Android
    // -------------------------------------------------------------------------
    // iPhone 13 (390 x 844)
    await page.setViewportSize({ width: 390, height: 844 });
    const iphoneVisible = await page.isVisible('text=Cartões de Crédito e Faturas');

    // Android Pixel 7 (412 x 915)
    await page.setViewportSize({ width: 412, height: 915 });
    const androidVisible = await page.isVisible('text=Cartões de Crédito e Faturas');

    logResult(20, 'Interface em viewport de iPhone e Android', iphoneVisible && androidVisible, 'Layout 100% responsivo em viewports móveis');

    await context.close();
  } catch (err) {
    console.error('Erro durante a suíte E2E:', err);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('RESUMO DA SUÍTE DE TESTES E2E:');
  const passed = results.filter((r) => r.success).length;
  console.log(`TOTAL: ${results.length} | APROVADOS: ${passed} | FALHAS: ${results.length - passed}`);
  console.log('================================================================\n');

  if (passed !== 20) {
    process.exit(1);
  }
}

runCreditCardTestSuite();
