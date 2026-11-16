import React from 'react';
import { AuthDemoModal } from './components/auth/AuthDemoModal';
import { AppShell } from './components/layout/AppShell';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { AcertosPage } from './pages/AcertosPage';
import { AlertasPage } from './pages/AlertasPage';
import { AuditoriaPage } from './pages/AuditoriaPage';
import { BeneficiosPage } from './pages/BeneficiosPage';
import { CartoesPage } from './pages/CartoesPage';
import { ConfiguracoesPage } from './pages/ConfiguracoesPage';
import { ContasPage } from './pages/ContasPage';
import { DashboardPage } from './pages/DashboardPage';
import { DividasPage } from './pages/DividasPage';
import { DivisaoPage } from './pages/DivisaoPage';
import { InvestimentosPage } from './pages/InvestimentosPage';
import { MetasPage } from './pages/MetasPage';
import { MovimentacoesPage } from './pages/MovimentacoesPage';
import { OrcamentoPage } from './pages/OrcamentoPage';
import { RelatoriosPage } from './pages/RelatoriosPage';
import { ReservaPage } from './pages/ReservaPage';

function PageRouter() {
  const { activePage } = useFinance();

  switch (activePage) {
    case 'dashboard':
      return <DashboardPage />;
    case 'movimentacoes':
      return <MovimentacoesPage />;
    case 'contas':
      return <ContasPage />;
    case 'cartoes':
      return <CartoesPage />;
    case 'beneficios':
      return <BeneficiosPage />;
    case 'orcamento':
      return <OrcamentoPage />;
    case 'divisao':
      return <DivisaoPage />;
    case 'acertos':
      return <AcertosPage />;
    case 'reserva':
      return <ReservaPage />;
    case 'investimentos':
      return <InvestimentosPage />;
    case 'metas':
      return <MetasPage />;
    case 'dividas':
      return <DividasPage />;
    case 'relatorios':
      return <RelatoriosPage />;
    case 'alertas':
      return <AlertasPage />;
    case 'auditoria':
      return <AuditoriaPage />;
    case 'configuracoes':
      return <ConfiguracoesPage />;
    default:
      return <DashboardPage />;
  }
}

export default function App() {
  return (
    <FinanceProvider>
      <AppShell>
        <PageRouter />
      </AppShell>
      <AuthDemoModal />
    </FinanceProvider>
  );
}
