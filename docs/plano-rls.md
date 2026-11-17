# Plano de RLS (Row Level Security) — Tarefa 04

## Visão Geral

Este documento descreve o plano de implementação de Row Level Security para a Tarefa 04.
As políticas aqui planejadas serão criadas após a implementação da autenticação.

## Princípio de Acesso

Todas as políticas RLS seguem o padrão:

```sql
-- O usuário autenticado só acessa dados do seu household
auth.uid() IN (
  SELECT auth_user_id FROM household_members
  WHERE household_id = {tabela}.household_id
)
```

## Tabelas e Políticas Planejadas

### 1. Tabelas com RLS Standard (SELECT, INSERT, UPDATE, DELETE)

Todas as tabelas financeiras que possuem `household_id`:

| Tabela | Política |
|---|---|
| `households` | Membro do household |
| `household_members` | Membro do mesmo household |
| `household_settings` | Membro do household |
| `bank_accounts` | Membro do household |
| `transactions` | Membro do household |
| `benefit_cards` | Membro do household |
| `benefit_movements` | Membro do household |
| `credit_cards` | Membro do household |
| `credit_card_invoices` | Membro do household |
| `credit_card_purchases` | Membro do household |
| `credit_card_installments` | Via purchase → household |
| `invoice_payments` | Membro do household |
| `proportional_periods` | Membro do household |
| `shared_responsibilities` | Membro do household |
| `couple_settlements` | Membro do household |
| `settlement_transfers` | Membro do household |
| `budget_categories` | Membro do household |
| `monthly_budgets` | Membro do household |
| `budget_category_limits` | Via budget → household |
| `recurrence_rules` | Membro do household |
| `investment_assets` | Membro do household |
| `investment_movements` | Membro do household |
| `investment_valuations` | Via asset → household |
| `emergency_reserve_configs` | Membro do household |
| `emergency_reserve_movements` | Membro do household |
| `financial_goals` | Membro do household |
| `goal_contributions` | Via goal → household |
| `debts` | Membro do household |
| `debt_installments` | Via debt → household |
| `fiscal_periods` | Membro do household |
| `fiscal_snapshots` | Via period → household |
| `system_alerts` | Membro do household |
| `monthly_series` | Membro do household |

### 2. Tabela com RLS Restritiva (apenas INSERT)

| Tabela | Política |
|---|---|
| `audit_logs` | SELECT: Membro do household. INSERT: Membro do household. UPDATE/DELETE: **BLOQUEADO** (nenhuma policy, deny by default) |

### 3. Views

Views herdam as políticas RLS das tabelas subjacentes automaticamente no PostgreSQL.

## Função Helper Planejada

```sql
-- Função para verificar pertencimento ao household
CREATE OR REPLACE FUNCTION auth.user_household_id()
RETURNS UUID AS $$
  SELECT household_id
  FROM household_members
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

## Habilitação de RLS

```sql
-- Exemplo para cada tabela:
ALTER TABLE {tabela} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {tabela} FORCE ROW LEVEL SECURITY;

CREATE POLICY "Members can access own household data"
ON {tabela}
FOR ALL
USING (household_id = auth.user_household_id())
WITH CHECK (household_id = auth.user_household_id());
```

## Regras Especiais

### Audit Logs
```sql
-- Somente INSERT permitido
CREATE POLICY "Members can insert audit logs"
ON audit_logs FOR INSERT
WITH CHECK (household_id = auth.user_household_id());

CREATE POLICY "Members can read audit logs"
ON audit_logs FOR SELECT
USING (household_id = auth.user_household_id());

-- Nenhuma policy para UPDATE/DELETE = bloqueado por padrão
```

### Fiscal Periods (Meses Fechados)
- Trigger `BEFORE UPDATE` em `transactions` verificará se o `competence_month` está em período fechado
- Se estiver, bloqueará a alteração (exceto operações de estorno que geram novo lançamento no mês corrente)

## Restrições de Segurança

- `service_role` **NUNCA** será usado no frontend
- Todas as queries do frontend usam `anon` key com RLS ativo
- Tokens e segredos **NUNCA** são armazenados em `audit_logs`
- Fotos de perfil devem usar Supabase Storage com políticas próprias

## Dependências

- Requer Tarefa 04: implementação de autenticação com Supabase Auth
- Requer `auth.users` populado com os emails dos membros
- Requer `household_members.auth_user_id` preenchido

## Riscos

1. Performance de `auth.user_household_id()` em tabelas grandes — considerar materializar em JWT claims
2. Tabelas com FK indireta (ex: `credit_card_installments` via `purchase_id`) — policy deve fazer JOIN
3. Concorrência em operações atômicas (transferências, acertos) — usar transactions SQL
