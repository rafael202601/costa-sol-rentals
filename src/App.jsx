import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Layout from './components/Layout';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientForm from './pages/ClientForm';
import ClientDetail from './pages/ClientDetail';
import Equipment from './pages/Equipment';
import EquipmentSerials from './pages/EquipmentSerials';
import Contracts from './pages/Contracts';
import ContractForm from './pages/ContractForm';
import ContractDetail from './pages/ContractDetail';
import ServiceOrders from './pages/ServiceOrders';
import ServiceOrderForm from './pages/ServiceOrderForm';
import ServiceOrderDetail from './pages/ServiceOrderDetail';
import Kanban from './pages/Kanban';
import Reports from './pages/Reports';
import Calendar from './pages/Calendar';
import Goals from './pages/Goals';
import Users from './pages/Users';
import CashFlow from './pages/CashFlow';
import ClientPortal from './pages/ClientPortal';
import Drivers from './pages/Drivers';
import DriverPanel from './pages/DriverPanel';
import Quotes from './pages/Quotes';
import Settings from './pages/Settings';
import ActivityLogs from './pages/ActivityLogs';
import Vehicles from './pages/Vehicles';
import Announcements from './pages/Announcements';
import Products from './pages/Products';
import Sales from './pages/Sales';
import TasksDay from './pages/TasksDay';
import FeedbackAdmin from './pages/FeedbackAdmin';
import MigrationFix from './pages/MigrationFix';

const queryClient = new QueryClient();

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  const isPublicRoute = window.location.pathname === '/privacy';
  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/privacy" element={<PrivacyPolicy />} />
      </Routes>
    );
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route element={<Layout />}>
        <Route path="/"                            element={<Dashboard />} />
        <Route path="/clientes"                    element={<Clients />} />
        <Route path="/clientes/novo"               element={<ClientForm />} />
        <Route path="/clientes/:id"                element={<ClientForm />} />
        <Route path="/clientes/ver/:id"            element={<ClientDetail />} />
        <Route path="/equipamentos"                element={<Equipment />} />
        <Route path="/seriais"                     element={<EquipmentSerials />} />
        <Route path="/contratos"                   element={<Contracts />} />
        <Route path="/contratos/novo"              element={<ContractForm />} />
        <Route path="/contratos/editar/:id"        element={<ContractForm />} />
        <Route path="/contratos/:id"               element={<ContractDetail />} />
        <Route path="/ordens-servico"              element={<ServiceOrders />} />
        <Route path="/ordens-servico/nova"         element={<ServiceOrderForm />} />
        <Route path="/ordens-servico/editar/:id"   element={<ServiceOrderForm />} />
        <Route path="/ordens-servico/:id"          element={<ServiceOrderDetail />} />
        <Route path="/kanban"                      element={<Kanban />} />
        <Route path="/relatorios"                  element={<Reports />} />
        <Route path="/calendario"                  element={<Calendar />} />
        <Route path="/metas"                       element={<Goals />} />
        <Route path="/usuarios"                    element={<Users />} />
        <Route path="/fluxo-caixa"                 element={<CashFlow />} />
        <Route path="/portal-cliente"              element={<ClientPortal />} />
        <Route path="/motoristas"                  element={<Drivers />} />
        <Route path="/painel-motorista"            element={<DriverPanel />} />
        <Route path="/orcamentos"                  element={<Quotes />} />
        <Route path="/configuracoes"               element={<Settings />} />
        <Route path="/logs"                        element={<ActivityLogs />} />
        <Route path="/veiculos"                    element={<Vehicles />} />
        <Route path="/anuncios"                    element={<Announcements />} />
        <Route path="/produtos"                    element={<Products />} />
        <Route path="/vendas"                      element={<Sales />} />
        <Route path="/tarefas"                     element={<TasksDay />} />
        <Route path="/feedbacks"                   element={<FeedbackAdmin />} />
        <Route path="/migracao-correcao"           element={<MigrationFix />} />
        <Route path="*"                            element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;