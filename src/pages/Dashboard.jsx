import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import {
  FileText, Truck, Users, AlertTriangle,
  ArrowRight, Package, RefreshCw
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { differenceInDays, parseISO } from "date-fns";

const CACHE_KEY = "dashboard_cache";

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Cache válido apenas dentro do mesmo dia
    const today = new Date().toDateString();
    if (parsed.date !== today) return null;
    return parsed;
  } catch { return null; }
}

function setCache(data) {
  try {
    const today = new Date().toDateString();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, date: today }));
  } catch {}
}

function StatCard({ icon: Icon, label, value, color, to }) {
  return (
    <Link to={to}>
      <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer group border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-3xl font-heading font-bold mt-1">{value}</p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function AlertRow({ contract }) {
  const daysLeft = differenceInDays(parseISO(contract.data_prevista_termino), new Date());
  const isOverdue = daysLeft < 0;

  return (
    <div className={`flex items-center justify-between p-3 rounded-xl ${isOverdue ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{contract.client_nome}</p>
        <p className="text-xs text-muted-foreground">Contrato #{contract.numero}</p>
      </div>
      <div className="flex items-center gap-2 ml-3">
        <span className={`text-xs font-bold ${isOverdue ? "text-red-600" : "text-amber-600"}`}>
          {isOverdue ? `${Math.abs(daysLeft)}d vencido` : `${daysLeft}d restantes`}
        </span>
        <Link to={`/contratos/${contract.id}`}>
          <ArrowRight className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </Link>
      </div>
    </div>
  );
}

function RecentActivity({ contracts, orders }) {
  const items = [
    ...contracts.slice(0, 3).map(c => ({
      type: "contract",
      title: `Contrato #${c.numero} - ${c.client_nome}`,
      status: c.status,
      date: c.updated_date || c.created_date,
      link: `/contratos/${c.id}`
    })),
    ...orders.slice(0, 3).map(o => ({
      type: "os",
      title: `OS #${o.numero} - ${o.client_nome}`,
      status: o.status,
      date: o.updated_date || o.created_date,
      link: `/ordens-servico/${o.id}`
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-6">
        <h3 className="font-heading font-bold text-lg mb-4">Atividade Recente</h3>
        <div className="space-y-3">
          {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>}
          {items.map((item, i) => (
            <Link key={i} to={item.link} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                {item.type === "contract" ? (
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <Truck className="w-4 h-4 text-secondary shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{item.title}</span>
              </div>
              <StatusBadge status={item.status} />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [clientCount, setClientCount] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [initialized, setInitialized] = useState(false);

  const loadData = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCache();
      if (cached) {
        setClientCount(cached.clientCount);
        setContracts(cached.contracts || []);
        setOrders(cached.orders || []);
        setEquipment(cached.equipment || []);
        setLastUpdated(cached.lastUpdated);
        setInitialized(true);
        return;
      }
    }

    setLoading(true);

    const [countRes, ct, os, eq] = await Promise.all([
      base44.functions.invoke("countClients", {}).catch(() => null),
      base44.entities.Contract.list("-created_date", 50),
      base44.entities.ServiceOrder.list("-created_date", 50),
      base44.entities.Equipment.list(),
    ]);

    const total = countRes?.data?.total;
    const count = typeof total === "number" ? total.toLocaleString("pt-BR") : "Erro";
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    setClientCount(count);
    setContracts(ct);
    setOrders(os);
    setEquipment(eq);
    setLastUpdated(now);

    setCache({ clientCount: count, contracts: ct, orders: os, equipment: eq, lastUpdated: now });

    setLoading(false);
    setInitialized(true);
  }, []);

  // Carrega do cache na primeira abertura — sem requisição automática
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const handleRefresh = () => loadData(true);

  const activeContracts = contracts.filter(c => !["finalizado", "cancelado", "rascunho"].includes(c.status));

  const alerts = contracts.filter(c => {
    if (["finalizado", "cancelado"].includes(c.status) || !c.data_prevista_termino) return false;
    const daysLeft = differenceInDays(parseISO(c.data_prevista_termino), new Date());
    return daysLeft <= 2;
  }).sort((a, b) => parseISO(a.data_prevista_termino) - parseISO(b.data_prevista_termino));

  const activeOrders = orders.filter(o => !["finalizada", "cancelada", "recolhida"].includes(o.status));

  if (!initialized && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground text-sm">Nenhum dado em cache.</p>
        <Button onClick={handleRefresh} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Carregar Painel
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Painel de Controle" subtitle="Visão geral das operações">
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Atualizado: {lastUpdated}
            </span>
          )}
          <Button variant="outline" onClick={handleRefresh} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Atualizando..." : "Atualizar Painel"}
          </Button>
        </div>
      </PageHeader>

      {loading && !initialized && (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={Users} label="Clientes" value={clientCount ?? "..."} color="bg-primary" to="/clientes" />
        <StatCard icon={FileText} label="Contratos Ativos" value={activeContracts.length} color="bg-emerald-500" to="/contratos" />
        <StatCard icon={Truck} label="OS Ativas" value={activeOrders.length} color="bg-secondary" to="/ordens-servico" />
      </div>

      {/* Equipment Stock Overview */}
      {equipment.length > 0 && (
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-bold text-lg">Giro de Estoque</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "disponivel", label: "No Pátio", color: "bg-emerald-50 text-emerald-700" },
                { key: "alugado", label: "Na Rua", color: "bg-blue-50 text-blue-700" },
                { key: "manutencao", label: "Manutenção", color: "bg-amber-50 text-amber-700" },
              ].map(({ key, label, color }) => (
                <div key={key} className={`rounded-xl p-4 text-center ${color}`}>
                  <p className="text-3xl font-bold font-heading">{equipment.filter((e) => (e.status_item || "disponivel") === key).length}</p>
                  <p className="text-xs font-semibold mt-1">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-heading font-bold text-lg">Alertas de Vencimento</h3>
            </div>
            <div className="space-y-2">
              {alerts.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum alerta no momento ✓</p>
              )}
              {alerts.map((c) => (
                <AlertRow key={c.id} contract={c} />
              ))}
            </div>
          </CardContent>
        </Card>

        <RecentActivity contracts={contracts} orders={orders} />
      </div>
    </div>
  );
}