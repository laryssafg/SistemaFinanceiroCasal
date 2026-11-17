import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { HouseholdMemberRow, HouseholdRow } from '../types/database';

export type AuthModalMode = 'login' | 'signup' | 'recovery' | 'invite';

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  household: HouseholdRow | null;
  memberProfile: HouseholdMemberRow | null;
  partnerProfile: HouseholdMemberRow | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  clearError: () => void;

  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: AuthModalMode;
  setAuthModalMode: (mode: AuthModalMode) => void;

  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (params: {
    email: string;
    password: string;
    displayName: string;
    shortName: string;
    householdName?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  acceptInvite: (params: {
    token: string;
    displayName: string;
    shortName: string;
  }) => Promise<{ success: boolean; error?: string }>;
  createInvite: (invitedEmail: string) => Promise<{
    success: boolean;
    token?: string;
    error?: string;
  }>;
  refreshProfiles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Converte mensagens de erro técnicas do Supabase em mensagens em português
 */
export function formatAuthError(error: unknown): string {
  if (!error) return 'Ocorreu um erro desconhecido.';
  const msg = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message: unknown }).message)
    : String(error);

  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Verifique suas credenciais.';
  }
  if (lower.includes('already registered') || lower.includes('unique constraint')) {
    return 'Este e-mail já está cadastrado no sistema.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return 'A senha deve conter pelo menos 6 caracteres.';
  }
  if (lower.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  }
  if (lower.includes('rate limit')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes.';
  }
  if (lower.includes('fetch') || lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Não foi possível conectar ao servidor de autenticação. Verifique sua conexão local.';
  }
  if (lower.includes('convite inválido, expirado ou já utilizado')) {
    return 'Convite inválido, expirado ou já utilizado.';
  }
  if (lower.includes('limite de duas participantes')) {
    return 'Este núcleo financeiro já atingiu o limite de duas pessoas.';
  }
  if (lower.includes('já pertence a um núcleo financeiro')) {
    return 'Sua conta já pertence a um núcleo financeiro cadastrado.';
  }

  return msg;
}

/**
 * Gera hash SHA-256 em hexadecimal de um token em texto puro
 */
