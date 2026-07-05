import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Clock, Search, FileText, Truck, User, MapPin, Car, RefreshCw, Filter, X, CalendarDays } from "lucide-react";
import { OpenLocationButton } from "../components/LocationField";
import { differenceInDays, parseISO, format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { getDataOperacional, getTipoOperacional, STATUS_RECOLHA } from "../lib/dataOperacional";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CONTRACT_COLUMNS = [
  { key: "rascunho", label: "Lançados", color: "bg-slate-400", lightBg: "bg-slate-50" },
  { key: "em_transito", label: "Em Rota", color: "bg-blue-500", lightBg: "bg-blue-50" },
  { key: "na_obra", label: "Entregue", color: "bg-emerald-500", lightBg: "bg-emerald-50" },
  { key: "aguardando_recolha", label: "Recolha Solicitada", color: "bg-amber-500", lightBg: "bg-amber-50" },
  { key: "recolha_parcial", label: "Recolha Parcial", color: "bg-blue-500", lightBg: "bg-blue-50", virtual: true },
  { key: "devolvido_parcial", label: "Dev. Parcial", color: "bg-indigo-500", lightBg: "bg-indigo-50" },
];

const OS_COLUMNS = [
  { key: "pendente", label: "Lançadas", color: "bg-slate-400", lightBg: "bg-slate-50" },
  { key: "em_transito", label: "Em Rota", color: "bg-blue-500", lightBg: "bg-blue-50" },
  { key: "entregue", label: "Entregue", color: "bg-emerald-500", lightBg: "bg-emerald-50" },
  { key: "aguardando_recolha", label: "Recolha Solicitada", color: "bg-amber-500", lightBg: "bg-amber-50" },
  { key: "recolhida", label: "Recolhido", color: "bg-indigo-500", lightBg: "bg-indigo-50" },
];

// Gera cor automática baseada no nome do motorista
function getDriverColor(name, driversMap) {
  if (!name) return null;
  const driver = driversMap[name];
  if (driver?.cor) return driver.cor;
  // Gerar cor determinística baseada no nome
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

function DriverBadge({ name, driversMap }) {
  if (!name) return null;
  const color = getDriverColor(name, driversMap);
  return (
    <div className="flex items-center gap-1 mt-1">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-medium truncate" style={{ color }}>{name}</span>
    </div>
  );
}

function ContractCard({ contract, drivers, vehicles, driversMap, onAssignDriver, onAssignVehicle, currentUser }) {
  const emRecolha = STATUS_RECOLHA.includes(contract.status);
  // Data operacional: centralizada — recolha → data_recolha; entrega → data_prevista_termino
  const dataOperacional = emRecolha
    ? getDataOperacional(contract)
    : contract.data_prevista_termino;
  const daysLeft = dataOperacional
    ? differenceInDays(parseISO(dataOperacional), new Date()) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;
  const isNearExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 2;
  const isAdmin = ["admin", "Admin"].includes(currentUser?.role || "");
  const canChangeDriver = isAdmin || !contract.motorista_entrega || currentUser?.full_name === contract.motorista_entrega;

  const endereco = contract.endereco_entrega || contract.obra_endereco || "";
  const parts = endereco.split(",").map(s => s.trim());
  const bairro = parts[1] || "";
  const cidade = parts[2] || "";
  const driverColor = contract.motorista_recolha
    ? getDriverColor(contract.motorista_recolha, driversMap)
    : contract.motorista_entrega ? getDriverColor(contract.motorista_entrega, driversMap) : null;

  // Saldo de itens para recolha parcial
  const itensSaldo = (contract.itens || []).map(item => {
    const restante = (item.quantidade_retirada || 0) - (item.quantidade_devolvida || 0);
    return restante > 0 ? { nome: item.equipamento_nome, restante } : null;
  }).filter(Boolean);

  return (
    <Card className={cn(
      "border-0 shadow-sm hover:shadow-md transition-all",
      isOverdue && "ring-2 ring-red-300",
      isNearExpiry && "ring-2 ring-amber-300"
    )}
      style={driverColor ? { borderLeft: `3px solid ${driverColor}` } : {}}
    >
      <CardContent className="p-3">
        <Link to={`/contratos/${contract.id}`} className="block">
          <div className="flex items-start justify-between mb-1">
            <div className="min-w-0">
              <p className="font-semibold text-xs truncate">{contract.client_nome}</p>
              <p className="text-[10px] text-muted-foreground">#{contract.numero || "—"}</p>
              {contract.recolha_parcial_pendente && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 inline-block mt-0.5">
                  🔄 Recolha Parcial Pendente
                </span>
              )}
            </div>
            {daysLeft !== null && (
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                isOverdue ? "bg-red-100 text-red-700" :
                isNearExpiry ? "bg-amber-100 text-amber-700" :
                "bg-muted text-muted-foreground"
              )}>
                {isOverdue ? `${Math.abs(daysLeft)}d atrás` : `${daysLeft}d`}
              </span>
            )}
          </div>
          {endereco && (
            <div className="flex items-start gap-1 text-[10px] text-muted-foreground mb-1">
              <MapPin className="w-2.5 h-2.5 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="truncate">{parts[0]}</p>
                {(bairro || cidade) && <p className="truncate">{[bairro, cidade].filter(Boolean).join(" — ")}</p>}
              </div>
            </div>
          )}
          <OpenLocationButton location={contract} className="mb-1" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><DollarSign className="w-2.5 h-2.5" />R$ {(contract.valor_total || 0).toLocaleString("pt-BR")}</span>
            {dataOperacional && (
              <span className="flex items-center gap-1" title={emRecolha ? "Data de recolha agendada" : "Data prevista de término"}>
                <Clock className="w-2.5 h-2.5" />{format(parseISO(dataOperacional), "dd/MM")}
                {emRecolha && <span className="text-amber-600">↩</span>}
              </span>
            )}
          </div>
        </Link>

        <DriverBadge name={contract.motorista_recolha || contract.motorista_entrega} driversMap={driversMap} />

        {/* Saldo restante (apenas em recolha parcial) */}
        {contract.recolha_parcial_pendente && itensSaldo.length > 0 && (
          <div className="mt-1.5 p-1.5 rounded-lg bg-blue-50 border border-blue-100">
            <p className="text-[9px] font-bold text-blue-600 uppercase mb-1">Restante a recolher:</p>
            {itensSaldo.map((it, i) => (
              <div key={i} className="flex justify-between text-[9px] text-blue-700">
                <span className="truncate">{it.nome}</span>
                <span className="font-bold ml-1 shrink-0">{it.restante} un</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-dashed border-border/50 space-y-1.5">
          {canChangeDriver ? (
            <>
              <Select value={contract.motorista_recolha || contract.motorista_entrega || ""} onValueChange={(v) => onAssignDriver(contract.id, v, "contract")}>
                <SelectTrigger className="h-6 text-[10px] border-0 bg-muted/50 px-2">
                  <User className="w-2.5 h-2.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Atribuir motorista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sem motorista</SelectItem>
                  {drivers.map((d) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={contract.veiculo_entrega || ""} onValueChange={(v) => onAssignVehicle(contract.id, v, "contract")}>
                <SelectTrigger className="h-6 text-[10px] border-0 bg-muted/50 px-2">
                  <Car className="w-2.5 h-2.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Atribuir veículo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sem veículo</SelectItem>
                  {vehicles.map((v) => <SelectItem key={v.id} value={v.placa}>{v.placa} — {v.modelo}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground text-center py-0.5">🔒 Apenas motorista ou admin</p>
          )}
          {contract.veiculo_entrega && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Car className="w-2.5 h-2.5" /><span className="truncate">{contract.veiculo_entrega}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OSCard({ os, drivers, vehicles, driversMap, onAssignDriver, onAssignVehicle, currentUser }) {
  const isAdmin = ["admin", "Admin"].includes(currentUser?.role || "");
  const canChangeDriver = isAdmin || !os.motorista_entrega || currentUser?.full_name === os.motorista_entrega;
  const isTroca = os.tipo_os === "troca_cacamba";

  const endereco = os.local_entrega || "";
  const parts = endereco.split(",").map(s => s.trim());
  const bairro = parts[1] || "";
  const cidade = parts[2] || "";
  const driverColor = os.motorista_entrega ? getDriverColor(os.motorista_entrega, driversMap) : null;

  return (
    <Card
      className={cn("border-0 shadow-sm hover:shadow-md transition-all", isTroca && "ring-2 ring-purple-300")}
      style={driverColor ? { borderLeft: `3px solid ${driverColor}` } : {}}
    >
      <CardContent className="p-3">
        <Link to={`/ordens-servico/${os.id}`} className="block">
          <div className="flex items-start justify-between mb-1 gap-1">
            <div className="min-w-0">
              <p className="font-semibold text-xs truncate">{os.client_nome}</p>
              <p className="text-[10px] text-muted-foreground">#{os.numero || "—"}</p>
            </div>
            {isTroca && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 whitespace-nowrap shrink-0">
                🔄 Troca
              </span>
            )}
          </div>
          <div className="flex items-start gap-1 text-[10px] text-muted-foreground mb-1">
            <MapPin className="w-2.5 h-2.5 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate">{parts[0] || "—"}</p>
              {(bairro || cidade) && <p className="truncate">{[bairro, cidade].filter(Boolean).join(" — ")}</p>}
            </div>
          </div>
          <OpenLocationButton location={os} className="mb-1" />
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <DollarSign className="w-2.5 h-2.5" />R$ {(os.valor || 0).toLocaleString("pt-BR")}
          </div>
        </Link>

        <DriverBadge name={os.motorista_entrega} driversMap={driversMap} />

        <div className="mt-2 pt-2 border-t border-dashed border-border/50 space-y-1.5">
          {canChangeDriver ? (
            <>
              <Select value={os.motorista_entrega || ""} onValueChange={(v) => onAssignDriver(os.id, v, "os")}>
                <SelectTrigger className="h-6 text-[10px] border-0 bg-muted/50 px-2">
                  <User className="w-2.5 h-2.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Atribuir motorista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sem motorista</SelectItem>
                  {drivers.map((d) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={os.veiculo_entrega || ""} onValueChange={(v) => onAssignVehicle(os.id, v, "os")}>
                <SelectTrigger className="h-6 text-[10px] border-0 bg-muted/50 px-2">
                  <Car className="w-2.5 h-2.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Atribuir veículo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sem veículo</SelectItem>
                  {vehicles.map((v) => <SelectItem key={v.id} value={v.placa}>{v.placa} — {v.modelo}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground text-center py-0.5">🔒 Apenas motorista ou admin</p>
          )}
          {os.veiculo_entrega && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Car className="w-2.5 h-2.5" /><span className="truncate">{os.veiculo_entrega}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Kanban() {
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
  // loading=false de imediato — página abre instantaneamente, dados chegam em background
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState("ambos");
  const [search, setSearch] = useState("");
  const [filterMotorista, setFilterMotorista] = useState("todos");
  const [filterVeiculo, setFilterVeiculo] = useState("todos");
  const [filterCidade, setFilterCidade] = useState("");
  const [filterBairro, setFilterBairro] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const [filterDateFrom, setFilterDateFrom] = useState(today);
  const [filterDateTo, setFilterDateTo] = useState(today);
  const [filterCliente, setFilterCliente] = useState("");
  const [filterStatus, setFilterStatus] = useState(["rascunho", "aguardando_recolha", "recolha_parcial"]);

  const load = () => {
    setDataLoading(true);
    base44.auth.me().then(setCurrentUser).catch(() => {});
    // Carrega contratos e OS primeiro (dados principais) — exibe imediatamente
    Promise.all([
      base44.entities.Contract.list("-created_date", 300),
      base44.entities.ServiceOrder.list("-created_date", 300),
      base44.entities.Driver.list(),
      base44.entities.Vehicle.filter({ status: "ativo" }),
    ]).then(([c, o, d, v]) => {
      setContracts(c);
      setOrders(o);
      setDrivers(d.filter((dr) => dr.status === "ativo"));
      setVehicles(v);
      setDataLoading(false);
      // Clientes em background para enriquecer o mapa de busca
      base44.entities.Client.list("-created_date", 1000).catch(() => []).then(clientes => {
        const mapa = {};
        (clientes || []).forEach(cl => { if (cl.id) mapa[cl.id] = cl; });
        setClientesMap(mapa);
      });
    });
  };

  useEffect(() => { load(); }, []);

  // Map nome → driver object para cores
  const driversMap = Object.fromEntries(drivers.map((d) => [d.nome, d]));

  const handleAssignDriver = async (id, driverName, type) => {
    if (type === "contract") {
      await base44.entities.Contract.update(id, { motorista_entrega: driverName });
      setContracts((prev) => prev.map((c) => c.id === id ? { ...c, motorista_entrega: driverName } : c));
    } else {
      await base44.entities.ServiceOrder.update(id, { motorista_entrega: driverName });
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, motorista_entrega: driverName } : o));
    }
    toast.success(driverName ? `Motorista "${driverName}" atribuído!` : "Motorista removido.");
  };

  const handleAssignVehicle = async (id, placa, type) => {
    if (type === "contract") {
      await base44.entities.Contract.update(id, { veiculo_entrega: placa });
      setContracts((prev) => prev.map((c) => c.id === id ? { ...c, veiculo_entrega: placa } : c));
    } else {
      await base44.entities.ServiceOrder.update(id, { veiculo_entrega: placa });
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, veiculo_entrega: placa } : o));
    }
    toast.success(placa ? `Veículo "${placa}" atribuído!` : "Veículo removido.");
  };

  const resetToToday = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterCliente("");
    setFilterCidade("");
    setFilterBairro("");
    setFilterMotorista("todos");
    setFilterVeiculo("todos");
    setFilterStatus([]);
    setSearch("");
  };

  const filterToday = () => {
    const t = format(new Date(), "yyyy-MM-dd");
    setFilterDateFrom(t);
    setFilterDateTo(t);
  };

  const toggleStatus = (s) => setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const applyFilters = (list) =>
    list.filter((c) => {
      const q = search.trim().toLowerCase();
      const clienteData = clientesMap[c.client_id];
      const clientCodigo = clienteData ? String(clienteData.codigo_cliente || "").toLowerCase() : "";
      const clientNomeExtra = clienteData ? String(clienteData.nome_razao_social || clienteData.fantasia || "").toLowerCase() : "";
      const matchSearch = !q ||
        (c.client_nome || "").toLowerCase().includes(q) ||
        String(c.numero || "").toLowerCase().includes(q) ||
        (clientCodigo && clientCodigo.includes(q)) ||
        (clientNomeExtra && clientNomeExtra.includes(q));
      const matchCliente = !filterCliente || (c.client_nome || "").toLowerCase().includes(filterCliente.toLowerCase());
      const matchMotorista = filterMotorista === "todos" || c.motorista_entrega === filterMotorista || (filterMotorista === "sem_motorista" && !c.motorista_entrega);
      const matchVeiculo = filterVeiculo === "todos" || c.veiculo_entrega === filterVeiculo || (filterVeiculo === "sem_veiculo" && !c.veiculo_entrega);
      const endereco = (c.endereco_entrega || c.local_entrega || c.obra_endereco || "").toLowerCase();
      const matchCidade = !filterCidade || endereco.includes(filterCidade.toLowerCase());
      const matchBairro = !filterBairro || endereco.includes(filterBairro.toLowerCase());
      const matchStatus = filterStatus.length === 0 || filterStatus.includes(c.status) ||
        (filterStatus.includes("recolha_parcial") && c.recolha_parcial_pendente === true);
      // Filtro de data: usa data operacional dinâmica centralizada
      let matchData = true;
      if (filterDateFrom || filterDateTo) {
        const dataRef = getDataOperacional(c) || c.data_entrega;
        if (dataRef) {
          try {
            const dateStr = String(dataRef).slice(0, 10);
            const from = filterDateFrom || null;
            const to = filterDateTo || null;
            if (from && to) matchData = dateStr >= from && dateStr <= to;
            else if (from) matchData = dateStr >= from;
            else if (to) matchData = dateStr <= to;
          } catch (_) { matchData = true; }
        }
      }
      return matchSearch && matchCliente && matchMotorista && matchVeiculo && matchCidade && matchBairro && matchStatus && matchData;
    });

  const filteredContracts = applyFilters(contracts.filter((c) => c.tipo_entrega !== "retirada_loja"));
  const filteredOrders = applyFilters(orders);

  return (
    <div>
      <PageHeader title="Logística" subtitle="Contratos e OS por status operacional">
        <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </Button>
      </PageHeader>

      {/* Legenda de motoristas */}
      {drivers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {drivers.map((d) => {
            const color = getDriverColor(d.nome, driversMap);
            return (
              <div key={d.id} className="flex items-center gap-1.5 bg-card rounded-full px-2.5 py-1 shadow-sm border text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span>{d.nome}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Linha principal */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por cliente ou número..." className="pl-10 bg-card border-0 shadow-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={filterToday} className="gap-1.5 bg-card border-0 shadow-sm">
            <CalendarDays className="w-3.5 h-3.5" /> Hoje
          </Button>
          <Button size="sm" variant={showAdvanced ? "default" : "outline"} onClick={() => setShowAdvanced(v => !v)} className="gap-1.5 shadow-sm">
            <Filter className="w-3.5 h-3.5" /> Filtros {showAdvanced ? <X className="w-3 h-3" /> : null}
          </Button>
          <div className="flex gap-2 ml-auto">
            {[
              { key: "ambos", label: "Ambos" },
              { key: "contratos", label: "Contratos" },
              { key: "os", label: "OS" },
            ].map(({ key, label }) => (
              <Button key={key} size="sm" variant={view === key ? "default" : "outline"} onClick={() => setView(key)}>{label}</Button>
            ))}
          </div>
        </div>

        {/* Banner data atual */}
        <div className="text-xs text-muted-foreground bg-card rounded-lg px-3 py-1.5 border-0 shadow-sm inline-flex items-center gap-2 self-start">
          <CalendarDays className="w-3.5 h-3.5" />
          Mostrando: <strong>
            {!filterDateFrom && !filterDateTo
              ? "Todos os registros"
              : filterDateFrom === filterDateTo
                ? filterDateFrom === today ? "Hoje" : filterDateFrom
                : `${filterDateFrom} até ${filterDateTo}`}
          </strong>
        </div>

        {/* Painel de filtros avançados */}
        {showAdvanced && (
          <div className="bg-card rounded-xl border-0 shadow-sm p-4 space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Data inicial</label>
                <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Data final</label>
                <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Cliente</label>
                <Input placeholder="Nome do cliente..." value={filterCliente} onChange={e => setFilterCliente(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Motorista</label>
                <Select value={filterMotorista} onValueChange={setFilterMotorista}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sem_motorista">Sem motorista</SelectItem>
                    {drivers.map((d) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Veículo</label>
                <Select value={filterVeiculo} onValueChange={setFilterVeiculo}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sem_veiculo">Sem veículo</SelectItem>
                    {vehicles.map((v) => <SelectItem key={v.id} value={v.placa}>{v.placa}{v.nome || v.modelo ? ` — ${v.nome || v.modelo}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Endereço</label>
                <Input placeholder="Busca parcial..." value={filterCidade} onChange={e => setFilterCidade(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Bairro</label>
                <Input placeholder="Bairro..." value={filterBairro} onChange={e => setFilterBairro(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Status (múltipla seleção)</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "rascunho", label: "Lançados" }, { key: "em_transito", label: "Em Rota" },
                  { key: "na_obra", label: "Entregue" }, { key: "aguardando_recolha", label: "Recolha Solicit." },
                  { key: "recolha_parcial", label: "🔄 Recolha Parcial" },
                  { key: "devolvido_parcial", label: "Dev. Parcial" },
                  { key: "pendente", label: "OS Pend." }, { key: "entregue", label: "OS Entregue" },
                ].map(s => (
                  <button key={s.key} onClick={() => toggleStatus(s.key)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-all ${filterStatus.includes(s.key) ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={resetToToday} className="text-xs gap-1">
                <X className="w-3 h-3" /> Limpar todos
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Skeleton loading */}
      {dataLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="rounded-2xl bg-slate-50 p-3 min-h-[160px] animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                <div className="h-2.5 bg-muted rounded w-16" />
              </div>
              <div className="space-y-2">
                {[1,2].map(j => <div key={j} className="rounded-xl bg-muted h-16" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contracts Board */}
      {!dataLoading && (view === "contratos" || view === "ambos") && (
        <div className="mb-8">
          {view === "ambos" && <div className="flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-primary" /><h2 className="font-heading font-bold text-sm uppercase tracking-wide text-primary">Contratos</h2></div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
            {CONTRACT_COLUMNS.map((col) => {
              // Coluna virtual: recolha_parcial = contratos em na_obra ou aguardando_recolha com recolha_parcial_pendente=true
              const items = col.virtual
                ? filteredContracts.filter((c) => c.recolha_parcial_pendente === true && ["na_obra", "aguardando_recolha", "devolvido_parcial"].includes(c.status))
                : filteredContracts.filter((c) => c.status === col.key && !c.recolha_parcial_pendente);
              return (
                <div key={col.key} className={cn("rounded-2xl p-3 min-h-[160px]", col.lightBg)}>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", col.color)} />
                    <span className="text-[10px] font-bold uppercase tracking-wider leading-tight">{col.label}</span>
                    <span className="ml-auto text-xs font-bold text-muted-foreground bg-white/80 px-2 py-0.5 rounded-full shrink-0">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((c) => (
                      <ContractCard key={c.id} contract={c} drivers={drivers} vehicles={vehicles} driversMap={driversMap} onAssignDriver={handleAssignDriver} onAssignVehicle={handleAssignVehicle} currentUser={currentUser} />
                    ))}
                    {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6 opacity-50">Nenhum</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OS Board */}
      {!dataLoading && (view === "os" || view === "ambos") && (
        <div>
          {view === "ambos" && <div className="flex items-center gap-2 mb-3"><Truck className="w-4 h-4 text-secondary" /><h2 className="font-heading font-bold text-sm uppercase tracking-wide text-secondary">OS Caçamba</h2></div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {OS_COLUMNS.map((col) => {
              const items = filteredOrders.filter((o) => o.status === col.key);
              return (
                <div key={col.key} className={cn("rounded-2xl p-3 min-h-[160px]", col.lightBg)}>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", col.color)} />
                    <span className="text-[10px] font-bold uppercase tracking-wider leading-tight">{col.label}</span>
                    <span className="ml-auto text-xs font-bold text-muted-foreground bg-white/80 px-2 py-0.5 rounded-full shrink-0">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((o) => (
                      <OSCard key={o.id} os={o} drivers={drivers} vehicles={vehicles} driversMap={driversMap} onAssignDriver={handleAssignDriver} onAssignVehicle={handleAssignVehicle} currentUser={currentUser} />
                    ))}
                    {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6 opacity-50">Nenhuma</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}