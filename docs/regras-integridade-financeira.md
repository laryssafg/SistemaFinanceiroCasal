# Regras de Integridade Financeira — Sistema Financeiro do Casal

## 1. Princípios Fundamentais

### 1.1 Fonte Única de Verdade para Saldos
- **Saldos bancários** são DERIVADOS da view `v_bank_account_balances`:
  `saldo = opening_balance + SUM(créditos confirmados) - SUM(débitos confirmados)`
- **Saldos de benefícios VR/VA** são DERIVADOS da view `v_benefit_card_balances`:
  `saldo = SUM(créditos) - SUM(compras)`
- **Saldos de investimentos** são DERIVADOS da view `v_investment_balances`:
  usa a avaliação mais recente ou calcula por movimentações
- Nenhuma tabela armazena `currentBalance` como coluna mutável.

### 1.2 Precisão Monetária
- Todos os valores monetários são armazenados como **BIGINT em centavos**
  - R$ 100,00 = 10000
  - R$ 0,01 = 1
- Percentuais são armazenados em **basis points** (INTEGER)
  - 100.00% = 10000
  - 55.23% = 5523
- Arredondamentos preservam a soma exata: `partner_a_share + partner_b_share = total_amount`

### 1.3 Isolamento por Núcleo
- Toda entidade financeira possui `household_id`
- RLS (Tarefa 04) garantirá que membros só acessem dados do seu household
- Nenhuma query cross-household é possível para usuárias comuns

## 2. Regras de Movimentações

### 2.1 Tipos de Transação
| Tipo | Afeta saldo bancário | É receita elegível | É despesa |
|---|---|---|---|
| `income` | ✅ Credita | ✅ Sim | ❌ |
| `expense` (pix/debit/boleto/transfer) | ✅ Debita | ❌ | ✅ |
| `expense` (credit_card) | ❌ | ❌ | ✅ (via fatura) |
| `expense` (vr/va) | ❌ | ❌ | ✅ (via benefit) |
| `transfer_in` | ✅ Credita | ❌ | ❌ |
| `transfer_out` | ✅ Debita | ❌ | ❌ |
| `invoice_payment` | ✅ Debita | ❌ | ❌ (já contado na compra) |
| `refund` | ✅ Credita | ❌ | ❌ (anula despesa anterior) |
| `opening_balance_adj` | ✅ | ❌ | ❌ |

### 2.2 Regras de Integridade
- `amount >= 0` (sempre positivo; o tipo indica a direção)
- `paid_amount <= amount` (pagamentos parciais preservam o pendente)
- Estornos (`refund`) DEVEM referenciar `refunded_transaction_id`
- Transferências DEVEM ter `transfer_pair_id` recíproco
- Cancelamentos preservam o registro com `status = 'cancelled'`
- `competence_month` no formato `YYYY-MM` validado por CHECK

### 2.3 O que NÃO é Receita Elegível
- Transferências entre contas próprias
- Empréstimos recebidos
- Resgates de investimentos (retorno de principal)
- Créditos de VR/VA
- Saldos de abertura
- Estornos

## 3. Regras de Benefícios VR/VA

### 3.1 Segregação Total
- **REGRA INEGOCIÁVEL:** compra com VR/VA **NUNCA** diminui saldo bancário
- Movimentações de VR/VA ficam na tabela `benefit_movements`, separada de `transactions`
- Na view `v_bank_account_balances`, despesas com `payment_method IN ('vr', 'va')` são excluídas dos débitos

### 3.2 Renda e Divisão
- Créditos mensais de VR/VA **NÃO** entram na renda líquida elegível para divisão proporcional
- Despesas pagas com VR/VA aparecem em relatórios, sem duplicação com despesas bancárias

## 4. Regras de Divisão Proporcional

### 4.1 Modos de Divisão
| Cenário | Modo | Resultado |
|---|---|---|
| Ambas com renda | `proportional` | % proporcional à renda |
| Apenas uma com renda | `single_earner` | 100% / 0% |
| Ambas sem renda | `manual` | Definido manualmente |
| Não configurado | `unconfigured` | 0% / 0% |

