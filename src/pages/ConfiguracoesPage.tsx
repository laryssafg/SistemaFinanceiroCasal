import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  DatabaseBackup,
  KeyRound,
  Lock,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { PartnerAvatar } from '../components/ui/FeedbackStates';
import { Modal } from '../components/ui/Modal';
import {
  PageHeader,
  SurfaceCard,
} from '../components/ui/SurfaceCard';
import { useFinance } from '../context/FinanceContext';
import { getCurrentReferenceMonthLabel } from '../data/mockData';
import { PartnerId } from '../types/finance';

export function ConfiguracoesPage() {
  const {
    partners,
    upsertPartnerProfile,
    financialSettings,
    updateFinancialSettings,
    monthClosed,
    setMonthClosed,
    appendAuditLog,
    setIsAuthDemoOpen,
    showToast,
    theme,
    toggleTheme,
  } = useFinance();

  const referenceMonthLabel = getCurrentReferenceMonthLabel();
  const partnerA = partners.find((p) => p.id === 'partner_a');
  const partnerB = partners.find((p) => p.id === 'partner_b');

  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupActionMode, setBackupActionMode] = useState<'backup' | 'restore'>('backup');

  const [partnerAName, setPartnerAName] = useState(partnerA?.name ?? '');
  const [partnerAEmail, setPartnerAEmail] = useState(partnerA?.email ?? '');
  const [partnerAPhoto, setPartnerAPhoto] = useState<string | undefined>(partnerA?.photoDataUrl);
  const [partnerBName, setPartnerBName] = useState(partnerB?.name ?? '');
  const [partnerBEmail, setPartnerBEmail] = useState(partnerB?.email ?? '');
  const [partnerBPhoto, setPartnerBPhoto] = useState<string | undefined>(partnerB?.photoDataUrl);

  const partnerAFileRef = useRef<HTMLInputElement | null>(null);
  const partnerBFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPartnerAName(partnerA?.name ?? '');
    setPartnerAEmail(partnerA?.email ?? '');
    setPartnerAPhoto(partnerA?.photoDataUrl);
  }, [partnerA?.name, partnerA?.email, partnerA?.photoDataUrl]);

  useEffect(() => {
    setPartnerBName(partnerB?.name ?? '');
    setPartnerBEmail(partnerB?.email ?? '');
    setPartnerBPhoto(partnerB?.photoDataUrl);
  }, [partnerB?.name, partnerB?.email, partnerB?.photoDataUrl]);

  const [defaultClosingDay, setDefaultClosingDay] = useState(
    String(financialSettings.defaultClosingDay),
  );
  const [autoMonthlyReset, setAutoMonthlyReset] = useState(financialSettings.autoMonthlyReset);
  const [requireTransferForSettlement, setRequireTransferForSettlement] = useState(
    financialSettings.requireTransferForSettlement,
  );

  useEffect(() => {
    setDefaultClosingDay(String(financialSettings.defaultClosingDay));
    setAutoMonthlyReset(financialSettings.autoMonthlyReset);
    setRequireTransferForSettlement(financialSettings.requireTransferForSettlement);
  }, [
    financialSettings.defaultClosingDay,
    financialSettings.autoMonthlyReset,
    financialSettings.requireTransferForSettlement,
  ]);

  const hasUnsavedProfiles =
    partnerAName.trim() !== (partnerA?.name ?? '').trim() ||
    partnerAEmail.trim() !== (partnerA?.email ?? '').trim() ||
    partnerAPhoto !== partnerA?.photoDataUrl ||
    partnerBName.trim() !== (partnerB?.name ?? '').trim() ||
    partnerBEmail.trim() !== (partnerB?.email ?? '').trim() ||
    partnerBPhoto !== partnerB?.photoDataUrl;

  const parsedClosingDay = Number(defaultClosingDay);
  const hasUnsavedFinancialSettings =
    parsedClosingDay !== financialSettings.defaultClosingDay ||
    autoMonthlyReset !== financialSettings.autoMonthlyReset ||
    requireTransferForSettlement !== financialSettings.requireTransferForSettlement;

  const handlePhotoUpload = (
    id: PartnerId,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Selecione um arquivo de imagem válido (PNG, JPG ou WebP).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showToast('A imagem deve ter no máximo 3 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : undefined;
      if (!result) return;
      if (id === 'partner_a') {
        setPartnerAPhoto(result);
        upsertPartnerProfile(
          'partner_a',
          {
            name: partnerAName,
            email: partnerAEmail,
            roleLabel: 'Titular 1',
            photoDataUrl: result,
          },
          { toastMessage: 'Foto da Titular 1 salva.' },
        );
      } else {
        setPartnerBPhoto(result);
        upsertPartnerProfile(
          'partner_b',
          {
            name: partnerBName,
            email: partnerBEmail,
            roleLabel: 'Titular 2',
            photoDataUrl: result,
          },
          { toastMessage: 'Foto da Titular 2 salva.' },
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (id: PartnerId) => {
    if (id === 'partner_a') {
      setPartnerAPhoto(undefined);
      upsertPartnerProfile(
        'partner_a',
        {
          name: partnerAName,
          email: partnerAEmail,
          roleLabel: 'Titular 1',
          photoDataUrl: undefined,
        },
        { toastMessage: 'Foto da Titular 1 removida.' },
      );
    } else {
      setPartnerBPhoto(undefined);
      upsertPartnerProfile(
        'partner_b',
        {
          name: partnerBName,
          email: partnerBEmail,
          roleLabel: 'Titular 2',
          photoDataUrl: undefined,
        },
        { toastMessage: 'Foto da Titular 2 removida.' },
      );
    }
  };

  const handleSaveProfiles = (e: React.FormEvent) => {
    e.preventDefault();
    const shouldSaveA = Boolean(
      partnerA || partnerAName.trim() || partnerAEmail.trim() || partnerAPhoto,
    );
    const shouldSaveB = Boolean(
      partnerB || partnerBName.trim() || partnerBEmail.trim() || partnerBPhoto,
    );

    if (!shouldSaveA && !shouldSaveB) {
      showToast('Preencha ao menos um perfil para salvar.');
      return;
    }

    if (shouldSaveA) {
      upsertPartnerProfile(
        'partner_a',
        {
          name: partnerAName,
          email: partnerAEmail,
          roleLabel: 'Titular 1',
          photoDataUrl: partnerAPhoto,
        },
        { silent: true },
      );
    }
    if (shouldSaveB) {
      upsertPartnerProfile(
        'partner_b',
        {
          name: partnerBName,
          email: partnerBEmail,
          roleLabel: 'Titular 2',
          photoDataUrl: partnerBPhoto,
        },
        { silent: true },
      );
    }

    appendAuditLog({
      actorId: 'system',
      action: 'Perfis das titulares salvos',
      module: 'Configurações',
      details: 'Dados dos perfis das titulares atualizados e salvos.',
      ipOrOrigin: 'Prévia Web',
    });
    showToast('Perfis das titulares salvos com sucesso.');
  };

  const handleSaveFinancialSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const day = Number(defaultClosingDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      showToast('Informe um dia de fechamento válido entre 1 e 31.');
      return;
    }
    updateFinancialSettings({
      defaultClosingDay: day,
      autoMonthlyReset,
      requireTransferForSettlement,
    });
  };

  const handleMonthToggleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (monthClosed) {
      if (!reopenReason.trim()) return;
      setMonthClosed(false);
      appendAuditLog({
        actorId: 'system',
        action: `Reabertura controlada de ${referenceMonthLabel}`,
        module: 'Configurações',
        details: `Motivo informado: ${reopenReason.trim()}`,
        ipOrOrigin: 'Prévia Web',
      });
      showToast('Competência reaberta com registro de auditoria.');
    } else {
      setMonthClosed(true);
      appendAuditLog({
        actorId: 'system',
        action: `Fechamento mensal de ${referenceMonthLabel}`,
        module: 'Configurações',
        details: 'Percentuais proporcionais consolidados e lançamentos bloqueados para edição.',
        ipOrOrigin: 'Prévia Web',
      });
      showToast('Fechamento mensal concluído na prévia.');
    }
    setReopenReason('');
    setIsClosingModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações, Segurança e Governança"
        subtitle="Perfis das duas titulares, regras financeiras, fechamento mensal, reabertura controlada, backup manual e visualização de autenticação"
        actions={
          <button
            type="button"
            onClick={() => setIsAuthDemoOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Tela de Autenticação (Prévia)
          </button>
        }
      />

      <SurfaceCard>
        <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50 mb-1">
          Perfil das Duas Titulares
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Cadastre os perfis e fotos locais nesta prévia de desenvolvimento — na integração com Supabase serão vinculados ao Supabase Auth e Storage
        </p>

        <form onSubmit={handleSaveProfiles} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <PartnerAvatar src={partnerAPhoto} name={partnerAName} size="lg" />
                  <div>
                    <p className="text-sm font-semibold text-navy-950 dark:text-white">
                      {partnerA?.roleLabel ?? 'Titular 1'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {partnerA?.name
                        ? 'Perfil configurado na prévia'
                        : 'Perfil ainda não configurado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={partnerAFileRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload('partner_a', e)}
                    className="hidden"
                    aria-label="Selecionar foto da Titular 1"
                  />
                  <button
                    type="button"
                    onClick={() => partnerAFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-navy-900 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {partnerAPhoto ? 'Alterar foto' : 'Adicionar foto'}
                  </button>
                  {partnerAPhoto && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto('partner_a')}
                      aria-label="Remover foto da Titular 1"
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Informe o nome da titular 1"
                  value={partnerAName}
                  onChange={(e) => setPartnerAName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  E-mail de Acesso
                </label>
                <input
                  type="email"
                  placeholder="nome@dominio.com"
                  value={partnerAEmail}
                  onChange={(e) => setPartnerAEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <PartnerAvatar src={partnerBPhoto} name={partnerBName} size="lg" />
                  <div>
                    <p className="text-sm font-semibold text-navy-950 dark:text-white">
                      {partnerB?.roleLabel ?? 'Titular 2'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {partnerB?.name
                        ? 'Perfil configurado na prévia'
                        : 'Perfil ainda não configurado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={partnerBFileRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload('partner_b', e)}
                    className="hidden"
                    aria-label="Selecionar foto da Titular 2"
                  />
                  <button
                    type="button"
                    onClick={() => partnerBFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-navy-900 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {partnerBPhoto ? 'Alterar foto' : 'Adicionar foto'}
                  </button>
                  {partnerBPhoto && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto('partner_b')}
                      aria-label="Remover foto da Titular 2"
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Informe o nome da titular 2"
                  value={partnerBName}
                  onChange={(e) => setPartnerBName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  E-mail de Acesso
                </label>
                <input
                  type="email"
                  placeholder="nome@dominio.com"
                  value={partnerBEmail}
                  onChange={(e) => setPartnerBEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {hasUnsavedProfiles
                ? 'Existem alterações nos perfis aguardando salvamento.'
                : 'Perfis sincronizados nesta sessão.'}
            </span>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors"
            >
              Salvar Perfis
            </button>
          </div>
        </form>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SurfaceCard className="flex flex-col justify-between space-y-4">
          <form onSubmit={handleSaveFinancialSettings} className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
                Configurações Financeiras e Aparência
              </h2>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Tema da Interface
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Alternar entre tema claro e escuro
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="px-3 py-1.5 font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {theme === 'light' ? 'Ativar Tema Escuro' : 'Ativar Tema Claro'}
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Dia padrão de fechamento mensal
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Referência para consolidação dos percentuais proporcionais
                    </p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={defaultClosingDay}
                    onChange={(e) => setDefaultClosingDay(e.target.value)}
                    className="w-16 px-2.5 py-1.5 text-center font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <label className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 cursor-pointer">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Reinício mensal do orçamento sem acúmulo
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Não transportar sobras de categorias para o mês seguinte
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoMonthlyReset}
                    onChange={(e) => setAutoMonthlyReset(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                </label>

                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Exigir transferência vinculada em acertos
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Impede liquidação manual sem movimentação bancária
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={requireTransferForSettlement}
                    onChange={(e) => setRequireTransferForSettlement(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {hasUnsavedFinancialSettings
                  ? 'Alterações pendentes de salvamento.'
                  : 'Configurações salvas.'}
              </span>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-lg transition-colors"
              >
                Salvar Configurações
              </button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-navy-950 dark:text-slate-50">
              Fechamento Mensal e Backup Manual
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Controles de integridade de competência e recuperação de dados
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-navy-950 dark:text-slate-100">
                {monthClosed ? (
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
                <span>
                  {referenceMonthLabel}: {monthClosed ? 'Fechada' : 'Aberta (Provisória)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {monthClosed
                  ? 'Percentuais travados. Alterações exigem reabertura controlada com justificativa.'
                  : 'Encerre a competência após confirmar receitas e acertos do mês.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsClosingModalOpen(true)}
              className="px-3.5 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 rounded-lg whitespace-nowrap shrink-0"
            >
              {monthClosed ? 'Reabrir Competência' : 'Fechar Mês'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setBackupActionMode('backup');
                setIsBackupModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-navy-950 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <DatabaseBackup className="w-4 h-4" />
              Backup Manual (Snapshot)
            </button>
            <button
              type="button"
              onClick={() => {
                setBackupActionMode('restore');
                setIsBackupModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-navy-950 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Restaurar Backup
            </button>
          </div>
        </SurfaceCard>
      </div>

      <Modal
        open={isClosingModalOpen}
        onClose={() => setIsClosingModalOpen(false)}
        title={monthClosed ? 'Reabertura Controlada de Competência' : 'Confirmar Fechamento Mensal'}
        subtitle={referenceMonthLabel}
      >
        <form onSubmit={handleMonthToggleConfirm} className="space-y-4 text-xs">
          {monthClosed ? (
            <>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                A reabertura controlada será gravada na trilha de auditoria. Responsabilidades já liquidadas permanecem preservadas.
              </p>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Motivo Obrigatório da Reabertura
                </label>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Informe por que a competência precisa ser reaberta..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </>
          ) : (
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Ao confirmar o fechamento de <strong>{referenceMonthLabel}</strong>, os percentuais proporcionais passam de provisórios para consolidados e novas edições exigirão reabertura controlada.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsClosingModalOpen(false)}
              className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 rounded-lg"
            >
              {monthClosed && <RotateCcw className="w-3.5 h-3.5" />}
              {monthClosed ? 'Confirmar Reabertura' : 'Confirmar Fechamento'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        title={backupActionMode === 'backup' ? 'Backup Manual (Snapshot)' : 'Restauração de Backup'}
        subtitle="Prévia de interface — persistência definitiva será conectada ao Supabase"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {backupActionMode === 'backup'
              ? 'Na versão conectada ao banco de dados, esta ação gera um snapshot criptografado de todas as tabelas do casal (contas, movimentações, cartões, benefícios, divisão e auditoria).'
              : 'Na versão conectada ao backend, permite selecionar um arquivo de backup validado e restaurar o estado completo com registro automático em auditoria.'}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsBackupModalOpen(false)}
              className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => {
                appendAuditLog({
                  actorId: 'system',
                  action:
                    backupActionMode === 'backup'
                      ? 'Verificação de fluxo de backup manual'
                      : 'Verificação de fluxo de restauração',
                  module: 'Configurações',
                  details: 'Interface verificada sem gravação externa nesta etapa.',
                  ipOrOrigin: 'Prévia Web',
                });
                showToast(
                  backupActionMode === 'backup'
                    ? 'Fluxo de backup verificado e registrado.'
                    : 'Interface de restauração verificada.',
                );
                setIsBackupModalOpen(false);
              }}
              className="px-4 py-2 font-medium text-white bg-navy-900 hover:bg-navy-800 dark:bg-navy-600 rounded-lg"
            >
              Registrar Verificação no Log
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
