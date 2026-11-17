import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { accountService, transactionService, creditCardService, benefitService, fromCents, toCents } from '../services/financeDataService';
import {
  INITIAL_ALERTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_BENEFIT_CARDS,
  INITIAL_BUDGET_CATEGORIES,
  INITIAL_CREDIT_CARDS,
  INITIAL_CREDIT_CARD_INSTALLMENTS,
  INITIAL_DEBTS,
  INITIAL_EMERGENCY_MOVEMENTS,
  INITIAL_EMERGENCY_RESERVE_CONFIG,
  INITIAL_GOALS,
  INITIAL_INVESTMENTS,
  INITIAL_MONTHLY_SERIES,
  INITIAL_PARTNERS,
  INITIAL_PROPORTIONAL_HISTORY,
  INITIAL_SETTLEMENTS,
  INITIAL_SHARED_RESPONSIBILITIES,
  INITIAL_TRANSACTIONS,
} from '../data/mockData';
import { computeDashboardSummary, DashboardSummary } from '../services/financeService';
import {
  AuditLogEntry,
  BankAccount,
  BenefitCard,
  BenefitMovement,
  BudgetCategory,
  CoupleSettlement,
  CreditCard,
  CreditCardInstallment,
  DebtItem,
  EmergencyReserveConfig,
  EmergencyReserveMovement,
  FinancialGoal,
  FinancialSettings,
  InvestmentAsset,
  MonthlySeriesPoint,
  NavSectionId,
  PartnerId,
  PartnerProfile,
  ProportionalMonthHistory,
  SharedResponsibilityItem,
  SystemAlert,
  Transaction,
} from '../types/finance';

export type ThemeMode = 'light' | 'dark';

const CONFIG_STORAGE_KEY = 'sfc_preview_config_v1';

const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  defaultClosingDay: 30,
  autoMonthlyReset: true,
  requireTransferForSettlement: true,
};

interface StoredPreviewConfig {
  theme?: ThemeMode;
  partners?: PartnerProfile[];
  financialSettings?: FinancialSettings;
  monthClosed?: boolean;
}

function loadStoredConfig(): StoredPreviewConfig {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const obj = parsed as Record<string, unknown>;

    const theme: ThemeMode | undefined =
      obj.theme === 'dark' || obj.theme === 'light' ? obj.theme : undefined;

    const partners: PartnerProfile[] | undefined = Array.isArray(obj.partners)
      ? obj.partners.filter(
          (item): item is PartnerProfile =>
            Boolean(item) &&
            typeof item === 'object' &&
            ((item as PartnerProfile).id === 'partner_a' ||
              (item as PartnerProfile).id === 'partner_b'),
        )
      : undefined;

    let financialSettings: FinancialSettings | undefined;
    if (obj.financialSettings && typeof obj.financialSettings === 'object') {
      const fsObj = obj.financialSettings as Record<string, unknown>;
      const day = Number(fsObj.defaultClosingDay);
      financialSettings = {
        defaultClosingDay:
          Number.isFinite(day) && day >= 1 && day <= 31
            ? Math.round(day)
            : DEFAULT_FINANCIAL_SETTINGS.defaultClosingDay,
        autoMonthlyReset:
          typeof fsObj.autoMonthlyReset === 'boolean'
            ? fsObj.autoMonthlyReset
            : DEFAULT_FINANCIAL_SETTINGS.autoMonthlyReset,
        requireTransferForSettlement:
          typeof fsObj.requireTransferForSettlement === 'boolean'
            ? fsObj.requireTransferForSettlement
            : DEFAULT_FINANCIAL_SETTINGS.requireTransferForSettlement,
      };
    }

    const monthClosed = typeof obj.monthClosed === 'boolean' ? obj.monthClosed : undefined;

    return { theme, partners, financialSettings, monthClosed };
  } catch {
    return {};
  }
}