### 4.2 Recálculos
- Durante mês ABERTO, percentuais podem ser recalculados
- Responsabilidades já LIQUIDADAS preservam `applied_a_percent` e `applied_b_percent`
- Somente responsabilidades PENDENTES podem ser recalculadas
- Cada recálculo incrementa `recalc_version`

### 4.3 Soma Exata
- `partner_a_percent + partner_b_percent = 10000` (basis points)
- `partner_a_share + partner_b_share = total_amount` (centavos)
- Arredondamentos favorecem um lado; a diferença de 1 centavo é atribuída ao partner_a

## 5. Regras de Acertos

### 5.1 Liquidação
- Um acerto só pode ter `status = 'settled'` quando existe transferência efetiva em `settlement_transfers`
- Liquidações parciais são registradas via `settled_amount`
- Acertos já liquidados são preservados quando a renda muda (percentuais ficam na responsabilidade original)
- `from_member_id != to_member_id` (CHECK constraint)

### 5.2 Rastreabilidade
- Cada transferência em `settlement_transfers` referencia a transação bancária real
- Não há liquidação sem movimentação financeira comprovada

## 6. Regras de Cartão de Crédito

### 6.1 Fluxo de Vida
1. Compra registrada em `credit_card_purchases`
2. Parcelas geradas em `credit_card_installments` vinculadas a faturas
3. Fatura fecha e muda de `open` para `closed`
4. Pagamento registrado em `invoice_payments` com transação bancária
5. Fatura muda para `paid` ou `partially_paid`

### 6.2 Regras
- Compra parcelada: `total_installments >= 1`
- Pagamento de fatura debita conta bancária, NÃO é segunda despesa
- Cartão adicional: mesmo registro `credit_cards`, campo `additional_holder_id`
- Despesas compartilhadas: campo `scope = 'shared'` na compra
- `paid_amount <= total_amount` na fatura

## 7. Regras de Investimentos e Reserva

### 7.1 Sem Dupla Contagem
- Investimento com `is_emergency_reserve = TRUE` pertence à reserva
- Patrimônio = Contas Bancárias + Investimentos (incluindo reserva, contados uma vez)
- Patrimônio Líquido = Patrimônio Bruto - Dívidas - Faturas em Aberto

### 7.2 Reserva de Emergência
- Aponta para um investimento existente via `linked_asset_id`
- Meta padrão: 12 meses de despesas essenciais
- Retiradas EXIGEM motivo registrado (CHECK constraint `reason IS NOT NULL`)
- Contribuições individuais rastreadas por `member_id`

## 8. Regras de Orçamento

### 8.1 Conjunto e Mensal
- Orçamento é do casal (household), não individual
- Limites reiniciam mensalmente (novo registro em `budget_category_limits`)
- Saldos não utilizados NÃO são transportados automaticamente
- Gastos são derivados de `transactions` confirmadas na mesma competência e categoria

### 8.2 Recorrências
- Lançamentos recorrentes geram pendências que exigem **confirmação manual**
- Não são marcados como pagos automaticamente

## 9. Regras de Fechamento

### 9.1 Imutabilidade
- Meses `closed` bloqueiam alterações em movimentações da competência
- Estornos posteriores são reconhecidos no período do estorno, sem alterar o original

### 9.2 Reaberturas
- Preservam o snapshot anterior (nova versão em `fiscal_snapshots`)
- Exigem `reopen_reason`
- Incrementam `close_version`

## 10. Regras de Dívidas

### 10.1 Separação de Componentes
- Parcelas separam `principal_amount` e `interest_amount`
- `total_amount >= principal_amount + interest_amount`

### 10.2 Saldo Remanescente
- Derivado: `original_amount - SUM(paid_principal)` das parcelas pagas

## 11. Regras de Auditoria

### 11.1 Imutabilidade
- Tabela `audit_logs` é **append-only** (Insert type no TypeScript é definido, Update é `never`)
- RLS na Tarefa 04 bloqueará UPDATE e DELETE por usuárias comuns
- Registra `old_values` e `new_values` como JSONB
- Não armazena senhas, tokens ou segredos
