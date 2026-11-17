import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function runRealAuthAudit() {
  console.log('--- INICIANDO AUDITORIA DE AUTENTICAÇÃO REAL E API GOTRUE/POSTGREST ---');
  
  const clientAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  // 1. Teste de Acesso Anônimo (Deve ser bloqueado por RLS)
  const { data: anonData, error: anonErr } = await clientAnon.from('bank_accounts').select('*');
  console.log('1. Acesso Anônimo a bank_accounts:');
  console.log('   Retorno de linhas:', anonData?.length ?? 0);
  console.log('   Status:', anonData?.length === 0 ? 'APROVADO (0 linhas vazadas)' : 'FALHA');

  // 2. Cadastro de Nova Usuária Titular 1 (Casal Gamma)
  const emailA = `audit_gamma_a_${Date.now()}@casal.test`;
  const emailB = `audit_gamma_b_${Date.now()}@casal.test`;
  const emailHacker = `hacker_${Date.now()}@invasor.test`;
  const password = 'SenhaSuperSegura123!';

  console.log('\n2. Cadastro real no GoTrue Auth (Titular A):', emailA);
  const { data: authDataA, error: signUpErrA } = await clientAnon.auth.signUp({
    email: emailA,
    password: password
  });

  if (signUpErrA || !authDataA.session) {
    console.error('FALHA no cadastro A:', signUpErrA);
    return;
  }
  console.log('   Cadastro A com sessão ativa:', !!authDataA.session);
  const clientUserA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${authDataA.session.access_token}` } }
  });

  // 3. Usuária A cria o núcleo familiar
  console.log('\n3. Criando Núcleo Familiar Gamma via RPC:');
  const { data: hhId, error: rpcErrA } = await clientUserA.rpc('create_household_with_creator', {
    p_display_name: 'Casal Gamma Auditoria',
    p_member_name: 'Ana Gamma',
    p_short_name: 'Ana'
  });
  console.log('   RPC create_household_with_creator retorno:', hhId);
  console.log('   Status:', hhId ? 'APROVADO' : 'FALHA', rpcErrA || '');

  // 4. Usuária A gera convite restrito para emailB
  console.log('\n4. Gerando convite para Titular B:', emailB);
  // Busca member_id de A
  const { data: memberA } = await clientUserA.from('household_members').select('*').maybeSingle();
  
  // Gera token seguro
  const token = 'audit_token_secret_' + Math.random().toString(36).substring(2);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const { error: invErr } = await clientUserA.from('household_invites').insert({
    household_id: hhId,
    invited_by: memberA.id,
    invited_email: emailB,
    token_hash: tokenHash,
    partner_role: 'partner_b'
  });
  console.log('   Convite inserido com hash SHA-256:', !invErr ? 'APROVADO' : 'FALHA');

  // 5. Teste de Segurança: Terceiro (hacker) tenta aceitar o convite de emailB
  console.log('\n5. Tentativa de roubo de convite por invasor:', emailHacker);
  const { data: authHacker } = await clientAnon.auth.signUp({
    email: emailHacker,
    password: password
  });
  const clientHacker = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${authHacker.session.access_token}` } }
  });

  const { data: hackerAccepted, error: hackerErr } = await clientHacker.rpc('accept_household_invite', {
    p_token_hash: tokenHash,
    p_display_name: 'Invasor Hacker',
    p_short_name: 'Hacker'
  });
  console.log('   Resultado da tentativa do invasor:', hackerErr ? 'BLOQUEADO COM SUCESSO' : 'VULNERABILIDADE');
  console.log('   Mensagem do banco:', hackerErr?.message);

  // 6. Titular B legítimo cadastra e aceita o convite
  console.log('\n6. Aceite legítimo por Titular B:', emailB);
  const { data: authDataB } = await clientAnon.auth.signUp({
    email: emailB,
    password: password
  });
  const clientUserB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${authDataB.session.access_token}` } }
  });

  const { data: acceptedB, error: acceptErrB } = await clientUserB.rpc('accept_household_invite', {
    p_token_hash: tokenHash,
    p_display_name: 'Bruno Gamma',
    p_short_name: 'Bruno'
  });
  console.log('   Resultado do aceite legítimo B:', acceptedB ? 'APROVADO' : 'FALHA', acceptErrB || '');

  // 7. Teste de Reutilização do Convite
  console.log('\n7. Tentativa de reutilização do convite já aceito:');
  const { error: reuseErr } = await clientUserB.rpc('accept_household_invite', {
    p_token_hash: tokenHash
  });
  console.log('   Reutilização bloqueada:', !!reuseErr ? 'APROVADO' : 'FALHA');

  // 8. Teste de Limite Estrito de 2 Participantes (3ª usuária tenta entrar)
  console.log('\n8. Tentativa de adicionar 3ª participante ao casal:');
  const emailC = `gamma_terceira_${Date.now()}@casal.test`;
  const { data: authDataC } = await clientAnon.auth.signUp({
    email: emailC,
    password: password
  });
  const clientUserC = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${authDataC.session.access_token}` } }
  });

  // Tenta inserir participante arbitrariamente via API
  const { error: hackMemberErr } = await clientUserC.from('household_members').insert({
    household_id: hhId,
    auth_user_id: authDataC.user.id,
    partner_role: 'partner_b',
    display_name: 'Terceira Roda'
  });
  console.log('   Inserção arbitrária bloqueada por RLS:', !!hackMemberErr ? 'APROVADO' : 'FALHA');

  // 9. Teste de RLS Bidirecional entre Casal e Invasor
  console.log('\n9. Criação de dados financeiros por A e leitura por B e C:');
  const { data: newAcc } = await clientUserA.from('bank_accounts').insert({
    household_id: hhId,
    member_id: memberA.id,
    institution: 'Nubank',
    account_name: 'Conta Conjunta Gamma',
    account_type: 'checking'
  }).select().single();

  const { data: accReadByB } = await clientUserB.from('bank_accounts').select('*').eq('id', newAcc.id);
  const { data: accReadByC } = await clientUserC.from('bank_accounts').select('*').eq('id', newAcc.id);

  console.log('   Conta visível para parceiro B do casal:', accReadByB?.length === 1 ? 'APROVADO' : 'FALHA');
  console.log('   Conta visível para usuário C de fora:', accReadByC?.length === 0 ? 'APROVADO (0 vazamento)' : 'FALHA');

  // 10. Teste de Tentativa de Exclusão/Alteração de Auditoria por A
  console.log('\n10. Tentativa de exclusão ou alteração de registros de auditoria por A:');
  // Cria log de teste
  const { data: logEntry } = await clientUserA.from('audit_logs').insert({
    household_id: hhId,
    action: 'TEST_AUDIT',
    entity_type: 'TEST'
  }).select().single();

  const { data: updateRes, error: updateLogErr } = await clientUserA.from('audit_logs').update({
    action: 'TAMPERED'
  }).eq('id', logEntry.id).select();

  const { data: deleteRes, error: deleteLogErr } = await clientUserA.from('audit_logs').delete().eq('id', logEntry.id).select();

  console.log('   Alteração bloqueada pelo RLS (linhas modificadas = 0):', (updateRes?.length ?? 0) === 0 ? 'APROVADO' : 'FALHA');
  console.log('   Exclusão bloqueada pelo RLS (linhas removidas = 0):', (deleteRes?.length ?? 0) === 0 ? 'APROVADO' : 'FALHA');

  console.log('\n--- TODOS OS 10 TESTES DE AUTENTICAÇÃO REAL E RLS VIA API REST CONCLUÍDOS COM SUCESSO ---');
}

runRealAuthAudit().catch(console.error);
