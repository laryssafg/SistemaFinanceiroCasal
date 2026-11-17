import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Info,
  Lock,
  Mail,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { Modal } from '../ui/Modal';

export function AuthModal() {
  const {
    user,
    household,
    memberProfile,
    partnerProfile,
    isAuthenticated,
    isAuthModalOpen,
    setIsAuthModalOpen,
    authModalMode,
    setAuthModalMode,
    signIn,
    signUp,
    signOut,
    resetPassword,
    acceptInvite,
    createInvite,
    authError,
    clearError,
    isLoading,
  } = useAuth();

  const { isAuthDemoOpen, setIsAuthDemoOpen } = useFinance();

  // O modal abre se isAuthModalOpen ou isAuthDemoOpen for verdadeiro
  const isOpen = isAuthModalOpen || isAuthDemoOpen;

  const handleClose = () => {
    setIsAuthModalOpen(false);
    setIsAuthDemoOpen(false);
    clearError();
    setSuccessMsg(null);
    setInviteTokenResult(null);
  };

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [shortName, setShortName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [inviteTokenResult, setInviteTokenResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Manipulador de Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg(null);
    const res = await signIn(email, password);
    if (res.success) {
      setPassword('');
      handleClose();
    }
  };

  // Manipulador de Cadastro
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg(null);
    const res = await signUp({
      email,
      password,
      displayName: displayName || email.split('@')[0],
      shortName: shortName || displayName || email.split('@')[0],
      householdName: householdName || 'Nosso Casal',
    });

    if (res.success) {
      setPassword('');
      if (res.error) {
        setSuccessMsg(res.error);
      } else {
        setSuccessMsg('Conta e núcleo criados com sucesso!');
        setTimeout(() => handleClose(), 1500);
      }
    }
  };

  // Manipulador de Recuperação
  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg(null);
    const res = await resetPassword(email);
    if (res.success) {
      setSuccessMsg('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    }
  };

  // Manipulador de Aceite de Convite
  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg(null);
    const res = await acceptInvite({
      token: inviteToken,
      displayName: displayName || user?.email?.split('@')[0] || 'Parceiro(a)',
      shortName: shortName || displayName || user?.email?.split('@')[0] || 'Parceiro(a)',
    });

    if (res.success) {
      setSuccessMsg('Convite aceito! Você agora faz parte do núcleo financeiro.');
      setInviteToken('');
      setTimeout(() => handleClose(), 1500);
    }
  };

  // Manipulador de Criação de Convite
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg(null);
    const res = await createInvite(inviteeEmail);
    if (res.success && res.token) {
      setInviteTokenResult(res.token);
      setSuccessMsg('Convite gerado com sucesso! Compartilhe o código abaixo com seu parceiro(a).');
      setInviteeEmail('');
    }
  };

  const handleCopyToken = () => {
    if (inviteTokenResult) {
      navigator.clipboard.writeText(inviteTokenResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={
        isAuthenticated
          ? 'Gerenciamento de Conta e Casal'
          : authModalMode === 'login'
            ? 'Acesso ao Sistema'
            : authModalMode === 'signup'
              ? 'Criar Conta do Casal'
              : authModalMode === 'invite'
                ? 'Aceitar Convite de Parceiro(a)'
                : 'Recuperação de Acesso'
      }
      subtitle={
        isAuthenticated
          ? `Conectada como ${user?.email}`
          : 'Autenticação segura via Supabase Auth & RLS'
      }
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        {/* Banner de status / mensagem de sucesso */}
        {successMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <p>{successMsg}</p>
          </div>
        )}

        {/* Banner de erro de autenticação */}
        {authError && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-900 dark:text-red-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <p>{authError}</p>
          </div>
        )}

        {/* ESTADO 1: USUÁRIA JÁ AUTENTICADA */}
        {isAuthenticated ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Núcleo Familiar:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {household?.display_name ?? 'Núcleo Ativo'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Sua Participação:</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {memberProfile?.display_name ?? user?.email} (
                  {memberProfile?.partner_role === 'partner_a' ? 'Titular 1' : 'Titular 2'})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Segunda Participante:</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {partnerProfile
                    ? `${partnerProfile.display_name} (Conectada)`
                    : 'Aguardando parceiro(a)'}
                </span>
              </div>
            </div>

            {/* Se ainda não tem parceiro vinculado, permite gerar convite */}
            {!partnerProfile && (
              <div className="p-3.5 rounded-lg border border-dashed border-navy-300 dark:border-navy-700 bg-navy-50/50 dark:bg-navy-950/30 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-navy-950 dark:text-navy-100">
                  <UserPlus className="w-4 h-4 text-navy-700 dark:text-navy-300" />
                  <span>Convidar Parceiro(a) para o Casal</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Gere um código de uso único e temporário (válido por 7 dias) para que a segunda
                  pessoa conecte-se com segurança ao seu núcleo financeiro.
                </p>

                <form onSubmit={handleCreateInvite} className="space-y-2">
                  <input
                    required
                    type="email"
                    value={inviteeEmail}
                    onChange={(e) => setInviteeEmail(e.target.value)}
                    placeholder="email.parceiro@dominio.com"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2 px-3 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Gerar Código de Convite
                  </button>
                </form>

                {inviteTokenResult && (
                  <div className="pt-2 border-t border-navy-200/60 dark:border-navy-800/60 space-y-1.5">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Código de Convite Único:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={inviteTokenResult}
                        className="flex-1 font-mono text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded select-all"
                      />
                      <button
                        type="button"
                        onClick={handleCopyToken}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Se já estiver logada mas ainda não tiver núcleo nem convite aceito */}
            {!household && (
              <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/40 space-y-2 text-xs text-amber-900 dark:text-amber-200">
                <p className="font-semibold">Vínculo a um Núcleo Pendente</p>
                <p>
                  Sua conta está criada, mas ainda não está associada a um núcleo familiar. Se você
                  recebeu um código de convite de seu parceiro(a), insira-o abaixo:
                </p>
                <form onSubmit={handleAcceptInvite} className="space-y-2 pt-2">
                  <input
                    required
                    type="text"
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder="Cole aqui o código de convite recebido"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg font-mono"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Seu nome"
                      className="px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg"
                    />
                    <input
                      type="text"
                      value={shortName}
                      onChange={(e) => setShortName(e.target.value)}
                      placeholder="Apelido / curto"
                      className="px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2 px-3 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-lg transition-colors"
                  >
                    Vincular-se ao Casal
                  </button>
                </form>
              </div>
            )}

            <button
              type="button"
              onClick={async () => {
                await signOut();
                handleClose();
              }}
              className="w-full py-2.5 px-4 text-xs font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
            >
              Encerrar Sessão (Logout)
            </button>
          </div>
        ) : (
          /* ESTADO 2: NÃO AUTENTICADA (TABS: LOGIN, CADASTRO, RECUPERAÇÃO, CONVITE) */
          <>
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-navy-50/70 dark:bg-navy-950/60 border border-navy-200/70 dark:border-navy-900 text-[11px] text-navy-900 dark:text-navy-200">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Sessão segura vinculada ao isolamento multitenant. Cada casal acessa apenas seus
                próprios registros protegidos por Row Level Security no PostgreSQL.
              </p>
            </div>

            {/* MODO LOGIN */}
            {authModalMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    E-mail
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@dominio.com"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Senha
                  </label>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isLoading ? 'Entrando...' : 'Entrar no Sistema'}
                </button>
              </form>
            )}

            {/* MODO CADASTRO (NOVO CASAL) */}
            {authModalMode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nome do Casal / Núcleo
                  </label>
                  <input
                    required
                    type="text"
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                    placeholder="Ex: Larissa & Rodrigo"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Seu Nome
                    </label>
                    <input
                      required
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Como quer ser chamada(o)
                    </label>
                    <input
                      required
                      type="text"
                      value={shortName}
                      onChange={(e) => setShortName(e.target.value)}
                      placeholder="Apelido / Curto"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    E-mail
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@dominio.com"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Senha (mínimo 6 dígitos)
                  </label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  {isLoading ? 'Criando Conta...' : 'Criar Conta e Iniciar Núcleo'}
                </button>
              </form>
            )}

            {/* MODO RECUPERAÇÃO */}
            {authModalMode === 'recovery' && (
              <form onSubmit={handleRecovery} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    E-mail cadastrado
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@dominio.com"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {isLoading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                </button>
              </form>
            )}

            {/* MODO CONVITE (PARA QUEM NÃO ESTÁ LOGADO) */}
            {authModalMode === 'invite' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 space-y-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    Como funciona o convite:
                  </p>
                  <p>
                    1. Faça login ou crie sua conta individual com seu e-mail e senha.
                  </p>
                  <p>
                    2. Após entrar, cole o código do convite fornecido pelo seu parceiro(a) para
                    vincular-se ao mesmo casal.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('login');
                      clearError();
                    }}
                    className="flex-1 py-2 px-3 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 rounded-lg transition-colors text-center"
                  >
                    Fazer Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('signup');
                      clearError();
                    }}
                    className="flex-1 py-2 px-3 text-xs font-medium text-navy-950 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-center"
                  >
                    Criar Nova Conta
                  </button>
                </div>
              </div>
            )}

            {/* RODAPÉ DE NAVEGAÇÃO ENTRE MODOS */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              {authModalMode === 'login' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('signup');
                      clearError();
                      setSuccessMsg(null);
                    }}
                    className="text-navy-700 dark:text-navy-300 hover:underline font-medium"
                  >
                    Criar nova conta de casal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('recovery');
                      clearError();
                      setSuccessMsg(null);
                    }}
                    className="text-slate-500 dark:text-slate-400 hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode('login');
                    clearError();
                    setSuccessMsg(null);
                  }}
                  className="inline-flex items-center gap-1 text-navy-700 dark:text-navy-300 hover:underline font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar para o Login
                </button>
              )}

              <button
                type="button"
                onClick={handleClose}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 ml-auto"
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
