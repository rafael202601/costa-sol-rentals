import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, FileText, Truck, MapPin, Package,
  User, Car, AlertTriangle, CheckCircle2, Filter, X, Search, ArrowLeftRight, CalendarDays
} from "lucide-react";
import { OpenLocationButton } from "../components/LocationField";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, parseISO, addMonths, subMonths, getDay, isWithinInterval
} from "date-fns";
import { getDataOperacional, STATUS_RECOLHA } from "../lib/dataOperacional";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import RescheduleModal from "../components/calendar/RescheduleModal";

// ─── Status que BLOQUEIAM o drag ─────────────────────────────────────────────
const BLOQUEADOS_ENTREGA = ["na_obra", "devolvido_parcial", "devolvido_pendente", "finalizado", "cancelado", "entregue", "recolhida", "finalizada", "cancelada"];
const BLOQUEADOS_RECOLHA = ["finalizado", "cancelado", "finalizada", "cancelada"];

// ─── Cores por status ──────────────────────────────────────────────────────
const statusColors = {
  rascunho: "bg-slate-200 text-slate-700 border-slate-300",
  em_transito: "bg-blue-200 text-blue-800 border-blue-300",
  na_obra: "bg-emerald-200 text-emerald-800 border-emerald-300",
  aguardando_recolha: "bg-amber-200 text-amber-800 border-amber-300",
  devolvido_parcial: "bg-indigo-200 text-indigo-800 border-indigo-300",
  devolvido_pendente: "bg-purple-200 text-purple-800 border-purple-300",
  finalizado: "bg-slate-100 text-slate-500 border-slate-200",
  cancelado: "bg-red-100 text-red-500 border-red-200",
  pendente: "bg-slate-200 text-slate-700 border-slate-300",
  em_transito_os: "bg-blue-200 text-blue-800 border-blue-300",
  entregue: "bg-emerald-200 text-emerald-800 border-emerald-300",
  aguardando_recolha_os: "bg-amber-200 text-amber-800 border-amber-300",
  recolhida: "bg-indigo-200 text-indigo-800 border-indigo-300",
  finalizada: "bg-slate-100 text-slate-500 border-slate-200",
  cancelada: "bg-red-100 text-red-500 border-red-200",
};

