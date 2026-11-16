import React, { useState } from 'react';
import { ArrowLeft, Info, Lock } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Modal } from '../ui/Modal';

export function AuthDemoModal() {
  const { isAuthDemoOpen, setIsAuthDemoOpen } = useFinance();
  const [mode, setMode] = useState<'login' | 'recovery'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleClose = () => {
    setIsAuthDemoOpen(false);
    setFeedback(null);
    setPassword('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      setFeedback(
        'Prévia de desenvolvimento: a autenticação real de usuárias será conectada ao Supabase Auth na próxima etapa. Nenhuma sessão autenticada foi criada.',
      );
    } else {
      setFeedback(
        'Prévia de desenvolvimento: o envio real de e-mail para recuperação de acesso será configurado via Supabase Auth.',
      );
    }
    setPassword('');
  };

  return (
    <Modal
      open={isAuthDemoOpen}
      onClose={handleClose}
      title={mode === 'login' ? 'Acesso ao Sistema' : 'Recuperação de Acesso'}
      subtitle="Prévia de desenvolvimento · Integração futura com Supabase Auth"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-navy-50/70 dark:bg-navy-950/60 border border-navy-200/70 dark:border-navy-900 text-[11px] text-navy-900 dark:text-navy-200">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Interface de autenticação preparada para o backend. Nenhuma credencial simulada existe no sistema e nenhuma senha é armazenada localmente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
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

          {mode === 'login' && (
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
          )}

          {feedback && (
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200">
              {feedback}
            </div>
          )}

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            {mode === 'login' ? 'Entrar (Aguardando Supabase)' : 'Solicitar Recuperação'}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          {mode === 'login' ? (
            <button
              type="button"
              onClick={() => {
                setMode('recovery');
                setFeedback(null);
              }}
              className="text-navy-700 dark:text-navy-300 hover:underline font-medium"
            >
              Esqueci minha senha / Recuperar acesso
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setFeedback(null);
              }}
              className="inline-flex items-center gap-1 text-navy-700 dark:text-navy-300 hover:underline font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para Login
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}
