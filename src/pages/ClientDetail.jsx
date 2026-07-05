import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import WhatsAppButton from "../components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Pencil, Phone, Mail, MapPin, Ban, AlertCircle,
  FileText, Truck, DollarSign, User, Building2, HardHat, Receipt, Search, X, TrendingUp, Eye, ShoppingCart
} from "lucide-react";
import { calcularScoreFromContracts } from "../lib/clientScore";
import { calcContractTotal, getDiasContrato } from "../lib/contractCalc";
import ClientScoreBadge from "../components/client/ClientScoreBadge";
import CreditAnalysisPanel from "../components/client/CreditAnalysisPanel";
import BillingNotesList from "../components/billing/BillingNotesList";
import { format, parseISO } from "date-fns";
import { generateCobrancaPDF } from "../lib/generateCobrancaPDF";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function AdvancedFilter({ filters, onChange, onClear }) {
  const hasAny = filters.endereco || filters.bairro || filters.cidade || filters.obra || filters.dataInicio || filters.dataFim;
  return (
    <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/50">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Endereço</Label>
          <Input placeholder="Rua, número..." className="h-8 text-xs" value={filters.endereco} onChange={(e) => onChange("endereco", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Bairro</Label>
          <Input placeholder="Bairro..." className="h-8 text-xs" value={filters.bairro} onChange={(e) => onChange("bairro", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Cidade</Label>
          <Input placeholder="Cidade..." className="h-8 text-xs" value={filters.cidade} onChange={(e) => onChange("cidade", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Obra</Label>
          <Input placeholder="Nome da obra..." className="h-8 text-xs" value={filters.obra} onChange={(e) => onChange("obra", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Data inicial</Label>
          <Input type="date" className="h-8 text-xs" value={filters.dataInicio} onChange={(e) => onChange("dataInicio", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Data final</Label>
          <Input type="date" className="h-8 text-xs" value={filters.dataFim} onChange={(e) => onChange("dataFim", e.target.value)} />
        </div>
      </div>
      {hasAny && (
        <button onClick={onClear} className="flex items-center gap-1 text-xs text-destructive hover:underline">
          <X className="w-3 h-3" /> Limpar filtros
        </button>
      )}
    </div>
  );
}

const EMPTY_FILTERS = { endereco: "", bairro: "", cidade: "", obra: "", dataInicio: "", dataFim: "", status: "todos" };

function applyAdvancedFilters(items, filters, getEndereco, getObra, getData, getStatus) {
  return items.filter((item) => {
    const endereco = (getEndereco(item) || "").toLowerCase();
    const obra = (getObra(item) || "").toLowerCase();
    const data = getData(item) || "";
    const status = getStatus ? getStatus(item) : null;
    if (filters.status && filters.status !== "todos" && status !== filters.status) return false;
    if (filters.endereco && !endereco.includes(filters.endereco.toLowerCase())) return false;
    if (filters.bairro && !endereco.includes(filters.bairro.toLowerCase())) return false;
    if (filters.cidade && !endereco.includes(filters.cidade.toLowerCase())) return false;
    if (filters.obra && !obra.includes(filters.obra.toLowerCase())) return false;
    if (filters.dataInicio && data < filters.dataInicio) return false;
    if (filters.dataFim && data > filters.dataFim) return false;
    return true;
  });
}

const CONTRACT_STATUSES = [
  { value: "todos", label: "Todos os status" },
  { value: "rascunho", label: "Lançado" },
  { value: "em_transito", label: "Em Rota" },
  { value: "na_obra", label: "Entregue" },
  { value: "aguardando_recolha", label: "Recolha Solicitada" },
  { value: "devolvido_parcial", label: "Recolhido" },
  { value: "devolvido_pendente", label: "Dev. Pend. Pgto" },
  { value: "finalizado", label: "Finalizado" },
  { value: "cancelado", label: "Cancelado" },
];

const OS_STATUSES = [
  { value: "todos", label: "Todos os status" },
  { value: "pendente", label: "Lançada" },
  { value: "em_transito", label: "Em Trânsito" },
  { value: "entregue", label: "Entregue" },
  { value: "aguardando_recolha", label: "Aguardando Recolha" },
  { value: "recolhida", label: "Recolhida" },
  { value: "finalizada", label: "Finalizada" },
  { value: "cancelada", label: "Cancelada" },
];

function ContratosTab({ contracts, clientObras }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const updateFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));
  const hasAny = Object.entries(filters).some(([k, v]) => k !== "status" ? v : v !== "todos");

  const filtered = applyAdvancedFilters(
    contracts,
    filters,
    (c) => [c.endereco_entrega, c.obra_endereco].filter(Boolean).join(" "),
    (c) => c.obra_nome || "",
    (c) => c.data_inicio || "",
    (c) => c.status
  );

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
            <SelectTrigger className="h-8 text-xs col-span-2 sm:col-span-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTRACT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {clientObras && clientObras.length > 0 && (
            <Select value={filters.obra || "__todas__"} onValueChange={(v) => updateFilter("obra", v === "__todas__" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filtrar obra..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas as obras</SelectItem>
                {clientObras.map((o, i) => <SelectItem key={i} value={o.nome_obra}>{o.nome_obra}{!o.ativa ? " (inativa)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input placeholder="Endereço..." className="h-8 text-xs" value={filters.endereco} onChange={(e) => updateFilter("endereco", e.target.value)} />
          <Input type="date" className="h-8 text-xs" value={filters.dataInicio} onChange={(e) => updateFilter("dataInicio", e.target.value)} />
          <Input type="date" className="h-8 text-xs" value={filters.dataFim} onChange={(e) => updateFilter("dataFim", e.target.value)} />
        </div>
        {hasAny && (
          <button onClick={() => setFilters(EMPTY_FILTERS)} className="flex items-center gap-1 text-xs text-destructive hover:underline">
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}
      </div>
      {filtered.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Nenhum contrato encontrado</p>}
      {filtered.map((c) => (
        <a key={c.id} href={`/contratos/${c.id}`}>
          <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="font-medium text-sm">Contrato #{c.numero || "—"}</p>
                <p className="text-xs text-muted-foreground">{c.data_inicio ? (() => { try { return format(parseISO(c.data_inicio), "dd/MM/yyyy"); } catch { return c.data_inicio; } })() : "—"}{c.endereco_entrega ? ` · ${c.endereco_entrega}` : ""}</p>
                {c.obra_nome && <p className="text-xs text-muted-foreground">🏗 {c.obra_nome}</p>}
                {c.itens?.length > 0 && <p className="text-xs text-muted-foreground">{c.itens.map(i => i.equipamento_nome).filter(Boolean).join(", ")}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <StatusBadge status={c.status} />
              <span className="font-semibold text-sm">R$ {(c.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

function OsTab({ orders, clientObras }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const updateFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));
  const hasAny = Object.entries(filters).some(([k, v]) => k !== "status" ? v : v !== "todos");

  const filtered = applyAdvancedFilters(
    orders,
    filters,
    (o) => o.local_entrega || "",
    (o) => "",
    (o) => o.data_entrega?.split("T")[0] || "",
    (o) => o.status
  );

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
            <SelectTrigger className="h-8 text-xs col-span-2 sm:col-span-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {OS_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Endereço / local..." className="h-8 text-xs" value={filters.endereco} onChange={(e) => updateFilter("endereco", e.target.value)} />
          <Input type="date" className="h-8 text-xs" value={filters.dataInicio} onChange={(e) => updateFilter("dataInicio", e.target.value)} />
          <Input type="date" className="h-8 text-xs" value={filters.dataFim} onChange={(e) => updateFilter("dataFim", e.target.value)} />
        </div>
        {hasAny && (
          <button onClick={() => setFilters(EMPTY_FILTERS)} className="flex items-center gap-1 text-xs text-destructive hover:underline">
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}
      </div>
      {filtered.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Nenhuma OS encontrada</p>}
      {filtered.map((o) => (
        <a key={o.id} href={`/ordens-servico/${o.id}`}>
          <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <Truck className="w-4 h-4 text-secondary shrink-0" />
              <div>
                <p className="font-medium text-sm">OS #{o.numero || "—"}{o.tipo_os === "troca_cacamba" ? " 🔄 Troca" : ""}</p>
                <p className="text-xs text-muted-foreground">{o.local_entrega}</p>
                {o.data_entrega && <p className="text-xs text-muted-foreground">{(() => { try { return format(parseISO(o.data_entrega), "dd/MM/yyyy"); } catch { return o.data_entrega?.split("T")[0] || ""; } })()}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <StatusBadge status={o.status} />
              <span className="font-semibold text-sm">R$ {(o.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

const profileLabels = { comum: "Cliente Comum", cnpj: "Cliente CNPJ", empreiteiro: "Empreiteiro" };
const profileIcons = { comum: User, cnpj: Building2, empreiteiro: HardHat };

export default function ClientDetail() {
  const navigate = useNavigate();
  const { id: clientId } = useParams();

  const [client, setClient] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState("dados");
  const [cobrancaDialog, setCobrancaDialog] = useState(false);
  const [selectedContracts, setSelectedContracts] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [selectAll, setSelectAll] = useState(true);
  const [cobrancaFilters, setCobrancaFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    Promise.all([
      base44.entities.CompanySettings.list(),
      base44.entities.Client.filter({ id: clientId }),
      base44.entities.Contract.filter({ client_id: clientId }),
      base44.entities.ServiceOrder.filter({ client_id: clientId }),
      base44.entities.Sale.filter({ client_id: clientId }),
      base44.entities.Equipment.list(),
    ]).then(([settingsList, [c], cts, oss, sls, equipamentos]) => {
      const cfg = settingsList[0] || null;
      setSettings(cfg);
      setClient(c);
      setOrders(oss || []);
      setSales(sls || []);

      // Enriquecer itens dos contratos com dados do equipamento e recalcular saldo_pagar
      const eqMap = {};
      (equipamentos || []).forEach(e => { eqMap[e.id] = e; });

      const contratosEnriquecidos = (cts || []).map(contrato => {
        if (contrato.status === "cancelado") return contrato;
        const itensEnriquecidos = (contrato.itens || []).map(item => {
          const eq = eqMap[item.equipamento_id];
          if (!eq) return item;
          return {
            ...item,
            aplica_valor_minimo: eq.aplica_valor_minimo ?? item.aplica_valor_minimo,
            dias_minimos_proprio: eq.dias_minimos_proprio ?? item.dias_minimos_proprio,
            valor_diario: item.valor_diario || eq.valor_diario || 0,
          };
        });
        const calc = calcContractTotal({
          itens: itensEnriquecidos,
          diasContrato: getDiasContrato(contrato),
          valorMinimoContrato: cfg?.valor_minimo_contrato || 0,
          frete: contrato.frete || 0,
          sinal: contrato.sinal || 0,
          valorPago: contrato.valor_pago || 0,
          regrasDesconto: cfg?.regras_desconto_tempo || [],
        });
        return {
          ...contrato,
          saldo_pagar: parseFloat(calc.saldoPagar.toFixed(2)),
          valor_total: parseFloat(calc.valorTotal.toFixed(2)),
        };
      });

      setContracts(contratosEnriquecidos);
      setLoading(false);
    });
  }, [clientId]);

  if (loading || !client) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const ProfileIcon = profileIcons[client.tipo_perfil || "comum"] || User;
  const activeContracts = contracts.filter((c) => !["finalizado", "cancelado"].includes(c.status));
  const scoreInterno = calcularScoreFromContracts(contracts) - (client.status_serasa === "negativado" ? 50 : 0);
  // Status que indicam que o contrato/OS ainda está ativo (cobrança correndo — não é inadimplência)
  const STATUS_CONTRATOS_ATIVOS = ["rascunho", "em_transito", "na_obra", "aguardando_recolha"];
  const STATUS_OS_ATIVAS = ["pendente", "em_transito", "entregue", "aguardando_recolha"];
  // Status que indicam encerramento — aí sim pode haver inadimplência
  const STATUS_CONTRATOS_ENCERRADOS = ["devolvido_parcial", "devolvido_pendente", "finalizado"];
  const STATUS_OS_ENCERRADAS = ["recolhida", "finalizada"];

  // totalDevido: soma geral de saldos em aberto (para exibição no painel financeiro)
  const totalDevido = [
    ...contracts.filter((c) => c.status_financeiro !== "pago").map((c) => c.saldo_pagar || 0),
    ...orders.filter((o) => o.status_pagamento !== "pago").map((o) => o.valor || 0),
    ...sales.filter((s) => s.status === "aprovado" && s.status_pagamento !== "pago").map((s) => s.saldo_pendente || Math.max(0, (s.total || 0) - (s.valor_pago || 0))),
  ].reduce((sum, v) => sum + v, 0);

  // totalInadimplente: apenas saldos de contratos/OS JÁ ENCERRADOS — contratos ativos não são inadimplência
  const totalInadimplente = [
    ...contracts
      .filter((c) => STATUS_CONTRATOS_ENCERRADOS.includes(c.status) && c.status_financeiro !== "pago")
      .map((c) => c.saldo_pagar || 0),
    ...orders
      .filter((o) => STATUS_OS_ENCERRADAS.includes(o.status) && o.status_pagamento !== "pago")
      .map((o) => o.valor || 0),
    ...sales
      .filter((s) => s.status === "aprovado" && s.status_pagamento !== "pago")
      .map((s) => s.saldo_pendente || Math.max(0, (s.total || 0) - (s.valor_pago || 0))),
  ].reduce((sum, v) => sum + v, 0);

  const whatsappDebt = `Olá ${client.nome_razao_social}, seu saldo devedor total é de R$ ${totalDevido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Por favor, entre em contato para regularizar. Andaimes Costa do Sol.`;

  // Cancelados não entram na cobrança
  const openContractsForBilling = contracts.filter((c) => c.status !== "cancelado" && c.status_financeiro !== "pago" && (c.saldo_pagar || 0) > 0);
  const openOrdersForBilling = orders.filter((o) => o.status !== "cancelada" && o.status_pagamento !== "pago" && (o.valor || 0) > 0);

  const openCobrancaDialog = () => {
    setCobrancaFilters(EMPTY_FILTERS);
    setSelectedContracts(openContractsForBilling.map((c) => c.id));
    setSelectedOrders(openOrdersForBilling.map((o) => o.id));
    setSelectAll(true);
    setCobrancaDialog(true);
  };

  const filteredContractsForBilling = applyAdvancedFilters(
    openContractsForBilling,
    cobrancaFilters,
    (c) => [c.endereco_entrega, c.obra_endereco].filter(Boolean).join(" "),
    (c) => c.obra_nome || "",
    (c) => c.data_inicio || ""
  );
  const filteredOrdersForBilling = applyAdvancedFilters(
    openOrdersForBilling,
    cobrancaFilters,
    (o) => o.local_entrega || "",
    () => "",
    (o) => o.data_entrega?.split("T")[0] || ""
  );

  const toggleSelectAll = (checked) => {
    setSelectAll(checked);
    setSelectedContracts(checked ? openContractsForBilling.map((c) => c.id) : []);
    setSelectedOrders(checked ? openOrdersForBilling.map((o) => o.id) : []);
  };

  const toggleContract = (id) => {
    setSelectedContracts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleOrder = (id) => {
    setSelectedOrders((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleGerarCobranca = async () => {
    const chosenContracts = openContractsForBilling.filter((c) => selectedContracts.includes(c.id));
    const chosenOrders = openOrdersForBilling.filter((o) => selectedOrders.includes(o.id));
    if (chosenContracts.length === 0 && chosenOrders.length === 0) { toast.error("Selecione ao menos um item"); return; }
    const settings = await base44.entities.CompanySettings.list().then((l) => l[0] || null);
    const doc = generateCobrancaPDF({ client, contracts: chosenContracts, orders: chosenOrders, settings });
    doc.save(`cobranca_${client.nome_razao_social?.replace(/\s+/g, "_")}.pdf`);
    toast.success("PDF de cobrança gerado!");
    setCobrancaDialog(false);
  };

  const cobrancaTotal =
    openContractsForBilling.filter((c) => selectedContracts.includes(c.id)).reduce((s, c) => s + (c.saldo_pagar || 0), 0) +
    openOrdersForBilling.filter((o) => selectedOrders.includes(o.id)).reduce((s, o) => s + (o.valor || 0), 0);

  const handleGerarCobrancaFiltered = async () => {
    const chosenContracts = openContractsForBilling.filter((c) => selectedContracts.includes(c.id));
    const chosenOrders = openOrdersForBilling.filter((o) => selectedOrders.includes(o.id));
    if (chosenContracts.length === 0 && chosenOrders.length === 0) { toast.error("Selecione ao menos um item"); return; }
    const settings = await base44.entities.CompanySettings.list().then((l) => l[0] || null);
    const doc = generateCobrancaPDF({ client, contracts: chosenContracts, orders: chosenOrders, settings });
    doc.save(`cobranca_${client.nome_razao_social?.replace(/\s+/g, "_")}.pdf`);
    toast.success("PDF de cobrança gerado!");
    setCobrancaDialog(false);
  };

  return (
    <div>
      <PageHeader title={client.nome_razao_social} subtitle={client.fantasia || profileLabels[client.tipo_perfil || "comum"]}>
        <Button variant="outline" onClick={() => navigate("/clientes")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button variant="outline" onClick={() => navigate(`/clientes/${clientId}`)} className="gap-2">
          <Pencil className="w-4 h-4" /> Editar
        </Button>
        <Button variant="outline" onClick={() => window.open(`/portal-cliente?clientId=${clientId}`, "_blank")} className="gap-2">
          <Eye className="w-4 h-4" /> Ver como Cliente
        </Button>
      </PageHeader>

      {/* Código do cliente + info rápida */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {client.codigo_cliente && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary font-mono text-sm font-bold px-3 py-1.5 rounded-xl">
            <span className="text-xs font-normal text-primary/70">Cód.</span>
            {client.codigo_cliente}
          </div>
        )}
        {client.cpf_cnpj && (
          <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-lg font-mono">{client.cpf_cnpj}</span>
        )}
        <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1.5 rounded-lg">
          {profileLabels[client.tipo_perfil || "comum"]}
        </span>
        {contracts.length > 0 && (
          <span className="text-xs text-muted-foreground">{contracts.length} contrato(s) · {activeContracts.length} ativo(s)</span>
        )}
      </div>

      {/* Alert: many open contracts */}
      {activeContracts.length >= 5 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 mb-4 text-amber-800 text-sm">
          <span className="text-lg">❗</span>
          <span>Este cliente possui <strong>{activeContracts.length} contratos em aberto</strong> simultaneamente.</span>
        </div>
      )}

      {/* Alert banners */}
      {(client.bloqueado || client.pendencia_financeira || (client.status_serasa && client.status_serasa !== "limpo") || totalInadimplente > 0) && (
        <div className="flex flex-wrap gap-2 p-4 rounded-xl bg-red-50 border border-red-200 mb-6">
          {client.bloqueado && (
            <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1.5 rounded-full flex items-center gap-1">
              <Ban className="w-3 h-3" /> BLOQUEADO
            </span>
          )}
          {client.pendencia_financeira && (
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1.5 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> PENDÊNCIA FINANCEIRA
            </span>
          )}
          {client.status_serasa && client.status_serasa !== "limpo" && (
            <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1.5 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> SERASA: {client.status_serasa?.toUpperCase()}
            </span>
          )}
          {totalInadimplente > 0 && (
            <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1.5 rounded-full flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> INADIMPLENTE — R$ {totalInadimplente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )}

      {/* Observações do cliente */}
      {client.observacoes && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Observações
          </p>
          <p className="text-sm text-amber-800 whitespace-pre-line">{client.observacoes}</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="credito" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Crédito</TabsTrigger>
          <TabsTrigger value="notas">Notas/Cobranças</TabsTrigger>
          <TabsTrigger value="contratos">Contratos ({contracts.length})</TabsTrigger>
          <TabsTrigger value="os">OS ({orders.length})</TabsTrigger>
          <TabsTrigger value="vendas">Vendas ({sales.length})</TabsTrigger>
          {client.tipo_perfil === "empreiteiro" && (
            <TabsTrigger value="obras">Obras Ativas ({activeContracts.length})</TabsTrigger>
          )}
        </TabsList>

        {/* Dados Tab */}
        <TabsContent value="dados">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-heading flex items-center gap-2"><ProfileIcon className="w-4 h-4" /> Identificação</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground text-xs">Tipo:</span> <span className="font-medium">{profileLabels[client.tipo_perfil || "comum"]}</span></div>
                <div><span className="text-muted-foreground text-xs">CPF/CNPJ:</span> <span className="font-mono">{client.cpf_cnpj}</span></div>
                {client.rg && <div><span className="text-muted-foreground text-xs">RG:</span> <span>{client.rg}</span></div>}
                {client.inscricao_estadual && <div><span className="text-muted-foreground text-xs">IE:</span> <span>{client.inscricao_estadual}</span></div>}
                {client.data_nascimento && <div><span className="text-muted-foreground text-xs">Nascimento:</span> <span>{(() => { try { return format(parseISO(client.data_nascimento), "dd/MM/yyyy"); } catch { return client.data_nascimento; } })()}</span></div>}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-heading flex items-center gap-2"><Phone className="w-4 h-4" /> Contatos</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {client.telefone1 && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{client.telefone1}</div>}
                {client.telefone2 && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{client.telefone2}</div>}
                {client.telefone3 && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{client.telefone3}</div>}
                {client.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{client.email}</div>}
                {client.conjuge_contato && <div><span className="text-muted-foreground text-xs">Cônjuge:</span> <span>{client.conjuge_contato}</span></div>}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-heading flex items-center gap-2"><MapPin className="w-4 h-4" /> Endereços</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {client.endereco_entrega_rua && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Principal/Entrega</p>
                    <p>{client.endereco_entrega_rua}, {client.endereco_entrega_numero}</p>
                    <p>{client.endereco_entrega_bairro} — {client.endereco_entrega_cidade}/{client.endereco_entrega_uf}</p>
                  </div>
                )}
                {client.endereco_cobranca_rua && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Cobrança</p>
                    <p>{client.endereco_cobranca_rua}, {client.endereco_cobranca_numero}</p>
                    <p>{client.endereco_cobranca_bairro} — {client.endereco_cobranca_cidade}/{client.endereco_cobranca_uf}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            {(client.pessoas_liberadas || []).length > 0 && (
              <Card className="border-0 shadow-sm sm:col-span-2 lg:col-span-3">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-heading">Pessoas Autorizadas</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {client.pessoas_liberadas.map((p, i) => (
                      <div key={i} className="p-3 rounded-xl bg-muted/50 text-sm">
                        <p className="font-medium">{p.nome}</p>
                        {p.cpf && <p className="text-xs text-muted-foreground font-mono">{p.cpf}</p>}
                        {p.telefone && <p className="text-xs text-muted-foreground">{p.telefone}</p>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Financeiro Tab */}
        <TabsContent value="financeiro">
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Contratos</p>
                <p className="text-2xl font-bold font-heading mt-1">
                  R$ {contracts.reduce((s, c) => s + (c.valor_total || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total OS</p>
                <p className="text-2xl font-bold font-heading mt-1">
                  R$ {orders.reduce((s, o) => s + (o.valor || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card className={`border-0 shadow-sm ${totalDevido > 0 ? "bg-red-50" : ""}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">⚠ Total Devido</p>
                <p className={`text-2xl font-bold font-heading mt-1 ${totalDevido > 0 ? "text-destructive" : "text-success"}`}>
                  R$ {totalDevido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {totalDevido > 0 && client?.telefone1 && (
              <WhatsAppButton phone={client.telefone1} message={whatsappDebt} />
            )}
            {(openContractsForBilling.length > 0 || openOrdersForBilling.length > 0) && (
              <Button variant="outline" onClick={() => setActiveTab("notas")} className="gap-2">
                <Receipt className="w-4 h-4" /> Notas / Cobranças
              </Button>
            )}
          </div>
          <p className="text-sm font-semibold mb-3">Contratos em aberto:</p>
          <div className="space-y-2">
            {contracts.filter(c => c.status_financeiro !== "pago" && c.saldo_pagar > 0).map((c) => (
              <Link key={c.id} to={`/contratos/${c.id}`}>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Contrato #{c.numero || "—"}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <span className="font-bold text-sm text-destructive">R$ {(c.saldo_pagar || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </Link>
            ))}
            {orders.filter(o => o.status_pagamento !== "pago" && o.valor > 0).map((o) => (
              <Link key={o.id} to={`/ordens-servico/${o.id}`}>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-secondary" />
                    <span className="text-sm font-medium">OS #{o.numero || "—"}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <span className="font-bold text-sm text-destructive">R$ {(o.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </Link>
            ))}
            {sales.filter(s => s.status === "aprovado" && s.status_pagamento !== "pago").map((s) => {
              const saldo = s.saldo_pendente || Math.max(0, (s.total || 0) - (s.valor_pago || 0));
              return saldo > 0 ? (
                <button key={s.id} onClick={() => setActiveTab("vendas")} className="w-full text-left">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium">Venda #{s.numero || "—"}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                        {s.status_pagamento === "parcial" ? "Parcial" : "Não Pago"}
                      </span>
                    </div>
                    <span className="font-bold text-sm text-destructive">R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </button>
              ) : null;
            })}
          </div>
        </TabsContent>

        {/* Crédito Tab */}
        <TabsContent value="credito">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Análise de Crédito
              </CardTitle>
              <div className="mt-1">
                <ClientScoreBadge score={Math.max(0, Math.min(100, scoreInterno))} />
              </div>
            </CardHeader>
            <CardContent>
              <CreditAnalysisPanel
                client={client}
                score={Math.max(0, Math.min(100, scoreInterno))}
                settings={settings}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notas/Cobranças Tab */}
        <TabsContent value="notas">
          <BillingNotesList
            client={client}
            contracts={contracts}
            orders={orders}
            settings={settings}
          />
        </TabsContent>

        {/* Contratos Tab */}
        <TabsContent value="contratos">
          <ContratosTab contracts={contracts} clientObras={client.obras || []} />
        </TabsContent>

        {/* OS Tab */}
        <TabsContent value="os">
          <OsTab orders={orders} clientObras={client.obras || []} />
        </TabsContent>

        {/* Vendas Tab */}
        <TabsContent value="vendas">
          <div className="space-y-3">
            {(() => {
              const totalVendas = sales.filter(v => v.status !== "cancelado").reduce((s, v) => s + (v.total || 0), 0);
              const totalSaldoPendente = sales.filter(v => v.status === "aprovado" && v.status_pagamento !== "pago").reduce((s, v) => s + (v.saldo_pendente || Math.max(0, (v.total || 0) - (v.valor_pago || 0))), 0);
              const totalNaoPago = sales.filter(v => v.status === "aprovado" && v.status_pagamento === "nao_pago").reduce((s, v) => s + (v.saldo_pendente || v.total || 0), 0);
              return (
                <div className="grid sm:grid-cols-4 gap-3 mb-4">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Vendas</p>
                      <p className="text-xl font-bold font-heading mt-1">R$ {totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Aprovadas</p>
                      <p className="text-xl font-bold font-heading mt-1 text-emerald-600">{sales.filter(v => v.status === "aprovado").length}</p>
                    </CardContent>
                  </Card>
                  <Card className={`border-0 shadow-sm ${totalSaldoPendente > 0 ? "bg-amber-50" : ""}`}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo Pendente</p>
                      <p className={`text-xl font-bold font-heading mt-1 ${totalSaldoPendente > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        R$ {totalSaldoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={`border-0 shadow-sm ${totalNaoPago > 0 ? "bg-red-50" : ""}`}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Não Pago</p>
                      <p className={`text-xl font-bold font-heading mt-1 ${totalNaoPago > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        R$ {totalNaoPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
            {sales.map((s) => {
              const saldoPendente = s.saldo_pendente || Math.max(0, (s.total || 0) - (s.valor_pago || 0));
              const statusPgto = s.status_pagamento || (s.status === "aprovado" && saldoPendente <= 0 ? "pago" : "pendente");
              return (
                <div key={s.id} className={`p-3 rounded-xl bg-card border ${statusPgto === "nao_pago" && s.status === "aprovado" ? "border-l-4 border-l-red-400 border-red-200" : "border-border/50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{s.numero || "—"}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          s.status === "aprovado" ? "bg-emerald-100 text-emerald-700" :
                          s.status === "cancelado" ? "bg-red-100 text-red-600" :
                          "bg-amber-100 text-amber-700"
                        }`}>{s.status === "aprovado" ? "Aprovado" : s.status === "cancelado" ? "Cancelado" : "Pendente"}</span>
                        {s.status === "aprovado" && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            statusPgto === "pago" ? "bg-emerald-100 text-emerald-700" :
                            statusPgto === "parcial" ? "bg-blue-100 text-blue-700" :
                            statusPgto === "nao_pago" ? "bg-red-100 text-red-700" :
                            "bg-muted text-muted-foreground"
                          }`}>{statusPgto === "pago" ? "Pago" : statusPgto === "parcial" ? "Parcial" : statusPgto === "nao_pago" ? "Não Pago" : "Pendente"}</span>
                        )}
                        {s.nota_vinculada_numero && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                            📄 Nota #{s.nota_vinculada_numero}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.created_date ? format(new Date(s.created_date), "dd/MM/yyyy") : "—"} · {(s.itens || []).length} produto(s) · {s.forma_pagamento}
                      </p>
                      {saldoPendente > 0 && s.status === "aprovado" && (
                        <p className="text-xs font-semibold text-amber-700 mt-0.5">
                          Saldo: R$ {saldoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-sm shrink-0">R$ {(s.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              );
            })}
            {sales.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Nenhuma venda encontrada</p>}
          </div>
        </TabsContent>

        {/* Obras tab for Empreiteiros */}
        {client.tipo_perfil === "empreiteiro" && (
          <TabsContent value="obras">
            <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <span className="font-semibold">{activeContracts.length} obra(s) ativa(s)</span> sob responsabilidade deste empreiteiro.
            </div>
            <div className="space-y-2">
              {activeContracts.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Nenhuma obra ativa</p>}
              {activeContracts.map((c) => (
                <Link key={c.id} to={`/contratos/${c.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:shadow-md transition-all">
                    <div>
                      <p className="font-medium text-sm">#{c.numero} — {c.endereco_entrega || "Endereço não informado"}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Cobrança Dialog */}
      <Dialog open={cobrancaDialog} onOpenChange={setCobrancaDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Gerar Cobrança em PDF</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Filtros avançados */}
            <AdvancedFilter
              filters={cobrancaFilters}
              onChange={(k, v) => setCobrancaFilters(f => ({ ...f, [k]: v }))}
              onClear={() => setCobrancaFilters(EMPTY_FILTERS)}
            />
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox checked={selectAll} onCheckedChange={toggleSelectAll} id="select-all" />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Selecionar todos ({filteredContractsForBilling.length + filteredOrdersForBilling.length} itens visíveis)
              </label>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredContractsForBilling.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><FileText className="w-3 h-3" /> Contratos</p>
                  {filteredContractsForBilling.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox checked={selectedContracts.includes(c.id)} onCheckedChange={() => toggleContract(c.id)} id={`c-${c.id}`} />
                        <label htmlFor={`c-${c.id}`} className="text-sm cursor-pointer min-w-0">
                          <span className="font-medium">Contrato #{c.numero || "—"}</span>
                          {c.data_inicio && <span className="text-xs text-muted-foreground ml-2">{(() => { try { return format(parseISO(c.data_inicio), "dd/MM/yyyy"); } catch { return c.data_inicio; } })()}</span>}
                          {c.endereco_entrega && <p className="text-xs text-muted-foreground truncate">{c.endereco_entrega}</p>}
                        </label>
                      </div>
                      <span className="text-sm font-bold text-destructive shrink-0 ml-2">R$ {(c.saldo_pagar || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </>
              )}
              {filteredOrdersForBilling.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mt-2"><Truck className="w-3 h-3" /> Ordens de Serviço</p>
                  {filteredOrdersForBilling.map((o) => (
                    <div key={o.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox checked={selectedOrders.includes(o.id)} onCheckedChange={() => toggleOrder(o.id)} id={`o-${o.id}`} />
                        <label htmlFor={`o-${o.id}`} className="text-sm cursor-pointer min-w-0">
                          <span className="font-medium">OS #{o.numero || "—"}</span>
                          {o.local_entrega && <p className="text-xs text-muted-foreground truncate">{o.local_entrega}</p>}
                        </label>
                      </div>
                      <span className="text-sm font-bold text-destructive shrink-0 ml-2">R$ {(o.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </>
              )}
              {filteredContractsForBilling.length === 0 && filteredOrdersForBilling.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item encontrado com os filtros aplicados</p>
              )}
            </div>
            {(selectedContracts.length > 0 || selectedOrders.length > 0) && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-blue-700">Total selecionado:</span>
                <span className="text-lg font-bold text-blue-700">
                  R$ {cobrancaTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCobrancaDialog(false)}>Cancelar</Button>
            <Button onClick={handleGerarCobrancaFiltered} className="gap-2">
              <Receipt className="w-4 h-4" /> Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}