export async function hashToken(token: string): Promise<string> {
  const clean = token.trim();
  // Se já for uma hash hexadecimal de 64 caracteres, mantém direta
  if (/^[a-f0-9]{64}$/i.test(clean)) {
    return clean.toLowerCase();
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(clean);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [household, setHousehold] = useState<HouseholdRow | null>(null);
  const [memberProfile, setMemberProfile] = useState<HouseholdMemberRow | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<HouseholdMemberRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  /**
   * Carrega os dados de household e membros a partir da usuária autenticada
   */
  const loadHouseholdAndProfiles = useCallback(async (currentUserId: string) => {
    try {
      // 1. Busca perfil do membro atual
      const { data: memberData, error: memberErr } = await supabase
        .from('household_members')
        .select('*')
        .eq('auth_user_id', currentUserId)
        .maybeSingle();

      if (memberErr) {
        console.warn('Aviso ao buscar perfil da usuária:', memberErr.message);
        setMemberProfile(null);
        setHousehold(null);
        setPartnerProfile(null);
        return;
      }

      if (!memberData) {
        // Usuária autenticada no Auth, mas ainda sem núcleo criado
        setMemberProfile(null);
        setHousehold(null);
        setPartnerProfile(null);
        return;
      }

      const activeMember = memberData as HouseholdMemberRow;
      setMemberProfile(activeMember);

      // 2. Busca informações do núcleo
      const { data: hhData, error: hhErr } = await supabase
        .from('households')
        .select('*')
        .eq('id', activeMember.household_id)
        .maybeSingle();

      if (!hhErr && hhData) {
        setHousehold(hhData as HouseholdRow);
      }

      // 3. Busca o(a) parceiro(a) no mesmo núcleo
      const { data: partnersData, error: partnersErr } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', activeMember.household_id)
        .neq('id', activeMember.id)
        .maybeSingle();

      if (!partnersErr && partnersData) {
        setPartnerProfile(partnersData as HouseholdMemberRow);
      } else {
        setPartnerProfile(null);
      }
    } catch (err) {
      console.warn('Erro ao carregar perfis do casal:', err);
    }
  }, []);

  const refreshProfiles = useCallback(async () => {
    if (user?.id) {
      await loadHouseholdAndProfiles(user.id);
    }
  }, [user?.id, loadHouseholdAndProfiles]);

  // Inicializa sessão e escuta mudanças de estado do Supabase Auth
  useEffect(() => {
    let mounted = true;

    async function initializeSession() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Aviso de sessão:', error.message);
        }
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          if (data.session?.user) {
            await loadHouseholdAndProfiles(data.session.user.id);
          }
        }
      } catch (err) {
        console.warn('Erro ao restaurar sessão:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initializeSession();

    // Inscrição em alterações de sessão
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await loadHouseholdAndProfiles(newSession.user.id);
      } else {
        setHousehold(null);
        setMemberProfile(null);
        setPartnerProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadHouseholdAndProfiles]);

  /**
   * Login com e-mail e senha
   */
  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        setAuthError(null);
        setIsLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          const friendly = formatAuthError(error);
          setAuthError(friendly);
          return { success: false, error: friendly };
        }

        if (data.user) {
          setUser(data.user);
          setSession(data.session);
          await loadHouseholdAndProfiles(data.user.id);
        }

        setIsAuthModalOpen(false);
        return { success: true };
      } catch (err) {
        const friendly = formatAuthError(err);
        setAuthError(friendly);
        return { success: false, error: friendly };
      } finally {
        setIsLoading(false);
      }
    },
    [loadHouseholdAndProfiles],
  );

  /**
   * Cadastro com criação do primeiro núcleo do casal
   */
  const signUp = useCallback(
    async ({
      email,
      password,
      displayName,
      shortName,
      householdName,
    }: {
      email: string;
      password: string;
      displayName: string;
      shortName: string;
      householdName?: string;
    }) => {
      try {
        setAuthError(null);
        setIsLoading(true);

        const cleanEmail = email.trim().toLowerCase();
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (authErr) {
          const friendly = formatAuthError(authErr);
          setAuthError(friendly);
          return { success: false, error: friendly };
        }

        // Se a sessão foi retornada imediatamente (confirmação automática ativada no ambiente local)
        if (authData.session && authData.user) {
          setUser(authData.user);
          setSession(authData.session);

          // Chama RPC segura para criar o household com a criadora
          const { error: rpcErr } = await supabase.rpc('create_household_with_creator', {
            p_display_name: householdName?.trim() || 'Nosso Núcleo Financeiro',
            p_member_name: displayName.trim(),
            p_short_name: shortName.trim(),
          });

          if (rpcErr) {
            const friendly = formatAuthError(rpcErr);
            setAuthError(friendly);
            return { success: false, error: friendly };
          }

          await loadHouseholdAndProfiles(authData.user.id);
          setIsAuthModalOpen(false);
          return { success: true };
        }

        // Se confirmação de email estiver ligada
        return {
          success: true,
          error: 'Conta criada! Verifique seu e-mail para confirmar seu acesso antes de entrar.',
        };
      } catch (err) {
        const friendly = formatAuthError(err);
        setAuthError(friendly);
        return { success: false, error: friendly };
      } finally {
        setIsLoading(false);
      }
    },
    [loadHouseholdAndProfiles],
  );

  /**
   * Aceite de convite por token seguro
   */
  const acceptInvite = useCallback(
    async ({
      token,
      displayName,
      shortName,
    }: {
      token: string;
      displayName: string;
      shortName: string;
    }) => {
      try {
        setAuthError(null);
        setIsLoading(true);

        if (!user) {
          const err = 'É necessário estar autenticada para vincular o convite à sua conta.';
          setAuthError(err);
          return { success: false, error: err };
        }

        const hashed = await hashToken(token);

        const { error: rpcErr } = await supabase.rpc('accept_household_invite', {
          p_token_hash: hashed,
          p_display_name: displayName.trim(),
          p_short_name: shortName.trim(),
        });

        if (rpcErr) {
          const friendly = formatAuthError(rpcErr);
          setAuthError(friendly);
          return { success: false, error: friendly };
        }

        await loadHouseholdAndProfiles(user.id);
        setIsAuthModalOpen(false);
        return { success: true };
      } catch (err) {
        const friendly = formatAuthError(err);
        setAuthError(friendly);
        return { success: false, error: friendly };
      } finally {
        setIsLoading(false);
      }
    },
    [user, loadHouseholdAndProfiles],
  );

  /**
   * Criação de convite para o parceiro(a)
   */
  const createInvite = useCallback(
    async (invitedEmail: string) => {
      try {
        setAuthError(null);
        if (!household || !memberProfile) {
          const err = 'É necessário pertencer a um núcleo para gerar convites.';
          setAuthError(err);
          return { success: false, error: err };
        }

        // Gera token aleatório de 24 caracteres hexadecimais
        const randomBytes = new Uint8Array(16);
        crypto.getRandomValues(randomBytes);
        const plainToken = Array.from(randomBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        const tokenHash = await hashToken(plainToken);

        const { error: insertErr } = await supabase.from('household_invites').insert({
          household_id: household.id,
          invited_by: memberProfile.id,
          invited_email: invitedEmail.trim().toLowerCase(),
          token_hash: tokenHash,
          partner_role: memberProfile.partner_role === 'partner_a' ? 'partner_b' : 'partner_a',
        });

        if (insertErr) {
          const friendly = formatAuthError(insertErr);
          setAuthError(friendly);
          return { success: false, error: friendly };
        }

        return { success: true, token: plainToken };
      } catch (err) {
        const friendly = formatAuthError(err);
        setAuthError(friendly);
        return { success: false, error: friendly };
      }
    },
    [household, memberProfile],
  );

  /**
   * Logout
   */
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setHousehold(null);
      setMemberProfile(null);
      setPartnerProfile(null);
      setAuthError(null);
    } catch (err) {
      console.warn('Erro ao deslogar:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Recuperação de senha
   */
  const resetPassword = useCallback(async (email: string) => {
    try {
      setAuthError(null);
      setIsLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        const friendly = formatAuthError(error);
        setAuthError(friendly);
        return { success: false, error: friendly };
      }
      return { success: true };
    } catch (err) {
      const friendly = formatAuthError(err);
      setAuthError(friendly);
      return { success: false, error: friendly };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      household,
      memberProfile,
      partnerProfile,
      isAuthenticated: Boolean(user && session),
      isLoading,
      authError,
      clearError,
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
      refreshProfiles,
    }),
    [
      user,
      session,
      household,
      memberProfile,
      partnerProfile,
      isLoading,
      authError,
      clearError,
      isAuthModalOpen,
      authModalMode,
      signIn,
      signUp,
      signOut,
      resetPassword,
      acceptInvite,
      createInvite,
      refreshProfiles,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de um <AuthProvider>');
  }
  return ctx;
}