function getStatusColor(status) {
  return statusColors[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

// ─── Modal motorista + veículo (recolha: opcionais; entrega: obrigatórios) ──
function DriverVehicleModal({ open, tipo, drivers, vehicles, onConfirm, onCancel }) {
  const [motorista, setMotorista] = useState("");
  const [veiculo, setVeiculo] = useState("");

  useEffect(() => {
    if (open) { setMotorista(""); setVeiculo(""); }
  }, [open]);

  const isRecolha = tipo === "recolha";
  // Motorista e veículo sempre opcionais — podem ser definidos depois pela logística
  const podeConfirmar = true;

  const titulo = isRecolha ? "Reagendar Recolha" : "Reagendar Entrega";
  const descricao = "Motorista e veículo são opcionais — podem ser definidos depois pela logística.";

  return (
    <Dialog open={open} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Truck className="w-5 h-5 text-primary" /> {titulo}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold flex items-center gap-1 mb-1.5">
              <User className="w-3.5 h-3.5" /> Motorista <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Select value={motorista} onValueChange={setMotorista}>
              <SelectTrigger>
                <SelectValue placeholder="Definir depois pela logística..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__sem_motorista__">— Definir depois —</SelectItem>
                {drivers.filter(d => d.status === "ativo").map(d => (
                  <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!motorista && (
              <p className="text-[10px] text-blue-600 mt-1">ℹ Ficará como "Aguardando Logística" até motorista ser definido</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold flex items-center gap-1 mb-1.5">
              <Car className="w-3.5 h-3.5" /> Veículo <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Select value={veiculo} onValueChange={setVeiculo}>
              <SelectTrigger>
                <SelectValue placeholder="Definir depois pela logística..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__sem_veiculo__">— Definir depois —</SelectItem>
                {vehicles.filter(v => v.status === "ativo").map(v => (
                  <SelectItem key={v.id} value={v.placa}>
                    {v.modelo} — {v.placa}
                  </SelectItem>
                ))}
                {vehicles.length === 0 && drivers.filter(d => d.placa).map(d => (
                  <SelectItem key={d.id} value={d.placa}>
                    {d.veiculo || d.nome} — {d.placa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {motorista && motorista !== "__sem_motorista__" && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Motorista: <strong>{motorista}</strong>{veiculo && veiculo !== "__sem_veiculo__" ? ` · ${veiculo}` : ""}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            onClick={() => onConfirm({
              motorista: motorista === "__sem_motorista__" ? "" : motorista,
              veiculo: veiculo === "__sem_veiculo__" ? "" : veiculo,
            })}
            disabled={!podeConfirmar}
            className="gap-2"
          >
            <CheckCircle2 className="w-4 h-4" /> Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Painel de filtro avançado ────────────────────────────────────────────────
function FiltroAvancado({ open, onClose, filtros, setFiltros, drivers, vehicles }) {
  const [local, setLocal] = useState(filtros);

  useEffect(() => { setLocal(filtros); }, [filtros, open]);

  const statuses = [
    { value: "rascunho", label: "Lançado" },
    { value: "em_transito", label: "Em Rota" },
    { value: "na_obra", label: "Na Obra / Entregue" },
    { value: "aguardando_recolha", label: "Ag. Recolha" },
    { value: "devolvido_parcial", label: "Recolhido Parcial" },
    { value: "finalizado", label: "Finalizado" },
    { value: "cancelado", label: "Cancelado" },
  ];

  const aplicar = () => { setFiltros(local); onClose(); };
  const limpar = () => {
    const vazio = { tipo: "todos", status: "", motorista: "", veiculo: "", cliente: "", endereco: "", bairro: "", cidade: "", equipamento: "", obra: "", dataInicio: "", dataFim: "" };
    setLocal(vazio);
    setFiltros(vazio);
    onClose();
  };

  const f = (key, val) => setLocal(p => ({ ...p, [key]: val }));
  const ativo = Object.values(local).some(v => v && v !== "todos");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Filter className="w-4 h-4" /> Filtro Avançado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-3 gap-2">
            {[{ k: "todos", l: "Todos" }, { k: "contratos", l: "Contratos" }, { k: "os", l: "OS Caçamba" }].map(t => (
              <button
                key={t.k}
                onClick={() => f("tipo", t.k)}
                className={`py-1.5 text-xs rounded-lg border font-medium transition-colors ${local.tipo === t.k ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}
              >
                {t.l}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Status */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Status</Label>
              <Select value={local.status || "__todos__"} onValueChange={v => f("status", v === "__todos__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos</SelectItem>
                  {statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Motorista */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Motorista</Label>
              <Select value={local.motorista || "__todos__"} onValueChange={v => f("motorista", v === "__todos__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos</SelectItem>
                  <SelectItem value="__sem__">Sem motorista</SelectItem>
                  {drivers.filter(d => d.status === "ativo").map(d => (
                    <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Veículo */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Veículo</Label>
              <Select value={local.veiculo || "__todos__"} onValueChange={v => f("veiculo", v === "__todos__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos</SelectItem>
                  {vehicles.filter(v => v.status === "ativo").map(v => (
                    <SelectItem key={v.id} value={v.placa}>{v.modelo} — {v.placa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cliente */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Cliente</Label>
              <Input value={local.cliente} onChange={e => f("cliente", e.target.value)} className="h-8 text-xs" placeholder="Nome do cliente..." />
            </div>

            {/* Endereço */}
            <div className="col-span-2">
              <Label className="text-xs font-semibold mb-1 block">Endereço / Obra</Label>
              <Input value={local.endereco} onChange={e => f("endereco", e.target.value)} className="h-8 text-xs" placeholder="Rua, número, referência..." />
            </div>

            {/* Bairro */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Bairro</Label>
              <Input value={local.bairro} onChange={e => f("bairro", e.target.value)} className="h-8 text-xs" placeholder="Bairro..." />
            </div>

            {/* Cidade */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Cidade</Label>
              <Input value={local.cidade} onChange={e => f("cidade", e.target.value)} className="h-8 text-xs" placeholder="Cidade..." />
            </div>

            {/* Equipamento */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Equipamento</Label>
              <Input value={local.equipamento} onChange={e => f("equipamento", e.target.value)} className="h-8 text-xs" placeholder="Nome do equipamento..." />
            </div>

            {/* Obra */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Obra</Label>
              <Input value={local.obra} onChange={e => f("obra", e.target.value)} className="h-8 text-xs" placeholder="Nome da obra..." />
            </div>

            {/* Data intervalo */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Data início (de)</Label>
              <Input type="date" value={local.dataInicio} onChange={e => f("dataInicio", e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Data início (até)</Label>
              <Input type="date" value={local.dataFim} onChange={e => f("dataFim", e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          {ativo && (
            <Button variant="outline" onClick={limpar} className="gap-1 text-xs">
              <X className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
          <Button onClick={aplicar} className="gap-1 text-xs">
            <Search className="w-3.5 h-3.5" /> Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Filtro de contratos/OS ───────────────────────────────────────────────────
function matchItem(item, filtros, tipo) {
  const f = filtros;
  if (!f) return true;

  // status
  if (f.status && item.status !== f.status) return false;

  // cliente
  if (f.cliente) {
    const nome = (item.client_nome || "").toLowerCase();
    if (!nome.includes(f.cliente.toLowerCase())) return false;
  }

  // motorista
  if (f.motorista) {
    if (f.motorista === "__sem__") {
      const mot = tipo === "contrato" ? (item.motorista_entrega || item.motorista_recolha) : (item.motorista_entrega || item.motorista_recolhimento);
      if (mot) return false;
    } else {
      const mot = tipo === "contrato"
        ? (item.motorista_entrega || item.motorista_recolha || "")
        : (item.motorista_entrega || item.motorista_recolhimento || "");
      if (!mot.toLowerCase().includes(f.motorista.toLowerCase())) return false;
    }
  }

  // veículo
  if (f.veiculo) {
    const veic = (item.veiculo_entrega || "").toLowerCase();
    if (!veic.includes(f.veiculo.toLowerCase())) return false;
  }

  // endereço
  if (f.endereco) {
    const end = tipo === "contrato"
      ? (item.endereco_entrega || item.obra_endereco || "").toLowerCase()
      : (item.local_entrega || "").toLowerCase();
    if (!end.includes(f.endereco.toLowerCase())) return false;
  }

  // bairro/cidade — busca no endereço completo
  if (f.bairro) {
    const end = (item.endereco_entrega || item.local_entrega || item.obra_endereco || "").toLowerCase();
    if (!end.includes(f.bairro.toLowerCase())) return false;
  }
  if (f.cidade) {
    const end = (item.endereco_entrega || item.local_entrega || item.obra_endereco || "").toLowerCase();
    if (!end.includes(f.cidade.toLowerCase())) return false;
  }

  // obra
  if (f.obra) {
    const obra = (item.obra_nome || "").toLowerCase();
    if (!obra.includes(f.obra.toLowerCase())) return false;
  }

  // equipamento (apenas contratos)
  if (f.equipamento && tipo === "contrato") {
    const itens = (item.itens || []);
    const temEquip = itens.some(it => (it.equipamento_nome || "").toLowerCase().includes(f.equipamento.toLowerCase()));
    if (!temEquip) return false;
  }

  // intervalo de data
  if (f.dataInicio || f.dataFim) {
    const dataItem = tipo === "contrato" ? item.data_inicio : (item.data_entrega ? item.data_entrega.split("T")[0] : null);
    if (!dataItem) return false;
    if (f.dataInicio && dataItem < f.dataInicio) return false;
    if (f.dataFim && dataItem > f.dataFim) return false;
  }

  return true;
}

const FILTROS_VAZIOS = {
  tipo: "todos", status: "", motorista: "", veiculo: "", cliente: "",
  endereco: "", bairro: "", cidade: "", equipamento: "", obra: "",
  dataInicio: "", dataFim: ""
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  // loading=false de imediato — página abre instantaneamente, dados chegam em background
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(new Date());

  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [showFiltro, setShowFiltro] = useState(false);
  const [busca, setBusca] = useState("");
  const [somentLogistica, setSomenteLogistica] = useState(true);
  // mapa clientId → { codigo_cliente, nome } para busca por código
  const [clientesMap, setClientesMap] = useState({});

  // drag state
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragRef = useRef(null);

  // modal state
  const [pendingDrop, setPendingDrop] = useState(null);
  // modal reagendamento manual (mobile/touch)
  const [rescheduleEvent, setRescheduleEvent] = useState(null);

  const load = async () => {
    setDataLoading(true);
    // Carrega contratos, OS, motoristas e veículos primeiro — exibe imediatamente
    const [c, o, d, v] = await Promise.all([
      base44.entities.Contract.list("-created_date", 500),
      base44.entities.ServiceOrder.list("-created_date", 500),
      base44.entities.Driver.list("-created_date"),
      base44.entities.Vehicle.list("-created_date").catch(() => []),
    ]);
    setContracts(c);
    setOrders(o);
    setDrivers(d);
    setVehicles(v);
    setDataLoading(false);
    // Clientes em background para enriquecer a busca por código
    base44.entities.Client.list("-created_date", 1000).catch(() => []).then(clientes => {
      const mapa = {};
      (clientes || []).forEach(cl => { if (cl.id) mapa[cl.id] = cl; });
      setClientesMap(mapa);
    });
  };

  useEffect(() => { load(); }, []);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(startOfMonth(currentMonth));

  // ─── Filtros ativos count ────────────────────────────────────────────────
  const filtrosAtivos = Object.entries(filtros).filter(([k, v]) => v && v !== "todos" && k !== "tipo").length
    + (filtros.tipo !== "todos" ? 1 : 0);

  // ─── Busca rápida: contrato nº, OS nº, código cliente, nome cliente ──────
  const buscaAtiva = busca.trim().length >= 1;
  const matchBusca = (item) => {
    if (!buscaAtiva) return true;
    const q = busca.trim().toLowerCase();

    // número do contrato/OS — busca parcial (ex: "102", "10245", "OS-4587")
    const numero = String(item.numero || "").toLowerCase();
    const numeroSemPrefixo = numero.replace(/^os[-\s]*/i, "").trim();

    // nome do cliente gravado direto no contrato/OS
    const clientNome = String(item.client_nome || "").toLowerCase();

    // código do cliente via mapa carregado (Client.codigo_cliente)
    const clienteData = clientesMap[item.client_id];
    const clientCodigo = clienteData ? String(clienteData.codigo_cliente || "").toLowerCase() : "";
    const clientNomeExtra = clienteData ? String(clienteData.nome_razao_social || clienteData.fantasia || "").toLowerCase() : "";

    return (
      numero.includes(q) ||
      numeroSemPrefixo.includes(q) ||
      clientNome.includes(q) ||
      (clientCodigo && clientCodigo.includes(q)) ||
      (clientNomeExtra && clientNomeExtra.includes(q))
    );
  };

  // ─── Contratos/OS filtrados ──────────────────────────────────────────────
  const filtroTipo = filtros.tipo || "todos";
  // Retirada na loja NÃO entra no calendário logístico
  // "Somente logística" também filtra contratos sem entrega logística (sem data_inicio ou sem nenhum indicativo de rota)
  const contratosFiltrados = filtroTipo === "os" ? [] : contracts.filter(c => {
    if (c.tipo_entrega === "retirada_loja") return false;
    if (somentLogistica) {
      // Ocultar contratos cancelados/finalizados sem atividade logística pendente
      if (["finalizado", "cancelado"].includes(c.status)) return false;
    }
    return matchItem(c, filtros, "contrato") && matchBusca(c);
  });
  const ordersFiltradas = filtroTipo === "contratos" ? [] : orders.filter(o => {
    if (somentLogistica && ["finalizada", "cancelada", "recolhida"].includes(o.status)) return false;
    return matchItem(o, filtros, "os") && matchBusca(o);
  });



  // ─── canDragEvent ────────────────────────────────────────────────────────
  const canDragEvent = (ev) => {
    if (ev.draggableType === "contract_start") {
      const c = contracts.find(x => x.id === ev.draggableId);
      return c && !BLOQUEADOS_ENTREGA.includes(c.status);
    }
    if (ev.draggableType === "contract_end") {
      const c = contracts.find(x => x.id === ev.draggableId);
      return c && ["aguardando_recolha", "devolvido_parcial", "devolvido_pendente"].includes(c.status);
    }
    if (ev.draggableType === "os_entrega") {
      const o = orders.find(x => x.id === ev.draggableId);
      return o && !BLOQUEADOS_ENTREGA.includes(o.status);
    }
    if (ev.draggableType === "os_recolha") {
      const o = orders.find(x => x.id === ev.draggableId);
      return o && !BLOQUEADOS_RECOLHA.includes(o.status) && o.status === "aguardando_recolha";
    }
    return false;
  };

  // ─── Montar eventos por dia ──────────────────────────────────────────────
  const getEventsForDay = (day) => {
    const events = [];

    const STATUS_RECOLHA_CONTRATO = ["aguardando_recolha", "devolvido_parcial", "devolvido_pendente"];
    const STATUS_OCULTAR_CONTRATO = ["finalizado", "cancelado"];
    const STATUS_RECOLHA_OS = ["aguardando_recolha"];
    const STATUS_OCULTAR_OS = ["recolhida", "finalizada", "cancelada"];

    // Normaliza qualquer formato de data para yyyy-MM-dd para parseISO seguro
    const toISO = (d) => {
      if (!d) return "";
      const s = String(d).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      if (s.includes("T")) return s.split("T")[0];
      if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const [dd, mm, yyyy] = s.split("/"); return `${yyyy}-${mm}-${dd}`; }
      return "";
    };

    contratosFiltrados.forEach((c) => {
      // devolvido_parcial sem recolha_parcial_pendente = não precisa aparecer no calendário de recolha
      if (c.status === "devolvido_parcial" && !c.recolha_parcial_pendente) return;
      if (STATUS_OCULTAR_CONTRATO.includes(c.status)) return;
      const isRecolha = STATUS_RECOLHA_CONTRATO.includes(c.status);
      if (isRecolha) {
        // Para recolha: data_recolha é a fonte de verdade (salvo em ContractDetail)
        // Fallback: data_prevista_termino → hoje (para não sumir do calendário)
        const dataRecolhaRaw = toISO(c.data_recolha)
          || toISO(c.data_prevista_termino)
          || format(new Date(), "yyyy-MM-dd");
        if (dataRecolhaRaw && isSameDay(parseISO(dataRecolhaRaw), day)) {
          const isParcial = c.recolha_parcial_pendente === true;
          events.push({
            type: "termino",
            label: isParcial ? `🔄 Recolha Parcial #${c.numero || "—"}` : `↩ Recolha #${c.numero || "—"}`,
            client: c.client_nome,
            status: c.status,
            id: c.id + "_end",
            contractId: c.id,
            link: `/contratos/${c.id}`,
            draggableId: c.id,
            draggableType: "contract_end",
            data: c,
            semMotorista: !c.motorista_recolha,
            isParcial,
          });
        }
      } else {
        const dataEntrega = toISO(c.data_inicio);
        if (dataEntrega && isSameDay(parseISO(dataEntrega), day)) {
          events.push({
            type: "contrato",
            label: `Contrato #${c.numero || "—"}`,
            client: c.client_nome,
            status: c.status,
            id: c.id + "_start",
            contractId: c.id,
            link: `/contratos/${c.id}`,
            draggableId: c.id,
            draggableType: "contract_start",
            data: c,
          });
        }
      }
    });

    ordersFiltradas.forEach((o) => {
      if (STATUS_OCULTAR_OS.includes(o.status)) return;
      const isRecolha = STATUS_RECOLHA_OS.includes(o.status);
      if (isRecolha) {
        const dataRecISO = toISO(o.data_recolhimento);
        if (dataRecISO && isSameDay(parseISO(dataRecISO), day)) {
          events.push({
            type: "os_recolha",
            label: `↩ Recolha OS #${o.numero || "—"}`,
            client: o.client_nome,
            status: o.status,
            id: o.id + "_rec",
            orderId: o.id,
            link: `/ordens-servico/${o.id}`,
            draggableId: o.id,
            draggableType: "os_recolha",
            data: o,
            semMotorista: !o.motorista_recolhimento,
          });
        }
      } else {
        const dataEntISO = toISO(o.data_entrega);
        if (dataEntISO && isSameDay(parseISO(dataEntISO), day)) {
          events.push({
            type: "os_entrega",
            label: `OS #${o.numero || "—"}`,
            client: o.client_nome,
            status: o.status,
            id: o.id + "_ent",
            orderId: o.id,
            link: `/ordens-servico/${o.id}`,
            draggableId: o.id,
            draggableType: "os_entrega",
            data: o,
          });
        }
      }
    });

    // Trocas em campo agendadas (contratos e OS)
    const allDocs = [...contratosFiltrados, ...ordersFiltradas];
    allDocs.forEach((doc) => {
      (doc.historico_trocas || []).forEach((troca, ti) => {
        if (troca.tipo !== "em_campo") return;
        if (troca.status === "concluida" && !troca.data_agendada) return;
        const dataRef = troca.data_agendada || troca.data;
        if (!dataRef) return;
        try {
          const dataTroca = new Date(dataRef.includes("/") 
            ? dataRef.split("/").reverse().join("-") 
            : dataRef);
          if (isSameDay(dataTroca, day)) {
            const isContrato = !!(doc.itens); // contratos têm itens, OS não
            events.push({
              type: "troca",
              label: `🔄 Troca #${doc.numero || "—"}`,
              client: doc.client_nome,
              status: troca.status === "pendente" ? "em_transito" : "na_obra",
              id: doc.id + "_troca_" + ti,
              link: isContrato ? `/contratos/${doc.id}` : `/ordens-servico/${doc.id}`,
              data: doc,
              troca,
              semMotorista: !troca.motorista,
            });
          }
        } catch (_) {}
      });
    });

    return events;
  };

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  // ─── Drag handlers ────────────────────────────────────────────────────────
  const handleDragStart = (e, ev) => {
    if (!canDragEvent(ev)) { e.preventDefault(); return; }
    dragRef.current = ev;
    setDragging(ev);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, day) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(day.toISOString());
  };

  const handleDrop = (e, day) => {
    e.preventDefault();
    const ev = dragRef.current;
    setDragging(null);
    setDragOver(null);
    if (!ev) return;
    if (!canDragEvent(ev)) { toast.error("Este item não pode ser reagendado no status atual."); return; }
    const isRecolha = ev.draggableType === "contract_end" || ev.draggableType === "os_recolha";
    setPendingDrop({ ev, day, tipo: isRecolha ? "recolha" : "entrega" });
  };

  // ─── Confirmar drop ───────────────────────────────────────────────────────
  const handleConfirmDrop = async ({ motorista, veiculo }) => {
    const { ev, day } = pendingDrop;
    setPendingDrop(null);
    const newDateStr = format(day, "yyyy-MM-dd");

    try {
      if (ev.draggableType === "contract_start") {
        const update = { data_inicio: newDateStr, motorista_entrega: motorista, veiculo_entrega: veiculo, status: "em_transito" };
        await base44.entities.Contract.update(ev.draggableId, update);
        setContracts(prev => prev.map(c => c.id === ev.draggableId ? { ...c, ...update } : c));
        toast.success("Entrega reagendada! Status → Em Rota.");

      } else if (ev.draggableType === "contract_end") {
        const contract = contracts.find(c => c.id === ev.draggableId);
        if (contract?.data_inicio && newDateStr < contract.data_inicio) {
          toast.error("Data de recolha não pode ser anterior ao início."); return;
        }
        // Atualiza data_recolha (campo principal) e data_prevista_termino (sincroniza)
        const update = {
          data_recolha: newDateStr,
          data_prevista_termino: newDateStr,
          ...(motorista ? { motorista_recolha: motorista } : {}),
          ...(veiculo && veiculo !== "__sem_veiculo__" ? { veiculo_entrega: veiculo } : {}),
        };
        await base44.entities.Contract.update(ev.draggableId, update);
        // Atualiza estado local para re-render imediato sem precisar recarregar
        setContracts(prev => prev.map(c => c.id === ev.draggableId ? { ...c, ...update } : c));
        toast.success(motorista ? "Recolha reagendada com motorista!" : "Recolha reagendada — aguardando definição de motorista.");

      } else if (ev.draggableType === "os_entrega") {
        const newDT = `${newDateStr}T08:00`;
        const update = { data_entrega: newDT, motorista_entrega: motorista, veiculo_entrega: veiculo, status: "em_transito" };
        await base44.entities.ServiceOrder.update(ev.draggableId, update);
        setOrders(prev => prev.map(o => o.id === ev.draggableId ? { ...o, ...update } : o));
        toast.success("OS reagendada! Status → Em Trânsito.");

      } else if (ev.draggableType === "os_recolha") {
        const order = orders.find(o => o.id === ev.draggableId);
        const entregaISO = order?.data_entrega ? order.data_entrega.split("T")[0] : null;
        if (entregaISO && newDateStr < entregaISO) {
          toast.error("Data de recolha não pode ser anterior à entrega."); return;
        }
        const newDT = `${newDateStr}T08:00`;
        const update = {
          data_recolhimento: newDT,
          ...(motorista ? { motorista_recolhimento: motorista } : {}),
          ...(veiculo ? { veiculo_entrega: veiculo } : {}),
        };
        await base44.entities.ServiceOrder.update(ev.draggableId, update);
        setOrders(prev => prev.map(o => o.id === ev.draggableId ? { ...o, ...update } : o));
        toast.success(motorista ? "Recolha da OS reagendada!" : "Recolha da OS reagendada — aguardando motorista.");
      }

      if (selectedDay) setSelectedDay(day);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  };

  const handleCancelDrop = () => { setPendingDrop(null); dragRef.current = null; };

  // ─── Reagendamento manual (mobile/touch) ─────────────────────────────────
  const handleConfirmReschedule = async ({ novaData, motorista, veiculo }) => {
    const ev = rescheduleEvent;
    setRescheduleEvent(null);
    if (!ev || !novaData) return;
    const newDateStr = novaData;

    try {
      if (ev.draggableType === "contract_start") {
        const update = { data_inicio: newDateStr, ...(motorista ? { motorista_entrega: motorista } : {}), ...(veiculo ? { veiculo_entrega: veiculo } : {}), status: "em_transito" };
        await base44.entities.Contract.update(ev.draggableId, update);
        setContracts(prev => prev.map(c => c.id === ev.draggableId ? { ...c, ...update } : c));
        toast.success("Entrega reagendada! Status → Em Rota.");

      } else if (ev.draggableType === "contract_end") {
        const contract = contracts.find(c => c.id === ev.draggableId);
        if (contract?.data_inicio && newDateStr < contract.data_inicio) {
          toast.error("Data de recolha não pode ser anterior ao início."); return;
        }
        const update = {
          data_recolha: newDateStr,
          data_prevista_termino: newDateStr,
          ...(motorista ? { motorista_recolha: motorista } : {}),
          ...(veiculo && veiculo !== "__sem_veiculo__" ? { veiculo_entrega: veiculo } : {}),
        };
        await base44.entities.Contract.update(ev.draggableId, update);
        setContracts(prev => prev.map(c => c.id === ev.draggableId ? { ...c, ...update } : c));
        toast.success(motorista ? "Recolha reagendada com motorista!" : "Recolha reagendada!");

      } else if (ev.draggableType === "os_entrega") {
        const newDT = `${newDateStr}T08:00`;
        const update = { data_entrega: newDT, ...(motorista ? { motorista_entrega: motorista } : {}), ...(veiculo ? { veiculo_entrega: veiculo } : {}), status: "em_transito" };
        await base44.entities.ServiceOrder.update(ev.draggableId, update);
        setOrders(prev => prev.map(o => o.id === ev.draggableId ? { ...o, ...update } : o));
        toast.success("OS reagendada! Status → Em Trânsito.");

      } else if (ev.draggableType === "os_recolha") {
        const order = orders.find(o => o.id === ev.draggableId);
        const entregaISO = order?.data_entrega ? order.data_entrega.split("T")[0] : null;
        if (entregaISO && newDateStr < entregaISO) {
          toast.error("Data de recolha não pode ser anterior à entrega."); return;
        }
        const newDT = `${newDateStr}T08:00`;
        const update = {
          data_recolhimento: newDT,
          ...(motorista ? { motorista_recolhimento: motorista } : {}),
          ...(veiculo ? { veiculo_entrega: veiculo } : {}),
        };
        await base44.entities.ServiceOrder.update(ev.draggableId, update);
        setOrders(prev => prev.map(o => o.id === ev.draggableId ? { ...o, ...update } : o));
        toast.success(motorista ? "Recolha da OS reagendada!" : "Recolha da OS reagendada!");
      }
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  };

  return (
    <div>
      <DriverVehicleModal
        open={!!pendingDrop}
        tipo={pendingDrop?.tipo || "entrega"}
        drivers={drivers}
        vehicles={vehicles}
        onConfirm={handleConfirmDrop}
        onCancel={handleCancelDrop}
      />

      <RescheduleModal
        open={!!rescheduleEvent}
        event={rescheduleEvent}
        drivers={drivers}
        vehicles={vehicles}
        onConfirm={handleConfirmReschedule}
        onCancel={() => setRescheduleEvent(null)}
      />

      <FiltroAvancado
        open={showFiltro}
        onClose={() => setShowFiltro(false)}
        filtros={filtros}
        setFiltros={setFiltros}
        drivers={drivers}
        vehicles={vehicles}
      />

      <PageHeader
        title="Calendário Logístico"
        subtitle="Arraste eventos para reagendar • Filtro avançado disponível"
      />

      {/* Busca rápida */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nº contrato, nº OS, nome do cliente..."
          className="pl-9 pr-9 h-10 text-sm"
          autoComplete="off"
        />
        {busca && (
          <button
            onClick={() => setBusca("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Resultados da busca (lista compacta, sem esconder calendário) ── */}
      {buscaAtiva && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-semibold text-primary">
              {contratosFiltrados.length + ordersFiltradas.length} resultado{(contratosFiltrados.length + ordersFiltradas.length) !== 1 ? "s" : ""} para "{busca}"
            </span>
            <button onClick={() => setBusca("")} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="w-3 h-3" /> Limpar
            </button>
          </div>
          {(contratosFiltrados.length + ordersFiltradas.length) === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum contrato ou OS encontrado para "{busca}".</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {[
                ...contratosFiltrados.map(c => ({ tipo: "contrato", id: c.id, numero: c.numero, client_nome: c.client_nome, client_id: c.client_id, status: c.status, link: `/contratos/${c.id}`, data: c.data_inicio })),
                ...ordersFiltradas.map(o => ({ tipo: "os", id: o.id, numero: o.numero, client_nome: o.client_nome, client_id: o.client_id, status: o.status, link: `/ordens-servico/${o.id}`, data: o.data_entrega })),
              ].map((r) => (
                <Link key={r.id} to={r.link}>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                    {r.tipo === "contrato" ? <FileText className="w-3.5 h-3.5 text-primary shrink-0" /> : <Truck className="w-3.5 h-3.5 text-secondary shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{r.tipo === "contrato" ? "Contrato" : "OS"} #{r.numero || "—"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {r.client_nome}
                        {clientesMap[r.client_id]?.codigo_cliente && <span className="ml-1 font-mono text-primary">#{clientesMap[r.client_id].codigo_cliente}</span>}
                      </p>
                    </div>
                    <StatusBadge status={r.status} className="text-[9px] shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">↓ O calendário abaixo está filtrado pelos mesmos resultados</p>
        </div>
      )}

      {/* Barra de filtros */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <Button
          size="sm"
          variant={filtrosAtivos > 0 ? "default" : "outline"}
          onClick={() => setShowFiltro(true)}
          className="gap-2"
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros
          {filtrosAtivos > 0 && (
            <span className="bg-white/30 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {filtrosAtivos}
            </span>
          )}
        </Button>
        {filtrosAtivos > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setFiltros(FILTROS_VAZIOS)} className="gap-1 text-muted-foreground text-xs h-8">
            <X className="w-3 h-3" /> Limpar filtros
          </Button>
        )}

        {/* Toggle: somente entregas logísticas */}
        <button
          onClick={() => setSomenteLogistica(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            somentLogistica
              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
              : "border-border bg-background text-muted-foreground hover:border-primary/40"
          }`}
        >
          <Truck className="w-3 h-3" />
          {somentLogistica ? "✓ Só logística ativa" : "Mostrar tudo"}
        </button>
        {/* chips dos filtros ativos */}
        {filtros.status && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
            Status: {filtros.status}
            <button onClick={() => setFiltros(p => ({ ...p, status: "" }))}><X className="w-3 h-3" /></button>
          </span>
        )}
        {filtros.motorista && filtros.motorista !== "__sem__" && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
            Motorista: {filtros.motorista}
            <button onClick={() => setFiltros(p => ({ ...p, motorista: "" }))}><X className="w-3 h-3" /></button>
          </span>
        )}
        {filtros.motorista === "__sem__" && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
            Sem motorista
            <button onClick={() => setFiltros(p => ({ ...p, motorista: "" }))}><X className="w-3 h-3" /></button>
          </span>
        )}
        {filtros.cliente && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
            Cliente: {filtros.cliente}
            <button onClick={() => setFiltros(p => ({ ...p, cliente: "" }))}><X className="w-3 h-3" /></button>
          </span>
        )}
        {filtros.bairro && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
            Bairro: {filtros.bairro}
            <button onClick={() => setFiltros(p => ({ ...p, bairro: "" }))}><X className="w-3 h-3" /></button>
          </span>
        )}
        {filtros.cidade && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
            Cidade: {filtros.cidade}
            <button onClick={() => setFiltros(p => ({ ...p, cidade: "" }))}><X className="w-3 h-3" /></button>
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-2 sm:p-4">
              {/* Navegação mês */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="font-heading font-bold text-base sm:text-lg capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Cabeçalho dias */}
              <div className="grid grid-cols-7 mb-2">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                  <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>

              {/* Grade */}
              {dataLoading ? (
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="min-h-[48px] sm:min-h-[56px] rounded-lg bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
                {days.map((day) => {
                  const events = getEventsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const isDragTarget = dragOver === day.toISOString();

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      onDragOver={(e) => handleDragOver(e, day)}
                      onDrop={(e) => handleDrop(e, day)}
                      onDragLeave={(e) => { e.stopPropagation(); setDragOver(null); }}
                      onDragStart={(e) => e.preventDefault()}
                      className={`relative min-h-[48px] sm:min-h-[56px] p-0.5 sm:p-1 rounded-lg text-left transition-all border cursor-pointer select-none ${
                        isDragTarget
                          ? "border-primary bg-primary/20 scale-105 shadow-md"
                          : isSelected
                          ? "border-primary bg-primary/10"
                          : isToday
                          ? "border-primary/30 bg-primary/5"
                          : "border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <span className={`text-[10px] sm:text-xs font-semibold block mb-0.5 ${isToday ? "text-primary" : "text-foreground"}`}>
                        {format(day, "d")}
                      </span>
                      <div className="space-y-0.5">
                        {events.slice(0, 3).map((ev, i) => {
                          const draggable = canDragEvent(ev);
                          return (
                            <div
                              key={i}
                              draggable={draggable}
                              onDragStart={(e) => { e.stopPropagation(); if (draggable) handleDragStart(e, ev); else e.preventDefault(); }}
                              title={draggable ? `Arrastar para reagendar: ${ev.client}` : "Não pode ser reagendado"}
                              className={`text-[8px] sm:text-[9px] px-0.5 sm:px-1 py-0.5 rounded border truncate leading-tight transition-opacity ${
                                draggable ? "cursor-grab active:cursor-grabbing hover:opacity-80" : "cursor-not-allowed opacity-50"
                              } ${ev.semMotorista ? "border-dashed border-amber-400 bg-amber-50 text-amber-700" : getStatusColor(ev.status)}`}
                            >
                              {ev.type === "termino" || ev.type === "os_recolha" ? "↩ " : ""}
                              {ev.semMotorista ? "⏳ " : ""}
                              {ev.label.split(" ").slice(0, 3).join(" ")}
                            </div>
                          );
                        })}
                        {events.length > 3 && (
                          <div className="text-[8px] text-muted-foreground px-0.5 font-semibold">+{events.length - 3}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-3 text-center hidden sm:block">
                💡 Arraste eventos para reagendar · ⏳ = Aguardando logística · Opacos = bloqueados
              </p>
              <p className="text-[10px] text-muted-foreground mt-3 text-center sm:hidden">
                📅 Toque no dia → use o botão <strong>Reagendar</strong> no evento
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Painel lateral */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              {!selectedDay ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Clique em um dia para ver os eventos</p>
              </div>
              ) : (
                <>
                  <h3 className="font-heading font-bold mb-4 text-sm">
                    {format(selectedDay, "dd 'de' MMMM yyyy", { locale: ptBR })}
                  </h3>
                  {selectedEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum evento neste dia</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedEvents.map((ev, i) => {
                        const contract = ev.contractId ? contracts.find(c => c.id === ev.contractId) : null;
                        const order = ev.orderId ? orders.find(o => o.id === ev.orderId) : null;
                        const draggable = canDragEvent(ev);

                        return (
                          <div key={i} className="rounded-xl border border-border/60 overflow-hidden">
                            {/* Handle de drag */}
                            {draggable && (
                              <div
                                draggable
                                onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, ev); }}
                                title="Arraste para reagendar no calendário"
                                className="px-3 py-1.5 bg-primary/5 border-b border-primary/20 flex items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-primary/10 transition-colors"
                              >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-primary/60 shrink-0">
                                  <circle cx="3" cy="2" r="1.2"/><circle cx="9" cy="2" r="1.2"/>
                                  <circle cx="3" cy="6" r="1.2"/><circle cx="9" cy="6" r="1.2"/>
                                  <circle cx="3" cy="10" r="1.2"/><circle cx="9" cy="10" r="1.2"/>
                                </svg>
                                <span className="text-[10px] text-primary/70 font-medium">Arrastar para reagendar</span>
                              </div>
                            )}

                            {/* Tag aguardando logística */}
                            {ev.semMotorista && (
                              <div className="px-3 py-1 bg-amber-50 border-b border-amber-200 text-[9px] text-amber-700 flex items-center gap-1 font-medium">
                                <AlertTriangle className="w-2.5 h-2.5" /> Aguardando Logística — sem motorista
                              </div>
                            )}

                            <Link to={ev.link}>
                              <div className="p-3 hover:bg-muted/30 transition-colors space-y-2">
                                <div className="flex items-center gap-2">
                                  {ev.type.startsWith("os") ? (
                                    <Truck className="w-4 h-4 text-secondary shrink-0" />
                                  ) : ev.type === "termino" ? (
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                  ) : (
                                    <FileText className="w-4 h-4 text-primary shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold truncate">{ev.label}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{ev.client}</p>
                                  </div>
                                  <StatusBadge status={ev.status} className="text-[9px]" />
                                </div>

                                {contract && (
                                  <div className="space-y-1 pl-6 text-xs text-muted-foreground">
                                    {/* Código do cliente */}
                                    {contract.client_codigo && (
                                      <div className="flex items-center gap-1">
                                        <span className="font-mono font-bold text-primary text-[10px] bg-primary/10 px-1.5 py-0.5 rounded">
                                          #{contract.client_codigo}
                                        </span>
                                      </div>
                                    )}
                                    {contract.endereco_entrega && (
                                      <div className="flex items-start gap-1">
                                        <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2">{contract.endereco_entrega}</span>
                                      </div>
                                    )}
                                    <OpenLocationButton location={contract} />
                                    {contract.obra_nome && (
                                      <div className="flex items-center gap-1">
                                        <Package className="w-3 h-3 shrink-0" />
                                        <span className="truncate">Obra: {contract.obra_nome}</span>
                                      </div>
                                    )}
                                    {(contract.itens || []).length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {contract.itens.slice(0, 3).map((item, idx) => (
                                          <span key={idx} className="bg-muted px-1.5 py-0.5 rounded-full text-[9px] border">
                                            {item.quantidade_retirada || item.quantidade || 1}x {item.equipamento_nome}
                                          </span>
                                        ))}
                                        {contract.itens.length > 3 && (
                                          <span className="text-[9px] text-muted-foreground">+{contract.itens.length - 3}</span>
                                        )}
                                      </div>
                                    )}
                                    {/* Motorista Entrega */}
                                    <div className="flex items-center gap-1 text-blue-700">
                                      <Truck className="w-3 h-3 shrink-0" />
                                      <span className="text-[10px] font-semibold text-blue-600 mr-1">Entrega:</span>
                                      <span className="truncate font-medium">
                                        {contract.motorista_entrega || <span className="text-amber-600 italic font-normal">A definir</span>}
                                      </span>
                                      {contract.veiculo_entrega && (
                                        <span className="ml-1 text-muted-foreground">· {contract.veiculo_entrega}</span>
                                      )}
                                    </div>
                                    {/* Motorista Recolha — só mostra quando relevante */}
                                    {(ev.type === "termino" || contract.motorista_recolha) && (
                                      <div className="flex items-center gap-1 text-amber-700">
                                        <User className="w-3 h-3 shrink-0" />
                                        <span className="text-[10px] font-semibold text-amber-600 mr-1">Recolha:</span>
                                        <span className="truncate font-medium">
                                          {contract.motorista_recolha || <span className="text-amber-600 italic font-normal">A definir</span>}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {ev.type === "troca" && ev.troca && (
                                  <div className="space-y-1 pl-6 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1 text-orange-700">
                                      <ArrowLeftRight className="w-3 h-3 shrink-0" />
                                      <span className="font-semibold text-[10px]">{ev.troca.tipo === "em_campo" ? "Troca em Campo" : "Troca na Loja"}</span>
                                    </div>
                                    {ev.troca.motivo && <p className="text-[10px]">Motivo: {ev.troca.motivo}</p>}
                                    {ev.troca.motorista && (
                                      <div className="flex items-center gap-1 text-blue-700">
                                        <Truck className="w-3 h-3 shrink-0" />
                                        <span className="text-[10px] font-semibold mr-1">Motorista:</span>
                                        <span>{ev.troca.motorista}</span>
                                      </div>
                                    )}
                                    {ev.troca.itens_saindo?.length > 0 && (
                                      <p className="text-[10px]">↑ Saindo: {ev.troca.itens_saindo.map(i => `${i.quantidade}x ${i.nome}`).join(", ")}</p>
                                    )}
                                    {ev.troca.itens_entrando?.length > 0 && (
                                      <p className="text-[10px]">↓ Entrando: {ev.troca.itens_entrando.map(i => `${i.quantidade}x ${i.nome}`).join(", ")}</p>
                                    )}
                                  </div>
                                )}

                                {order && (
                                  <div className="space-y-1 pl-6 text-xs text-muted-foreground">
                                    {/* Código do cliente */}
                                    {order.client_codigo && (
                                      <div className="flex items-center gap-1">
                                        <span className="font-mono font-bold text-primary text-[10px] bg-primary/10 px-1.5 py-0.5 rounded">
                                          #{order.client_codigo}
                                        </span>
                                      </div>
                                    )}
                                    {order.local_entrega && (
                                      <div className="flex items-start gap-1">
                                        <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2">{order.local_entrega}</span>
                                      </div>
                                    )}
                                    <OpenLocationButton location={order} />
                                    {order.tipo_cacamba && (
                                      <div className="flex items-center gap-1">
                                        <Package className="w-3 h-3 shrink-0" />
                                        <span>{order.tipo_cacamba}</span>
                                      </div>
                                    )}
                                    {/* Motorista Entrega */}
                                    <div className="flex items-center gap-1 text-blue-700">
                                      <Truck className="w-3 h-3 shrink-0" />
                                      <span className="text-[10px] font-semibold text-blue-600 mr-1">Entrega:</span>
                                      <span className="truncate font-medium">
                                        {order.motorista_entrega || <span className="text-amber-600 italic font-normal">A definir</span>}
                                      </span>
                                      {order.veiculo_entrega && (
                                        <span className="ml-1 text-muted-foreground">· {order.veiculo_entrega}</span>
                                      )}
                                    </div>
                                    {/* Motorista Recolha — só mostra quando relevante */}
                                    {(ev.type === "os_recolha" || order.motorista_recolhimento) && (
                                      <div className="flex items-center gap-1 text-amber-700">
                                        <User className="w-3 h-3 shrink-0" />
                                        <span className="text-[10px] font-semibold text-amber-600 mr-1">Recolha:</span>
                                        <span className="truncate font-medium">
                                          {order.motorista_recolhimento || <span className="text-amber-600 italic font-normal">A definir</span>}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </Link>

                            {!draggable && (
                              <div className="px-3 py-1 bg-muted/40 text-[9px] text-muted-foreground border-t border-border/40 flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> Bloqueado — status atual não permite reagendamento
                              </div>
                            )}
                            {draggable && (
                              <div className="px-3 py-2 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between gap-2">
                                {/* Texto para desktop */}
                                <span className="text-[9px] text-emerald-700 hidden sm:flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Arraste no calendário para reagendar
                                </span>
                                {/* Botão para mobile/touch — sempre visível */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100 ml-auto touch-manipulation"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRescheduleEvent(ev); }}
                                >
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  Reagendar
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Legenda */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Legenda</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-300" /><span className="text-xs">Lançado (arrastável)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-blue-200 border border-blue-300" /><span className="text-xs">Em Rota</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-emerald-200 border border-emerald-300" /><span className="text-xs">Na Obra / Entregue</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-amber-200 border border-amber-300" /><span className="text-xs">Ag. Recolha (arrastável)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm border-2 border-dashed border-amber-400 bg-amber-50" /><span className="text-xs">⏳ Aguardando logística</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-100 border border-red-200" /><span className="text-xs">Cancelado (bloqueado)</span></div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/40 text-[10px] text-muted-foreground space-y-1">
                <p>↩ = evento de recolha</p>
                <p>⏳ = sem motorista definido</p>
                <p>Opaco = bloqueado para drag</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}