interface FinanceContextValue {
  activePage: NavSectionId;
  setActivePage: (page: NavSectionId) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  partners: PartnerProfile[];
  upsertPartnerProfile: (
    id: PartnerId,
    data: { name: string; email: string; roleLabel?: string; photoDataUrl?: string },
    options?: { silent?: boolean; toastMessage?: string },
  ) => void;
  financialSettings: FinancialSettings;
  updateFinancialSettings: (next: FinancialSettings) => void;
  isDataLoading: boolean;
  refreshFinancialData: () => Promise<void>;
  isLiveDatabase: boolean;
  executeTransfer: (params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    date?: string;
    notes?: string;
  }) => Promise<void>;
  accounts: BankAccount[];
  addBankAccount: (account: Omit<BankAccount, 'id' | 'lastUpdated'>) => void;
  transactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  benefits: BenefitCard[];
  benefitMovements: BenefitMovement[];
  addBenefitCard: (benefit: Omit<BenefitCard, 'id' | 'lastCreditDate'>) => Promise<void>;
  registerBenefitCredit: (params: {
    benefitId: string;
    amount: number;
    description?: string;
  }) => Promise<void>;
  registerBenefitPurchase: (params: {
    benefitId: string;
    description: string;
    category: string;
    amount: number;
    scope: 'individual' | 'shared';
  }) => Promise<void>;
  reverseBenefitMovement: (movementId: string, reason?: string) => Promise<void>;
  cards: CreditCard[];
  addCreditCard: (card: Omit<CreditCard, 'id'>) => Promise<void>;
  updateCreditCard: (cardId: string, updates: Partial<CreditCard>) => Promise<void>;
  installments: CreditCardInstallment[];
  payCardInvoice: (cardId: string, accountId: string, amount: number) => Promise<void>;
  budgets: BudgetCategory[];
  addBudgetCategory: (budget: Omit<BudgetCategory, 'id'>) => void;
  updateBudgetLimit: (id: string, newLimit: number) => void;
  proportionalHistory: ProportionalMonthHistory[];
  sharedResponsibilities: SharedResponsibilityItem[];
  settlements: CoupleSettlement[];
  settleCoupleBalance: (settlementId: string, accountId?: string) => void;
  emergencyConfig: EmergencyReserveConfig;
  configureEmergencyReserve: (params: {
    essentialMonthlyBaseline: number;
    targetMonths: number;
    monthlyPlannedDeposit: number;
  }) => void;
  emergencyMovements: EmergencyReserveMovement[];
  addEmergencyMovement: (mov: Omit<EmergencyReserveMovement, 'id'>) => void;
  investments: InvestmentAsset[];
  addInvestment: (inv: Omit<InvestmentAsset, 'id'>) => void;
  goals: FinancialGoal[];
  addGoal: (goal: Omit<FinancialGoal, 'id'>) => void;
  debts: DebtItem[];
  addDebt: (debt: Omit<DebtItem, 'id'>) => void;
  alerts: SystemAlert[];
  markAlertRead: (id: string) => void;
  auditLogs: AuditLogEntry[];
  appendAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
  monthlySeries: MonthlySeriesPoint[];
  summary: DashboardSummary;
  monthClosed: boolean;
  setMonthClosed: (closed: boolean) => void;
  isAuthDemoOpen: boolean;
  setIsAuthDemoOpen: (open: boolean) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function getTodayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function getNowDateTimeIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())}`;
}

const ACTIVE_PAGE_STORAGE_KEY = 'sfc_active_page_v1';

function getInitialActivePage(): NavSectionId {
  if (typeof window === 'undefined') return 'dashboard';
  try {
    const saved = window.sessionStorage.getItem(ACTIVE_PAGE_STORAGE_KEY) as NavSectionId | null;
    const validSections: NavSectionId[] = [
      'dashboard',
      'movimentacoes',
      'contas',
      'cartoes',
      'beneficios',
      'orcamento',
      'divisao',
      'acertos',
      'reserva',
      'investimentos',
      'metas',
      'dividas',
      'relatorios',
      'alertas',
      'auditoria',
      'configuracoes',
    ];
    if (saved && validSections.includes(saved)) {
      return saved;
    }
  } catch {
    // fallback seguro
  }
  return 'dashboard';
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, household, memberProfile, partnerProfile } = useAuth();
  const [initialConfig] = useState<StoredPreviewConfig>(() => loadStoredConfig());
  const [activePage, setActivePageState] = useState<NavSectionId>(() => getInitialActivePage());

  const setActivePage = useCallback((page: NavSectionId) => {
    setActivePageState(page);
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, page);
      }
    } catch {
      // ignora restrições do storage
    }
  }, []);
  const [theme, setTheme] = useState<ThemeMode>(initialConfig.theme ?? 'light');
  const partnersFromAuth = useMemo<PartnerProfile[]>(() => {
    if (!isAuthenticated || !household?.id) {
      return initialConfig.partners ?? INITIAL_PARTNERS;
    }
    const list: PartnerProfile[] = [];
    if (memberProfile) {
      list.push({
        id: memberProfile.partner_role as PartnerId,
        name: memberProfile.display_name || memberProfile.short_name || 'Titular 1',
        shortName: memberProfile.short_name || 'Titular 1',
        email: memberProfile.email || '',
        roleLabel: memberProfile.role_label || 'Titular 1',
        photoDataUrl: memberProfile.photo_url || undefined,
        monthlyNetIncomeConfirmed: 0,
        monthlyNetIncomeEstimated: 0,
      });
    }
    if (partnerProfile) {
      list.push({
        id: partnerProfile.partner_role as PartnerId,
        name: partnerProfile.display_name || partnerProfile.short_name || 'Titular 2',
        shortName: partnerProfile.short_name || 'Titular 2',
        email: partnerProfile.email || '',
        roleLabel: partnerProfile.role_label || 'Titular 2',
        photoDataUrl: partnerProfile.photo_url || undefined,
        monthlyNetIncomeConfirmed: 0,
        monthlyNetIncomeEstimated: 0,
      });
    }
    return list;
  }, [isAuthenticated, household?.id, memberProfile, partnerProfile, initialConfig.partners]);

  const [partners, setPartners] = useState<PartnerProfile[]>(
    initialConfig.partners ?? INITIAL_PARTNERS,
  );

  useEffect(() => {
    if (isAuthenticated && household?.id) {
      setPartners(partnersFromAuth);
    }
  }, [isAuthenticated, household?.id, partnersFromAuth]);
  const [financialSettings, setFinancialSettings] = useState<FinancialSettings>(
    initialConfig.financialSettings ?? DEFAULT_FINANCIAL_SETTINGS,
  );

  // Estados de dados financeiros com controle de persistência vs mock
  const [accounts, setAccounts] = useState<BankAccount[]>(INITIAL_BANK_ACCOUNTS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);

  const isLiveDatabase = Boolean(isAuthenticated && household?.id);

  // Mapeamento de member_id UUID <-> partner_role ('partner_a' | 'partner_b')
  const householdMembersMap = useMemo(() => {
    const map: Record<string, { partnerId: PartnerId; name: string }> = {};
    if (memberProfile?.id) {
      map[memberProfile.id] = {
        partnerId: memberProfile.partner_role as PartnerId,
        name: memberProfile.display_name || memberProfile.short_name,
      };
    }
    if (partnerProfile?.id) {
      map[partnerProfile.id] = {
        partnerId: partnerProfile.partner_role as PartnerId,
        name: partnerProfile.display_name || partnerProfile.short_name,
      };
    }
    return map;
  }, [memberProfile, partnerProfile]);

  // Carregamento reativo a partir do Supabase quando logado em um núcleo
  const refreshFinancialData = useCallback(async () => {
    if (!isAuthenticated || !household?.id) {
      // Modo não autenticado: dados de demonstração
      setAccounts(INITIAL_BANK_ACCOUNTS);
      setTransactions(INITIAL_TRANSACTIONS);
      setCards(INITIAL_CREDIT_CARDS);
      setInstallments(INITIAL_CREDIT_CARD_INSTALLMENTS);
      setBenefits(INITIAL_BENEFIT_CARDS);
      setBenefitMovements([]);
      return;
    }

    try {
      setIsDataLoading(true);
      const [dbAccounts, dbTransactions, dbCards, dbInstallments, dbBenefitCards, dbBenefitMovements] = await Promise.all([
        accountService.listAccounts(householdMembersMap),
        transactionService.listTransactions(householdMembersMap),
        creditCardService.listCards(householdMembersMap),
        creditCardService.listInstallments(householdMembersMap),
        benefitService.listCards(),
        benefitService.listAllMovements(),
      ]);
      setAccounts(dbAccounts);
      setTransactions(dbTransactions);
      setCards(dbCards);
      setInstallments(dbInstallments);

      // Mapeia os BenefitCardDB para BenefitCard
      const mappedBenefits: BenefitCard[] = dbBenefitCards.map((b) => {
        const memberInfo = householdMembersMap[b.member_id];
        return {
          id: b.benefit_card_id,
          type: b.benefit_type,
          providerName: b.provider_name,
          partnerId: memberInfo ? memberInfo.partnerId : 'partner_a',
          memberId: b.member_id,
          monthlyCredit: fromCents(b.monthly_credit),
          currentBalance: fromCents(b.current_balance),
          spentThisMonth: fromCents(b.total_purchases),
          lastCreditDate: new Date().toISOString().split('T')[0],
        };
      });
      setBenefits(mappedBenefits);

      const mappedMovements: BenefitMovement[] = dbBenefitMovements.map((m) => ({
        id: m.id,
        benefitCardId: m.benefit_card_id,
        movementType: m.movement_type,
        amount: fromCents(m.amount),
        description: m.description,
        category: m.category,
        movementDate: m.movement_date,
        competenceMonth: m.competence_month,
        createdBy: m.created_by,
        createdAt: m.created_at,
        reversedBy: m.reversed_by,
        isReversal: m.is_reversal,
        originalMovementId: m.original_movement_id,
        notes: m.notes,
      }));
      setBenefitMovements(mappedMovements);
    } catch (err: any) {
      console.error('Falha ao carregar dados do Supabase:', err);
      showToast('Erro ao sincronizar dados com o banco.');
    } finally {
      setIsDataLoading(false);
    }
  }, [isAuthenticated, household?.id, householdMembersMap]);

  // Recarrega sempre que a autenticação, o núcleo ou os membros mudarem
  useEffect(() => {
    refreshFinancialData();
  }, [refreshFinancialData]);
  const [benefits, setBenefits] = useState<BenefitCard[]>(INITIAL_BENEFIT_CARDS);
  const [benefitMovements, setBenefitMovements] = useState<BenefitMovement[]>([]);
  const [cards, setCards] = useState<CreditCard[]>(INITIAL_CREDIT_CARDS);
  const [installments, setInstallments] = useState<CreditCardInstallment[]>(
    INITIAL_CREDIT_CARD_INSTALLMENTS,
  );
  const [budgets, setBudgets] = useState<BudgetCategory[]>(INITIAL_BUDGET_CATEGORIES);
  const [proportionalHistory] = useState<ProportionalMonthHistory[]>(INITIAL_PROPORTIONAL_HISTORY);
  const [sharedResponsibilities, setSharedResponsibilities] =
    useState<SharedResponsibilityItem[]>(INITIAL_SHARED_RESPONSIBILITIES);
  const [settlements, setSettlements] = useState<CoupleSettlement[]>(INITIAL_SETTLEMENTS);
  const [emergencyBaseConfig, setEmergencyBaseConfig] = useState<EmergencyReserveConfig>(
    INITIAL_EMERGENCY_RESERVE_CONFIG,
  );
  const [emergencyMovements, setEmergencyMovements] =
    useState<EmergencyReserveMovement[]>(INITIAL_EMERGENCY_MOVEMENTS);
  const [investments, setInvestments] = useState<InvestmentAsset[]>(INITIAL_INVESTMENTS);
  const [goals, setGoals] = useState<FinancialGoal[]>(INITIAL_GOALS);
  const [debts, setDebts] = useState<DebtItem[]>(INITIAL_DEBTS);
  const [alerts, setAlerts] = useState<SystemAlert[]>(INITIAL_ALERTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [monthClosed, setMonthClosed] = useState<boolean>(initialConfig.monthClosed ?? false);
  const [isAuthDemoOpen, setIsAuthDemoOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload: StoredPreviewConfig = {
        theme,
        partners,
        financialSettings,
        monthClosed,
      };
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Fallback sem foto em localStorage caso uma imagem exceda a cota do navegador
      try {
        const compactPartners = partners.map((p) => ({ ...p, photoDataUrl: undefined }));
        window.localStorage.setItem(
          CONFIG_STORAGE_KEY,
          JSON.stringify({
            theme,
            partners: compactPartners,
            financialSettings,
            monthClosed,
          }),
        );
      } catch {
        // Ignora indisponibilidade de localStorage
      }
    }
  }, [theme, partners, financialSettings, monthClosed]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3600);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const appendAuditLog = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours(),
    )}:${pad(now.getMinutes())}`;
    setAuditLogs((prev) => [
      { ...entry, id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp },
      ...prev,
    ]);
  };

  const upsertPartnerProfile = (
    id: PartnerId,
    data: { name: string; email: string; roleLabel?: string; photoDataUrl?: string },
    options?: { silent?: boolean; toastMessage?: string },
  ) => {
    const trimmedName = data.name.trim();
    const shortName =
      trimmedName.split(' ')[0] || (id === 'partner_a' ? 'Titular 1' : 'Titular 2');
    const hasPhotoField = 'photoDataUrl' in data;
    const normalizedPhoto = data.photoDataUrl?.trim() || undefined;
    setPartners((prev) => {
      const exists = prev.some((p) => p.id === id);
      if (exists) {
        return prev.map((p) =>
          p.id === id
            ? {
                ...p,
                name: trimmedName,
                shortName,
                email: data.email.trim(),
                photoDataUrl: hasPhotoField ? normalizedPhoto : p.photoDataUrl,
              }
            : p,
        );
      }
      return [
        ...prev,
        {
          id,
          name: trimmedName,
          shortName,
          email: data.email.trim(),
          roleLabel: data.roleLabel ?? (id === 'partner_a' ? 'Titular 1' : 'Titular 2'),
          photoDataUrl: normalizedPhoto,
          monthlyNetIncomeConfirmed: 0,
          monthlyNetIncomeEstimated: 0,
        },
      ];
    });
    if (!options?.silent) {
      appendAuditLog({
        actorId: id,
        action: 'Configuração de perfil salva',
        module: 'Configurações',
        details: `Perfil de ${trimmedName || (id === 'partner_a' ? 'Titular 1' : 'Titular 2')} salvo localmente.`,
        ipOrOrigin: 'Prévia Web',
      });
      showToast(options?.toastMessage ?? 'Perfil salvo com sucesso.');
    }
  };

  const updateFinancialSettings = (next: FinancialSettings) => {
    const sanitizedDay = Math.min(31, Math.max(1, Math.round(next.defaultClosingDay) || 30));
    const sanitized: FinancialSettings = {
      defaultClosingDay: sanitizedDay,
      autoMonthlyReset: next.autoMonthlyReset,
      requireTransferForSettlement: next.requireTransferForSettlement,
    };
    setFinancialSettings(sanitized);
    appendAuditLog({
      actorId: 'system',
      action: 'Configurações financeiras salvas',
      module: 'Configurações',
      details: `Dia de fechamento: ${sanitized.defaultClosingDay} · Reinício mensal: ${
        sanitized.autoMonthlyReset ? 'Sim' : 'Não'
      } · Exigir transferência em acertos: ${
        sanitized.requireTransferForSettlement ? 'Sim' : 'Não'
      }.`,
      ipOrOrigin: 'Prévia Web',
    });
    showToast('Configurações financeiras salvas.');
  };

  const addBankAccount = async (account: Omit<BankAccount, 'id' | 'lastUpdated'>) => {
    if (isLiveDatabase && household?.id && memberProfile?.id) {
      try {
        setIsDataLoading(true);
        // Descobre memberId do titular selecionado
        let targetMemberId = memberProfile.id;
        if (account.partnerId === partnerProfile?.partner_role && partnerProfile?.id) {
          targetMemberId = partnerProfile.id;
        }

        await accountService.createAccount(
          {
            partnerId: account.partnerId,
            institution: account.institution,
            accountName: account.accountName,
            accountType: account.accountType,
            openingBalance: account.openingBalance,
          },
          household.id,
          targetMemberId,
        );

        await refreshFinancialData();
        showToast('Conta bancária cadastrada com sucesso!');
        return;
      } catch (err: any) {
        console.error('Erro ao salvar conta no Supabase:', err);
        showToast(`Erro: ${err.message || 'Falha ao salvar conta.'}`);
        return;
      } finally {
        setIsDataLoading(false);
      }
    }

    // Modo prévia/desconectado: mock em memória
    const newAcc: BankAccount = {
      ...account,
      id: `acc_${Date.now()}`,
      lastUpdated: getTodayIso(),
    };
    setAccounts((prev) => [newAcc, ...prev]);
    appendAuditLog({
      actorId: account.partnerId,
      action: 'Conta bancária cadastrada',
      module: 'Contas bancárias',
      details: `${account.institution} (${account.accountName}) com saldo inicial R$ ${account.openingBalance.toFixed(2)}.`,
      ipOrOrigin: 'Prévia Web',
    });
    showToast('Conta bancária adicionada na prévia.');
  };

  const executeTransfer = async (params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    date?: string;
    notes?: string;
  }) => {
    if (params.fromAccountId === params.toAccountId) {
      showToast('A conta de origem e destino não podem ser a mesma.');
      return;
    }
    if (params.amount <= 0) {
      showToast('O valor da transferência deve ser maior que zero.');
      return;
    }

    if (isLiveDatabase && household?.id) {
      try {
        setIsDataLoading(true);
        await transactionService.executeTransfer(params);
        await refreshFinancialData();
        showToast('Transferência realizada com sucesso!');
      } catch (err: any) {
        console.error('Erro ao executar transferência:', err);
        showToast(`Erro na transferência: ${err.message || 'Falha ao processar.'}`);
        throw err;
      } finally {
        setIsDataLoading(false);
      }
    } else {
      // Modo mock em memória
      const fromAcc = accounts.find((a) => a.id === params.fromAccountId);
      const toAcc = accounts.find((a) => a.id === params.toAccountId);
      if (!fromAcc || !toAcc) {
        showToast('Contas de transferência não encontradas.');
        return;
      }

      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id === params.fromAccountId) return { ...a, currentBalance: a.currentBalance - params.amount };
          if (a.id === params.toAccountId) return { ...a, currentBalance: a.currentBalance + params.amount };
          return a;
        }),
      );

      const now = getNowDateTimeIso();
      const outTx: Transaction = {
        id: `tx_out_${Date.now()}`,
        date: params.date ? `${params.date}T12:00` : now,
        description: params.description || 'Transferência enviada',
        category: 'Transferência',
        type: 'transfer',
        scope: 'individual',
        paymentMethod: 'transfer',
        partnerId: fromAcc.partnerId,
        accountId: params.fromAccountId,
        amount: params.amount,
        status: 'confirmed',
        notes: params.notes,
      };

      const inTx: Transaction = {
        id: `tx_in_${Date.now() + 1}`,
        date: params.date ? `${params.date}T12:00` : now,
        description: params.description || 'Transferência recebida',
        category: 'Transferência',
        type: 'transfer',
        scope: 'individual',
        paymentMethod: 'transfer',
        partnerId: toAcc.partnerId,
        accountId: params.toAccountId,
        amount: params.amount,
        status: 'confirmed',
        notes: params.notes,
      };

      setTransactions((prev) => [outTx, inTx, ...prev]);
      showToast('Transferência simulada realizada com sucesso!');
    }
  };

  const addTransaction = async (tx: Omit<Transaction, 'id'>) => {
    if (isLiveDatabase && household?.id && memberProfile?.id) {
      try {
        setIsDataLoading(true);
        // Descobre memberId do titular selecionado
        let targetMemberId = memberProfile.id;
        if (tx.partnerId === partnerProfile?.partner_role && partnerProfile?.id) {
          targetMemberId = partnerProfile.id;
        }

        // Se for compra no cartão de crédito
        if (tx.type === 'expense' && tx.paymentMethod === 'credit_card' && tx.cardId) {
          const isAdditional = tx.cardId
            ? Boolean(cards.find((c) => c.id === tx.cardId)?.ownerId !== tx.partnerId)
            : false;

          await creditCardService.createPurchase(
            {
              cardId: tx.cardId,
              buyerId: tx.partnerId,
              description: tx.description,
              category: tx.category,
              amount: tx.amount,
              installments: tx.installmentTotal ?? 1,
              scope: tx.scope,
              purchaseDate: tx.date.split('T')[0],
              isAdditional,
            },
            targetMemberId,
          );
        } else if (tx.type === 'income' || tx.type === 'expense') {
          await transactionService.createTransaction(
            {
              partnerId: tx.partnerId,
              accountId: tx.accountId,
              type: tx.type,
              status: tx.status,
              amount: tx.amount,
              paidAmount: tx.paidAmount,
              description: tx.description,
              category: tx.category,
              date: tx.date,
              paymentMethod: tx.paymentMethod,
              scope: tx.scope,
              notes: tx.notes,
            },
            household.id,
            targetMemberId,
          );
        }

        await refreshFinancialData();
        showToast(
          tx.type === 'income'
            ? 'Receita cadastrada com sucesso!'
            : 'Despesa cadastrada com sucesso!',
        );
        return;
      } catch (err: any) {
        console.error('Erro ao salvar movimentação no Supabase:', err);
        showToast(`Erro: ${err.message || 'Falha ao salvar movimentação.'}`);
        return;
      } finally {
        setIsDataLoading(false);
      }
    }

    // Modo prévia/desconectado: mock em memória
    const actorName =
      partners.find((p) => p.id === tx.partnerId)?.name ??
      (tx.partnerId === 'partner_a' ? 'Titular 1' : 'Titular 2');
    const selectedCard =
      tx.paymentMethod === 'credit_card' && tx.cardId
        ? cards.find((c) => c.id === tx.cardId)
        : undefined;

    const newTx: Transaction = {
      ...tx,
      id: `tx_${Date.now()}`,
      historyLog: [
        {
          date: getNowDateTimeIso(),
          actor: actorName,
          change: selectedCard
            ? `Compra registrada no cartão ${selectedCard.name} (Final ${selectedCard.lastFourDigits}).`
            : 'Lançamento registrado na prévia de desenvolvimento.',
        },
      ],
    };
    setTransactions((prev) => [newTx, ...prev]);

    // Apenas movimentações confirmadas em conta bancária alteram saldo bancário.
    // Cartão de crédito e VR/VA nunca alteram saldo de conta bancária no ato da compra!
    if (
      tx.status === 'confirmed' &&
      tx.accountId &&
      tx.paymentMethod !== 'credit_card' &&
      tx.paymentMethod !== 'vr' &&
      tx.paymentMethod !== 'va'
    ) {
      const delta =
        tx.type === 'income'
          ? tx.amount
          : tx.type === 'expense' || tx.type === 'invoice_payment'
            ? -(tx.paidAmount ?? tx.amount)
            : 0;
      if (delta !== 0) {
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === tx.accountId ? { ...a, currentBalance: a.currentBalance + delta } : a,
          ),
        );
      }
    }

    // Compra no cartão de crédito: soma na fatura aberta atual do cartão selecionado
    // e registra cronograma em Parcelas Futuras quando parcelada
    if (tx.type === 'expense' && tx.paymentMethod === 'credit_card' && tx.cardId) {
      const totalInstallments = tx.installmentTotal ?? 1;
      const invoiceAddition =
        totalInstallments > 1
          ? Number((tx.amount / totalInstallments).toFixed(2))
          : tx.amount;

      setCards((prev) =>
        prev.map((c) =>
          c.id === tx.cardId
            ? { ...c, currentInvoiceAmount: c.currentInvoiceAmount + invoiceAddition }
            : c,
        ),
      );

      if (totalInstallments > 1) {
        const newInstallment: CreditCardInstallment = {
          id: `inst_${Date.now()}`,
          cardId: tx.cardId,
          description: tx.description,
          buyerId: tx.partnerId,
          scope: tx.scope,
          category: tx.category,
          purchaseDate: tx.date,
          totalAmount: tx.amount,
          installmentAmount: invoiceAddition,
          currentInstallment: tx.installmentCurrent ?? 1,
          totalInstallments,
          isAdditionalCard: selectedCard ? selectedCard.ownerId !== tx.partnerId : false,
        };
        setInstallments((prev) => [newInstallment, ...prev]);
      }
    }

    // Se receita líquida confirmada, atualizar renda acumulada do perfil caso exista
    if (tx.type === 'income' && tx.status === 'confirmed') {
      setPartners((prev) =>
        prev.map((p) =>
          p.id === tx.partnerId
            ? {
                ...p,
                monthlyNetIncomeConfirmed: p.monthlyNetIncomeConfirmed + tx.amount,
                monthlyNetIncomeEstimated: p.monthlyNetIncomeEstimated + tx.amount,
              }
            : p,
        ),
      );
    }

    appendAuditLog({
      actorId: tx.partnerId,
      action: `Lançamento (${tx.type === 'income' ? 'Receita' : tx.type === 'expense' ? 'Despesa' : 'Movimentação'})`,
      module: 'Movimentações',
      details: selectedCard
        ? `${tx.description} — R$ ${tx.amount.toFixed(2)} no cartão ${selectedCard.name}.`
        : `${tx.description} — R$ ${tx.amount.toFixed(2)}.`,
      ipOrOrigin: 'Prévia Web',
    });
    showToast(
      selectedCard
        ? `Compra registrada no cartão ${selectedCard.name}.`
        : 'Movimentação registrada na prévia.',
    );
  };

  const addBenefitCard = async (benefit: Omit<BenefitCard, 'id' | 'lastCreditDate'>) => {
    if (isLiveDatabase && household?.id && memberProfile?.id) {
      try {
        setIsDataLoading(true);
        const ownerMemberId =
          benefit.partnerId === memberProfile.partner_role
            ? memberProfile.id
            : partnerProfile?.id ?? memberProfile.id;

        await benefitService.createCard({
          memberId: ownerMemberId,
          benefitType: benefit.type,
          providerName: benefit.providerName,
          monthlyCredit: benefit.monthlyCredit,
          initialBalance: benefit.currentBalance,
        });

        await refreshFinancialData();
        showToast(`Cartão ${benefit.type} cadastrado com sucesso.`);
      } catch (err: any) {
        console.error('Erro ao cadastrar cartão de benefício:', err);
        showToast(err.message || 'Falha ao cadastrar cartão de benefício.');
        throw err;
      } finally {
        setIsDataLoading(false);
      }
      return;
    }

    // Modo demonstração
    const newCard: BenefitCard = {
      ...benefit,
      id: `ben_${Date.now()}`,
      lastCreditDate: getTodayIso(),
    };
    setBenefits((prev) => [newCard, ...prev]);
    appendAuditLog({
      actorId: benefit.partnerId,
      action: `Benefício ${benefit.type} cadastrado`,
      module: 'Benefícios VR/VA',
      details: `${benefit.providerName} com saldo inicial R$ ${benefit.currentBalance.toFixed(2)}.`,
      ipOrOrigin: 'Prévia Web',
    });
    showToast('Benefício VR/VA cadastrado na prévia.');
  };

  const registerBenefitCredit = async (params: {
    benefitId: string;
    amount: number;
    description?: string;
  }) => {
    if (isLiveDatabase && household?.id) {
      try {
        setIsDataLoading(true);
        await benefitService.registerCredit({
          benefitCardId: params.benefitId,
          amount: params.amount,
          description: params.description || 'Crédito recebido',
        });
        await refreshFinancialData();
        showToast('Crédito em benefício registrado com sucesso.');
      } catch (err: any) {
        console.error('Erro ao registrar crédito em benefício:', err);
        showToast(err.message || 'Falha ao registrar crédito.');
        throw err;
      } finally {
        setIsDataLoading(false);
      }
      return;
    }

    // Modo demonstração
    setBenefits((prev) =>
      prev.map((b) =>
        b.id === params.benefitId
          ? {
              ...b,
              currentBalance: b.currentBalance + params.amount,
              monthlyCredit: b.monthlyCredit + params.amount,
            }
          : b,
      ),
    );
    showToast('Crédito registrado na prévia.');
  };

  const registerBenefitPurchase = async (params: {
    benefitId: string;
    description: string;
    category: string;
    amount: number;
    scope: 'individual' | 'shared';
  }) => {
    if (isLiveDatabase && household?.id) {
      try {
        setIsDataLoading(true);
        await benefitService.registerPurchase({
          benefitCardId: params.benefitId,
          amount: params.amount,
          description: params.description,
          category: params.category,
        });
        await refreshFinancialData();
        showToast('Compra no benefício registrada com sucesso.');
      } catch (err: any) {
        console.error('Erro ao registrar compra em benefício:', err);
        showToast(err.message || 'Falha ao registrar compra em benefício.');
        throw err;
      } finally {
        setIsDataLoading(false);
      }
      return;
    }

    // Modo demonstração
    const card = benefits.find((b) => b.id === params.benefitId);
    if (!card) return;

    // Atualiza APENAS o saldo do benefício VR/VA. NUNCA reduz saldo bancário.
    setBenefits((prev) =>
      prev.map((b) =>
        b.id === params.benefitId
          ? {
              ...b,
              currentBalance: Math.max(0, b.currentBalance - params.amount),
              spentThisMonth: b.spentThisMonth + params.amount,
            }
          : b,
      ),
    );

    const tx: Transaction = {
      id: `tx_ben_${Date.now()}`,
      date: getNowDateTimeIso(),
      description: params.description,
      category: params.category,
      type: 'expense',
      status: 'confirmed',
      amount: params.amount,
      paidAmount: params.amount,
      partnerId: card.partnerId,
      scope: params.scope,
      paymentMethod: card.type === 'VR' ? 'vr' : 'va',
      benefitId: card.id,
      notes: `Debitado exclusivamente de ${card.providerName}. Saldo bancário preservado.`,
    };
    setTransactions((prev) => [tx, ...prev]);

    appendAuditLog({
      actorId: card.partnerId,
      action: `Compra registrada em ${card.type}`,
      module: 'Benefícios VR/VA',
      details: `${params.description} (R$ ${params.amount.toFixed(2)}) em ${card.providerName}.`,
      ipOrOrigin: 'Prévia Web',
    });
    showToast(`Compra registrada no ${card.type} sem afetar contas bancárias.`);
  };

  const reverseBenefitMovement = async (movementId: string, reason?: string) => {
    if (isLiveDatabase && household?.id) {
      try {
        setIsDataLoading(true);
        await benefitService.reverseMovement({
          movementId,
          reason,
        });
        await refreshFinancialData();
        showToast('Estorno realizado com sucesso.');
      } catch (err: any) {
        console.error('Erro ao estornar movimento de benefício:', err);
        showToast(err.message || 'Falha ao estornar movimento.');
        throw err;
      } finally {
        setIsDataLoading(false);
      }
      return;
    }

    // Modo demonstração
    showToast('Estorno não suportado na prévia.');
  };

  const addCreditCard = async (card: Omit<CreditCard, 'id'>) => {
    if (isLiveDatabase && household?.id && memberProfile?.id) {
      try {
        setIsDataLoading(true);
        const ownerMemberId =
          card.ownerId === memberProfile.partner_role
            ? memberProfile.id
            : partnerProfile?.id ?? memberProfile.id;

        const additionalMemberId = card.additionalHolderId
          ? card.additionalHolderId === memberProfile.partner_role
            ? memberProfile.id
            : partnerProfile?.id
          : undefined;

        await creditCardService.createCard(
          {
            name: card.name,
            bank: card.bank,
            brand: card.brand as any,
            ownerId: card.ownerId,
            creditLimit: card.creditLimit,
            closingDay: card.closingDay,
            dueDay: card.dueDay,
            lastFourDigits: card.lastFourDigits,
            additionalHolderId: card.additionalHolderId,
            additionalLastFourDigits: card.additionalLastFourDigits,
          },
          household.id,
          ownerMemberId,
          additionalMemberId,
        );
        await refreshFinancialData();
        showToast('Cartão de crédito cadastrado com sucesso!');
      } catch (err: any) {
        console.error('Erro ao cadastrar cartão:', err);
        showToast(`Erro ao cadastrar cartão: ${err.message}`);
        throw err;
      } finally {
        setIsDataLoading(false);
      }
      return;
    }

    const newCard: CreditCard = { ...card, id: `card_${Date.now()}` };
    setCards((prev) => [newCard, ...prev]);
    appendAuditLog({
      actorId: card.ownerId,
      action: 'Cartão de crédito cadastrado',
      module: 'Cartões de crédito',
      details: `${card.name} (limite R$ ${card.creditLimit.toFixed(2)}).`,
      ipOrOrigin: 'Prévia Web',
    });
    showToast('Cartão cadastrado na prévia.');
  };

  const updateCreditCard = async (cardId: string, updates: Partial<CreditCard>) => {
    if (isLiveDatabase) {
      try {
        setIsDataLoading(true);
        await creditCardService.updateCard(cardId, {
          name: updates.name,
          bank: updates.bank,
          creditLimit: updates.creditLimit,
          closingDay: updates.closingDay,
          dueDay: updates.dueDay,
          lastFourDigits: updates.lastFourDigits,
          additionalHolderId: updates.additionalHolderId,
          additionalLastFourDigits: updates.additionalLastFourDigits,
        });
        await refreshFinancialData();
        showToast('Cartão de crédito atualizado com sucesso!');
      } catch (err: any) {
        console.error('Erro ao atualizar cartão:', err);
        showToast(`Erro ao atualizar cartão: ${err.message}`);
        throw err;
      } finally {
        setIsDataLoading(false);
      }
      return;
    }

    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c)));
    showToast('Cartão atualizado na prévia.');
  };

  const payCardInvoice = async (cardId: string, accountId: string, amount: number) => {
    if (isLiveDatabase && household?.id) {
      try {
        setIsDataLoading(true);
        await creditCardService.payInvoice({
          cardId,
          accountId,
          amount,
        });
        await refreshFinancialData();
        showToast('Pagamento de fatura registrado sem duplicar despesa de consumo!');
      } catch (err: any) {
        console.error('Erro ao pagar fatura:', err);
        showToast(`Erro ao pagar fatura: ${err.message}`);
        throw err;
      } finally {
        setIsDataLoading(false);
      }
      return;
    }

    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              currentInvoiceAmount: Math.max(0, c.currentInvoiceAmount - amount),
            }
          : c,
      ),
    );

    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId ? { ...a, currentBalance: a.currentBalance - amount } : a,
      ),
    );

    const tx: Transaction = {
      id: `tx_inv_${Date.now()}`,
      date: getNowDateTimeIso(),
      description: `Pagamento Fatura — ${card.name}`,
      category: 'Pagamento de Fatura',
      type: 'invoice_payment',
      status: 'confirmed',
      amount,
      paidAmount: amount,
      partnerId: card.ownerId,
      scope: 'individual',
      paymentMethod: 'transfer',
      accountId,
      cardId,
      notes: 'Quitação de fatura contabilizada sem dupla contagem de consumo.',
    };
    setTransactions((prev) => [tx, ...prev]);

    appendAuditLog({
      actorId: card.ownerId,
      action: 'Pagamento de fatura registrado',
      module: 'Cartões de crédito',
      details: `${card.name}: R$ ${amount.toFixed(2)} debitado da conta selecionada.`,
      ipOrOrigin: 'Prévia Web',
    });
    showToast('Pagamento de fatura registrado sem duplicar despesa de consumo.');
  };

  const addBudgetCategory = (budget: Omit<BudgetCategory, 'id'>) => {
    setBudgets((prev) => [...prev, { ...budget, id: `bud_${Date.now()}` }]);
    showToast('Categoria adicionada ao orçamento mensal.');
  };

  const updateBudgetLimit = (id: string, newLimit: number) => {
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, monthlyLimit: newLimit } : b)));
    showToast('Limite mensal atualizado na prévia.');
  };

  const settleCoupleBalance = (settlementId: string, accountId?: string) => {
    const item = settlements.find((s) => s.id === settlementId);
    if (!item || item.status === 'settled') return;
    if (financialSettings.requireTransferForSettlement && !accountId) {
      showToast('Selecione uma conta bancária para vincular a transferência do acerto.');
      return;
    }

    const transferId = accountId ? `tx_set_${Date.now()}` : undefined;
    if (accountId && transferId) {
      const transferTx: Transaction = {
        id: transferId,
        date: getNowDateTimeIso(),
        description: `Transferência de Acerto (${item.referenceMonth})`,
        category: 'Acerto entre Casal',
        type: 'transfer',
        status: 'confirmed',
        amount: item.amount,
        paidAmount: item.amount,
        partnerId: item.fromPartnerId,
        scope: 'shared',
        paymentMethod: 'pix',
        accountId,
        notes: 'Transferência efetiva vinculada à liquidação de responsabilidades.',
      };
      setTransactions((prev) => [transferTx, ...prev]);
    }

    setSettlements((prev) =>
      prev.map((s) =>
        s.id === settlementId
          ? {
              ...s,
              status: 'settled',
              linkedTransferId: transferId,
              settledDate: getTodayIso(),
            }
          : s,
      ),
    );

    setSharedResponsibilities((prev) =>
      prev.map((r) =>
        r.status === 'pending'
          ? { ...r, status: 'settled', settlementTransferId: transferId }
          : r,
      ),
    );

    appendAuditLog({
      actorId: item.fromPartnerId,
      action: 'Acerto entre casal liquidado',
      module: 'Acertos entre o casal',
      details: transferId
        ? `Acerto de R$ ${item.amount.toFixed(2)} vinculado à transferência ${transferId}.`
        : `Acerto de R$ ${item.amount.toFixed(2)} liquidado sem transferência bancária vinculada.`,
      ipOrOrigin: 'Prévia Web',
    });
    showToast(
      transferId
        ? 'Acerto liquidado e vinculado a transferência efetiva.'
        : 'Acerto marcado como liquidado.',
    );
  };

  const configureEmergencyReserve = (params: {
    essentialMonthlyBaseline: number;
    targetMonths: number;
    monthlyPlannedDeposit: number;
  }) => {
    setEmergencyBaseConfig((prev) => ({
      ...prev,
      isConfigured: true,
      essentialMonthlyBaseline: params.essentialMonthlyBaseline,
      targetMonths: params.targetMonths,
      targetAmount: params.essentialMonthlyBaseline * params.targetMonths,
      monthlyPlannedDeposit: params.monthlyPlannedDeposit,
    }));
    appendAuditLog({
      actorId: 'system',
      action: 'Reserva de emergência configurada',
      module: 'Reserva de emergência',
      details: `Meta de ${params.targetMonths} meses sobre base essencial de R$ ${params.essentialMonthlyBaseline.toFixed(2)}.`,
      ipOrOrigin: 'Prévia Web',
    });
    showToast('Meta da reserva de emergência configurada.');
  };

  const addEmergencyMovement = (mov: Omit<EmergencyReserveMovement, 'id'>) => {
    const newMov: EmergencyReserveMovement = {
      ...mov,
      id: `er_${Date.now()}`,
    };
    setEmergencyMovements((prev) => [newMov, ...prev]);

    const delta = mov.type === 'deposit' ? mov.amount : -mov.amount;
    setEmergencyBaseConfig((prev) => ({
      ...prev,
      isConfigured: true,
      currentAmount: Math.max(0, prev.currentAmount + delta),
      partnerATotalContributed:
        mov.partnerId === 'partner_a' && mov.type === 'deposit'
          ? prev.partnerATotalContributed + mov.amount
          : prev.partnerATotalContributed,
      partnerBTotalContributed:
        mov.partnerId === 'partner_b' && mov.type === 'deposit'
          ? prev.partnerBTotalContributed + mov.amount
          : prev.partnerBTotalContributed,
    }));

    appendAuditLog({
      actorId: mov.partnerId,
      action:
        mov.type === 'deposit'
          ? 'Aporte na reserva de emergência'
          : 'Retirada da reserva de emergência',
      module: 'Reserva de emergência',
      details: `${mov.type === 'deposit' ? '+' : '-'} R$ ${mov.amount.toFixed(2)} · Motivo: ${mov.reason ?? 'Não informado'}`,
      ipOrOrigin: 'Prévia Web',
    });
    showToast(
      mov.type === 'deposit'
        ? 'Aporte na reserva registrado.'
        : 'Retirada da reserva registrada com justificativa auditada.',
    );
  };

  const addInvestment = (inv: Omit<InvestmentAsset, 'id'>) => {
    setInvestments((prev) => [{ ...inv, id: `inv_${Date.now()}` }, ...prev]);
    appendAuditLog({
      actorId: inv.ownerId === 'joint' ? 'system' : inv.ownerId,
      action:
        inv.scope === 'joint' || inv.ownerId === 'joint'
          ? 'Novo investimento do casal cadastrado'
          : 'Novo investimento individual cadastrado',
      module: 'Investimentos',
      details: `${inv.name} (${inv.institution}) — R$ ${inv.currentBalance.toFixed(2)}.`,
      ipOrOrigin: 'Prévia Web',
    });
    showToast('Investimento cadastrado na prévia.');
  };

  const addGoal = (goal: Omit<FinancialGoal, 'id'>) => {
    setGoals((prev) => [{ ...goal, id: `goal_${Date.now()}` }, ...prev]);
    showToast('Meta financeira adicionada ao planejamento.');
  };

  const addDebt = (debt: Omit<DebtItem, 'id'>) => {
    setDebts((prev) => [{ ...debt, id: `debt_${Date.now()}` }, ...prev]);
    showToast('Dívida ou financiamento cadastrado na prévia.');
  };

  const markAlertRead = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
  };

  const summary = useMemo(
    () =>
      computeDashboardSummary({
        accounts,
        benefits,
        transactions,
        cards,
        investments,
        debts,
        settlements,
        budgets,
      }),
    [accounts, benefits, transactions, cards, investments, debts, settlements, budgets],
  );

  const emergencyConfigComputed = useMemo<EmergencyReserveConfig>(() => {
    const reserveFromInvestments = summary.emergencyReserveBalance;
    return {
      ...emergencyBaseConfig,
      currentAmount: Math.max(emergencyBaseConfig.currentAmount, reserveFromInvestments),
    };
  }, [emergencyBaseConfig, summary.emergencyReserveBalance]);

  const value: FinanceContextValue = {
    activePage,
    setActivePage,
    theme,
    toggleTheme,
    partners,
    upsertPartnerProfile,
    financialSettings,
    updateFinancialSettings,
    isDataLoading,
    refreshFinancialData,
    isLiveDatabase,
    executeTransfer,
    accounts,
    addBankAccount,
    transactions,
    addTransaction,
    benefits,
    benefitMovements,
    addBenefitCard,
    registerBenefitCredit,
    registerBenefitPurchase,
    reverseBenefitMovement,
    cards,
    addCreditCard,
    updateCreditCard,
    installments,
    payCardInvoice,
    budgets,
    addBudgetCategory,
    updateBudgetLimit,
    proportionalHistory,
    sharedResponsibilities,
    settlements,
    settleCoupleBalance,
    emergencyConfig: emergencyConfigComputed,
    configureEmergencyReserve,
    emergencyMovements,
    addEmergencyMovement,
    investments,
    addInvestment,
    goals,
    addGoal,
    debts,
    addDebt,
    alerts,
    markAlertRead,
    auditLogs,
    appendAuditLog,
    monthlySeries: INITIAL_MONTHLY_SERIES,
    summary,
    monthClosed,
    setMonthClosed,
    isAuthDemoOpen,
    setIsAuthDemoOpen,
    toastMessage,
    showToast,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error('useFinance deve ser utilizado dentro de FinanceProvider.');
  }
  return ctx;
}
