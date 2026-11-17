/**
 * Cliente Supabase — Camada de Autenticação e Acesso ao Banco (Tarefa 04)
 *
 * Configurado via variáveis de ambiente Vite:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 *
 * Tratamento seguro:
 * - Persistência automática de sessão via localStorage.
 * - Auto-refresh de tokens JWT.
 * - Modo resiliente: caso as variáveis não estejam preenchidas, usa fallback seguro para não quebrar a aplicação.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:54321';
const DEFAULT_LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  envUrl &&
    envAnonKey &&
    envUrl !== 'https://your-project.supabase.co' &&
    envAnonKey !== 'your-anon-key-here',
);

const activeUrl = isSupabaseConfigured ? envUrl : DEFAULT_LOCAL_URL;
const activeKey = isSupabaseConfigured ? envAnonKey : DEFAULT_LOCAL_ANON_KEY;

export const supabase: SupabaseClient<Database> = createClient<Database>(
  activeUrl,
  activeKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'sfc_supabase_auth_token',
    },
  },
);
