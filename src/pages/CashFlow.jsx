import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Lock, Unlock,
  CheckCircle, XCircle, Clock, Filter, X, ChevronDown, ChevronUp,
  ArrowDownCircle, ArrowUpCircle, PenLine
} from "lucide-react";
import { RequestEditDialog, ApproveEditDialog, EditRequestBadge } from "@/components/cashflow/EditRequestDialog";
import CashAutoConfigPanel from "@/components/cashflow/CashAutoConfigPanel";
import { toast } from "sonner";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const CATEGORIAS_RECEITA = ["Aluguel de Equipamento", "Andaime", "Máquina", "Caçamba", "Escora", "Venda", "Escada", "Grade", "Frete", "Serviços", "Outros"];
const CATEGORIAS_DESPESA = ["Combustível", "Manutenção", "Salários", "Aluguel", "Fornecedores", "Impostos", "Material", "Andaime", "Máquina", "Caçamba", "Escora", "Escada", "Grade", "Outros"];
const FORMAS_PGTO = [
  { key: "dinheiro", label: "Dinheiro" }, { key: "pix", label: "PIX" },
  { key: "cartao_debito", label: "Cartão Débito" }, { key: "cartao_credito", label: "Cartão Crédito" },
  { key: "transferencia", label: "Transferência" }, { key: "boleto", label: "Boleto" },
];

const EMPTY_FILTERS = {
  dataInicio: "", dataFim: "", origem: "todos", forma_pagamento: "todos",
  status_req: "todos", cliente: "", numero: "", valorMin: "", valorMax: "",
  registrado_por: "", etiqueta: "",
};

const todayStr = format(new Date(), "yyyy-MM-dd");
const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

const ENTRY_DEFAULT_FILTERS = { ...EMPTY_FILTERS, dataInicio: todayStr, dataFim: todayStr };
const REQ_DEFAULT_FILTERS = { ...EMPTY_FILTERS, status_req: "aguardando_confirmacao" };

const MOTIVOS_SANGRIA = ["Retirada bancária", "Pagamento externo", "Troco", "Despesas operacionais", "Outros"];
const ORIGENS_SUPRIMENTO = ["Reforço de caixa", "Troco inicial", "Entrada manual", "Depósito", "Outros"];

function SummaryCard({ title, value, icon: IconComp, color }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <IconComp className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="font-heading font-bold text-xl">
            R$ {(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterPanel({ filters, setFilters, onClear, show }) {
  if (!show) return null;
  const update = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  return (
    <Card className="border-0 shadow-sm mb-4">
      <CardContent className="p-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><Label className="text-xs">Data Inicial</Label><Input type="date" className="mt-1 h-8 text-xs" value={filters.dataInicio} onChange={e => update("dataInicio", e.target.value)} /></div>
          <div><Label className="text-xs">Data Final</Label><Input type="date" className="mt-1 h-8 text-xs" value={filters.dataFim} onChange={e => update("dataFim", e.target.value)} /></div>
          <div>
            <Label className="text-xs">Origem</Label>
            <Select value={filters.origem} onValueChange={v => update("origem", v)}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as origens</SelectItem>
                <SelectItem value="contrato">Contratos</SelectItem>
                <SelectItem value="os">OS Caçamba</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="portal_cliente">Portal Cliente</SelectItem>
                <SelectItem value="sangria">Sangria</SelectItem>
                <SelectItem value="suprimento">Suprimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Forma de Pagamento</Label>
            <Select value={filters.forma_pagamento} onValueChange={v => update("forma_pagamento", v)}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as formas</SelectItem>
                {FORMAS_PGTO.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Cliente</Label><Input className="mt-1 h-8 text-xs" placeholder="Nome do cliente..." value={filters.cliente} onChange={e => update("cliente", e.target.value)} /></div>
          <div><Label className="text-xs">Nº Contrato / OS</Label><Input className="mt-1 h-8 text-xs" placeholder="Número..." value={filters.numero} onChange={e => update("numero", e.target.value)} /></div>
          <div><Label className="text-xs">Valor Mínimo (R$)</Label><Input type="number" className="mt-1 h-8 text-xs" value={filters.valorMin} onChange={e => update("valorMin", e.target.value)} placeholder="0,00" /></div>
          <div><Label className="text-xs">Valor Máximo (R$)</Label><Input type="number" className="mt-1 h-8 text-xs" value={filters.valorMax} onChange={e => update("valorMax", e.target.value)} placeholder="0,00" /></div>
          <div><Label className="text-xs">Etiqueta do cliente</Label><Input className="mt-1 h-8 text-xs" placeholder="Ex: VIP, Imobiliária..." value={filters.etiqueta || ""} onChange={e => update("etiqueta", e.target.value)} /></div>
        </div>
        <div className="flex justify-end mt-3">
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={onClear}>
            <X className="w-3.5 h-3.5" /> Limpar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RequestFilterPanel({ filters, setFilters, onClear, show }) {
  if (!show) return null;
  const update = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  return (
    <Card className="border-0 shadow-sm mb-4">
      <CardContent className="p-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><Label className="text-xs">Data Inicial</Label><Input type="date" className="mt-1 h-8 text-xs" value={filters.dataInicio} onChange={e => update("dataInicio", e.target.value)} /></div>
          <div><Label className="text-xs">Data Final</Label><Input type="date" className="mt-1 h-8 text-xs" value={filters.dataFim} onChange={e => update("dataFim", e.target.value)} /></div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filters.status_req} onValueChange={v => update("status_req", v)}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aguardando_confirmacao">Pendentes</SelectItem>
                <SelectItem value="confirmado">Aprovados</SelectItem>
                <SelectItem value="rejeitado">Rejeitados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de Origem</Label>
            <Select value={filters.origem} onValueChange={v => update("origem", v)}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="contrato">Contratos</SelectItem>
                <SelectItem value="os">OS Caçamba</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Cliente</Label><Input className="mt-1 h-8 text-xs" placeholder="Nome..." value={filters.cliente} onChange={e => update("cliente", e.target.value)} /></div>
          <div><Label className="text-xs">Nº Contrato / OS</Label><Input className="mt-1 h-8 text-xs" placeholder="Número..." value={filters.numero} onChange={e => update("numero", e.target.value)} /></div>
          <div><Label className="text-xs">Registrado por</Label><Input className="mt-1 h-8 text-xs" placeholder="Usuário..." value={filters.registrado_por} onChange={e => update("registrado_por", e.target.value)} /></div>
          <div>
            <Label className="text-xs">Forma de Pagamento</Label>
            <Select value={filters.forma_pagamento} onValueChange={v => update("forma_pagamento", v)}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {FORMAS_PGTO.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={onClear}>
            <X className="w-3.5 h-3.5" /> Limpar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Mostra itens detalhados de uma solicitação aprovada
function RequestItemsDetail({ req }) {
  const [open, setOpen] = useState(false);
  if (!req.itens || req.itens.length === 0) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(v => !v)} className="text-xs text-primary hover:underline flex items-center gap-1">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? "Ocultar itens" : `Ver ${req.itens.length} item(ns) detalhados`}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {req.itens.map((item, i) => (
            <div key={i} className="p-3 rounded-xl bg-muted/40 text-xs space-y-1 border">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold mr-1 ${item.tipo === "os" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                    {item.tipo === "os" ? "OS" : "CTR"}
                  </span>
                  <span className="font-semibold">#{item.numero}</span>
                  {item.descricao && <span className="text-muted-foreground ml-1">— {item.descricao}</span>}
                </div>
                <span className="font-bold text-emerald-700">R$ {(item.valor_final || item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
              {item.endereco && <p className="text-muted-foreground">📍 {item.endereco}</p>}
              {item.obra_nome && <p className="text-muted-foreground">🏗️ {item.obra_nome}</p>}
              {item.desconto > 0 && <p className="text-amber-600">Desconto: − R$ {item.desconto.toFixed(2)}</p>}
              {item.forma_pagamento && <p className="text-muted-foreground">💳 {FORMAS_PGTO.find(f => f.key === item.forma_pagamento)?.label || item.forma_pagamento}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CashFlow() {
  const [entries, setEntries] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [period, setPeriod] = useState("mes");
  const [filterType, setFilterType] = useState("todos");
  const [dialog, setDialog] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approving, setApproving] = useState(false);
  const [editRequestEntry, setEditRequestEntry] = useState(null);
  const [approveEditEntry, setApproveEditEntry] = useState(null);

  // openCash declarado antes do useMemo que o usa
  const openCash = registers.find((r) => r.status === "aberto");

  // Saldo em dinheiro do caixa aberto (calculado em tempo real)
  const saldoDinheiro = useMemo(() => {
    if (!openCash) return 0;
    const caixaEntries = entries.filter(e => e.caixa_id === openCash.id && e.status !== "cancelado");
    const entradas = caixaEntries.filter(e => e.tipo === "receita" && e.forma_pagamento === "dinheiro").reduce((s, e) => s + (e.valor || 0), 0);
    const suprimentos = caixaEntries.filter(e => e.tipo === "suprimento").reduce((s, e) => s + (e.valor || 0), 0);
    const sangrias = caixaEntries.filter(e => e.tipo === "sangria").reduce((s, e) => s + (e.valor || 0), 0);
    const despesas = caixaEntries.filter(e => e.tipo === "despesa" && e.forma_pagamento === "dinheiro").reduce((s, e) => s + (e.valor || 0), 0);
    return (openCash.valor_inicial || 0) + entradas + suprimentos - sangrias - despesas;
  }, [entries, openCash]);

  const [showEntryFilters, setShowEntryFilters] = useState(false);
  const [showReqFilters, setShowReqFilters] = useState(false);
  const [entryFilters, setEntryFilters] = useState(ENTRY_DEFAULT_FILTERS);
  const [reqFilters, setReqFilters] = useState(REQ_DEFAULT_FILTERS);
  const [caixaDateInicio, setCaixaDateInicio] = useState(weekStart);
  const [caixaDateFim, setCaixaDateFim] = useState(weekEnd);

  const initialTab = new URLSearchParams(window.location.search).get("tab") === "solicitacoes" ? "pagamentos" : "lancamentos";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [entryForm, setEntryForm] = useState({
    tipo: "receita", categoria: "", descricao: "", valor: "",
    forma_pagamento: "pix", data: format(new Date(), "yyyy-MM-dd"), observacoes: ""
  });
  const [cashForm, setCashForm] = useState({ valor_inicial: "", responsavel: "", observacoes: "" });

  // Sangria/Suprimento form
  const [sangriaForm, setSangriaForm] = useState({ valor: "", motivo: "", observacoes: "", responsavel: "" });
  const [suprimentoForm, setSuprimentoForm] = useState({ valor: "", origem: "", observacoes: "", responsavel: "" });

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
    loadData();
  }, []);

  const loadData = async () => {
    const [e, r, p] = await Promise.all([
      base44.entities.CashEntry.list("-created_date", 500),
      base44.entities.CashRegister.list("-data_abertura", 10),
      base44.entities.PaymentRequest.list("-created_date", 200),
    ]);
    // Ordena: mais recente primeiro (data desc, hora desc)
    const sorted = [...e].sort((a, b) => {
      const da = (a.data || "") + (a.hora || "99:99");
      const db = (b.data || "") + (b.hora || "99:99");
      return db.localeCompare(da);
    });
    setEntries(sorted);
    setRegisters(r);
    setPaymentRequests(p);
    setLoading(false);
  };

  const getDateRange = () => {
    const now = new Date();
    if (period === "dia") return { start: startOfDay(now), end: endOfDay(now) };
    if (period === "semana") return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    return { start: startOfMonth(now), end: endOfMonth(now) };
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (e.status === "cancelado") return false;
      const range = getDateRange();
      try {
        const d = parseISO(e.data);
        if (!isWithinInterval(d, range)) return false;
      } catch { return false; }
      if (filterType !== "todos" && e.tipo !== filterType) return false;
      const f = entryFilters;
      if (f.dataInicio && e.data < f.dataInicio) return false;
      if (f.dataFim && e.data > f.dataFim) return false;
      if (f.origem !== "todos" && e.origem !== f.origem) return false;
      if (f.forma_pagamento !== "todos" && e.forma_pagamento !== f.forma_pagamento) return false;
      if (f.cliente && !e.client_nome?.toLowerCase().includes(f.cliente.toLowerCase())) return false;
      if (f.numero && !e.origem_numero?.includes(f.numero)) return false;
      if (f.valorMin && (e.valor || 0) < parseFloat(f.valorMin)) return false;
      if (f.valorMax && (e.valor || 0) > parseFloat(f.valorMax)) return false;
      if (f.etiqueta) {
        const normalize = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const matchEtq = (e.client_etiquetas || []).some(et => normalize(et).includes(normalize(f.etiqueta)));
        if (!matchEtq) return false;
      }
      return true;
    });
  }, [entries, period, filterType, entryFilters]);

  const filteredRequests = useMemo(() => {
    return paymentRequests.filter((req) => {
      const f = reqFilters;
      if (f.dataInicio && req.data && req.data < f.dataInicio) return false;
      if (f.dataFim && req.data && req.data > f.dataFim) return false;
      if (f.status_req !== "todos" && req.status !== f.status_req) return false;
      if (f.cliente && !req.client_nome?.toLowerCase().includes(f.cliente.toLowerCase())) return false;
      if (f.registrado_por && !req.registrado_por?.toLowerCase().includes(f.registrado_por.toLowerCase())) return false;
      if (f.numero) {
        const hasNum = (req.itens || []).some(i => i.numero?.includes(f.numero));
        if (!hasNum) return false;
      }
      if (f.origem !== "todos") {
        const hasOrig = (req.itens || []).some(i => i.tipo === f.origem);
        if (!hasOrig) return false;
      }
      if (f.forma_pagamento !== "todos") {
        const hasForma = (req.itens || []).some(i => i.forma_pagamento === f.forma_pagamento);
        if (!hasForma) return false;
      }
      return true;
    });
  }, [paymentRequests, reqFilters]);

  const totalEntradas = filteredEntries.filter((e) => e.tipo === "receita").reduce((s, e) => s + (e.valor || 0), 0);
  const totalSaidas = filteredEntries.filter((e) => e.tipo === "despesa").reduce((s, e) => s + (e.valor || 0), 0);
  const totalSangria = filteredEntries.filter((e) => e.tipo === "sangria").reduce((s, e) => s + (e.valor || 0), 0);
  const totalSuprimento = filteredEntries.filter((e) => e.tipo === "suprimento").reduce((s, e) => s + (e.valor || 0), 0);
  const saldo = totalEntradas - totalSaidas - totalSangria + totalSuprimento;

  const handleSaveEntry = async () => {
    if (!openCash) { toast.error("❌ Caixa fechado. Abra o caixa para realizar lançamentos."); return; }
    if (!entryForm.valor || !entryForm.data) { toast.error("Preencha valor e data"); return; }
    await base44.entities.CashEntry.create({
      ...entryForm,
      valor: parseFloat(entryForm.valor),
      hora: format(new Date(), "HH:mm"),
      origem: "manual",
      status: "confirmado",
      caixa_id: openCash?.id || "",
      usuario: currentUser?.email || "",
      usuario_nome: currentUser?.full_name || "",
    });
    toast.success("Lançamento salvo!");
    setDialog(null);
    loadData();
  };

  const handleSaveSangria = async () => {
    if (!openCash) { toast.error("❌ Caixa fechado. Abra o caixa para realizar sangrias."); return; }
    if (!sangriaForm.valor) { toast.error("Informe o valor"); return; }
    await base44.entities.CashEntry.create({
      tipo: "sangria",
      descricao: sangriaForm.motivo || "Sangria de caixa",
      motivo: sangriaForm.motivo,
      valor: parseFloat(sangriaForm.valor),
      data: format(new Date(), "yyyy-MM-dd"),
      hora: format(new Date(), "HH:mm"),
      origem: "sangria",
      status: "confirmado",
      caixa_id: openCash?.id || "",
      responsavel: sangriaForm.responsavel || currentUser?.full_name || "",
      usuario: currentUser?.email || "",
      usuario_nome: currentUser?.full_name || "",
      observacoes: sangriaForm.observacoes,
    });
    toast.success("Sangria registrada!");
    setDialog(null);
    setSangriaForm({ valor: "", motivo: "", observacoes: "", responsavel: "" });
    loadData();
  };

  const handleSaveSuprimento = async () => {
    if (!openCash) { toast.error("❌ Caixa fechado. Abra o caixa para realizar suprimentos."); return; }
    if (!suprimentoForm.valor) { toast.error("Informe o valor"); return; }
    await base44.entities.CashEntry.create({
      tipo: "suprimento",
      descricao: suprimentoForm.origem || "Suprimento de caixa",
      motivo: suprimentoForm.origem,
      valor: parseFloat(suprimentoForm.valor),
      data: format(new Date(), "yyyy-MM-dd"),
      hora: format(new Date(), "HH:mm"),
      origem: "suprimento",
      status: "confirmado",
      caixa_id: openCash?.id || "",
      responsavel: suprimentoForm.responsavel || currentUser?.full_name || "",
      usuario: currentUser?.email || "",
      usuario_nome: currentUser?.full_name || "",
      observacoes: suprimentoForm.observacoes,
    });
    toast.success("Suprimento registrado!");
    setDialog(null);
    setSuprimentoForm({ valor: "", origem: "", observacoes: "", responsavel: "" });
    loadData();
  };

  const handleOpenCash = async () => {
    if (!cashForm.valor_inicial || !cashForm.responsavel) { toast.error("Preencha os campos"); return; }
    await base44.entities.CashRegister.create({
      data_abertura: new Date().toISOString(),
      responsavel: cashForm.responsavel,
      valor_inicial: parseFloat(cashForm.valor_inicial),
      status: "aberto",
      observacoes: cashForm.observacoes,
    });
    toast.success("Caixa aberto!");
    setDialog(null);
    loadData();
  };

  const handleCloseCash = async () => {
    const cashEntries = entries.filter((e) => e.caixa_id === openCash.id && e.status === "confirmado");
    const entradas = cashEntries.filter((e) => e.tipo === "receita").reduce((s, e) => s + e.valor, 0);
    const saidas = cashEntries.filter((e) => e.tipo === "despesa").reduce((s, e) => s + e.valor, 0);
    const sangrias = cashEntries.filter((e) => e.tipo === "sangria").reduce((s, e) => s + e.valor, 0);
    const suprimentos = cashEntries.filter((e) => e.tipo === "suprimento").reduce((s, e) => s + e.valor, 0);
    const saldoFinal = (openCash.valor_inicial || 0) + entradas - saidas - sangrias + suprimentos;
    await base44.entities.CashRegister.update(openCash.id, {
      data_fechamento: new Date().toISOString(),
      total_entradas: entradas,
      total_saidas: saidas,
      saldo_final: saldoFinal,
      status: "fechado",
    });
    toast.success("Caixa fechado!");
    setDialog(null);
    loadData();
  };

  const handleApprovePayment = async (req, approve) => {
    if (approve && !openCash) {
      toast.error("❌ Caixa fechado. Abra o caixa para aprovar pagamentos.");
      return;
    }
    // TRAVA DUPLA APROVAÇÃO: verifica se já existe lançamento para esta solicitação
    if (approve) {
      const existingEntry = entries.find(e => e.payment_request_id === req.id);
      if (existingEntry) {
        toast.error("⚠️ Esta solicitação já foi aprovada e o lançamento já foi registrado no caixa.");
        return;
      }
      // Também verifica se já está confirmada
      if (req.status === "confirmado") {
        toast.error("✓ Solicitação já aprovada anteriormente.");
        return;
      }
    }

    setApproving(true);

    await base44.entities.PaymentRequest.update(req.id, {
      status: approve ? "confirmado" : "rejeitado",
      confirmado_por: currentUser?.email || "",
      motivo_rejeicao: approve ? "" : rejectionReason,
    });

    if (approve) {
      const valorTotal = req.valor_total || 0;
      const formasPgto = [...new Set((req.itens || []).map(i => i.forma_pagamento).filter(Boolean))];
      const formaPrincipal = formasPgto[0] || "pix";

      // Lança UMA ÚNICA entrada com flag anti-duplo
      const numerosRefs = (req.itens || []).map(i => {
        if (i.tipo === "os") return `OS Nº ${i.numero}`;
        if (i.tipo === "contrato") return `Contrato Nº ${i.numero}`;
        if (i.tipo === "venda") return `Venda Nº ${i.numero}`;
        return `Nº ${i.numero}`;
      }).filter(Boolean).join(", ");
      const descricaoLancamento = numerosRefs
        ? `Pagamento referente ao ${numerosRefs} — ${req.client_nome}`
        : (req.observacoes || `Pagamento aprovado — ${req.client_nome}`);

      await base44.entities.CashEntry.create({
        tipo: "receita",
        categoria: "Aluguel de Equipamento",
        descricao: descricaoLancamento,
        valor: valorTotal,
        forma_pagamento: formaPrincipal,
        data: format(new Date(), "yyyy-MM-dd"),
        hora: format(new Date(), "HH:mm"),
        origem: "contrato",
        origem_id: req.id,
        origem_numero: (req.itens || []).map(i => i.numero).filter(Boolean).join(", "),
        client_nome: req.client_nome,
        status: "confirmado",
        caixa_id: openCash?.id || "",
        comprovante_url: req.comprovante_url || "",
        observacoes: req.observacoes || "",
        usuario: currentUser?.email || "",
        usuario_nome: currentUser?.full_name || "",
        payment_request_id: req.id, // flag anti-duplo
      });

      let saldoRestante = valorTotal;
      const hojeStr = format(new Date(), "yyyy-MM-dd");

      // Busca nota vinculada ANTES do loop para usar o pago_ate de cada item
      const notaIdAntes = req.nota_id;
      const notaNumMatchAntes = !notaIdAntes && (req.observacoes || "").match(/Nota\s*#(\S+)/i);
      const notaVinculadaQueryAntes = notaIdAntes
        ? await base44.entities.BillingNote.filter({ id: notaIdAntes }).catch(() => [])
        : notaNumMatchAntes
          ? await base44.entities.BillingNote.filter({ numero: notaNumMatchAntes[1] }).catch(() => [])
          : [];
      const notaVinculadaAntes = notaVinculadaQueryAntes[0] || null;

      for (const item of req.itens || []) {
        if (saldoRestante <= 0) break;
        const formaPgto = item.forma_pagamento || formaPrincipal;

        if (item.tipo === "contrato" && item.id) {
          const [ct] = await base44.entities.Contract.filter({ id: item.id });
          if (ct) {
            // Desconto já embutido em item.valor_final — usar como teto do saldo devedor para este item
            const valorComDesconto = item.valor_final || item.valor || 0;
            const descontoAplicado = item.desconto || 0;
            const saldoContrato = ct.dinamico_valor_em_aberto > 0 ? ct.dinamico_valor_em_aberto : (ct.saldo_pagar || 0);
            // O saldo a abater considera o desconto: se saldo original era X e há desconto D, o novo teto é X - D
            const saldoComDesconto = Math.max(0, saldoContrato - descontoAplicado);
            const abater = Math.min(saldoRestante, saldoComDesconto);
            saldoRestante -= abater;
            const novoValorPago = (ct.valor_pago || 0) + abater;
            const novoSaldo = Math.max(0, saldoComDesconto - abater);
            const novoStatusFin = novoSaldo === 0 ? "pago" : novoValorPago > 0 ? "parcial" : "pendente";
            // Descobre o "pago_ate" da nota vinculada para gravar ultima_nota_paga_ate
            // Isso é o único campo que controla o período faturado real — só atualizado após pagamento confirmado.
            let pagoAteData = null;
            if (notaVinculadaAntes) {
              const itemNota = (notaVinculadaAntes.itens || []).find(i => i.id === item.id && i.tipo === "contrato");
              pagoAteData = itemNota?.pago_ate || itemNota?.periodo_ate || null;
            }

            const updates = {
              status_financeiro: novoStatusFin,
              valor_pago: novoValorPago,
              saldo_pagar: novoSaldo,
              forma_pagamento: formaPgto,
              valor_recebido_ultima_baixa: abater,
              dinamico_data_base: hojeStr,
              dinamico_dias_em_aberto: novoSaldo === 0 ? 0 : ct.dinamico_dias_em_aberto,
              dinamico_valor_em_aberto: novoSaldo,
              dinamico_valor_pago_acumulado: (ct.dinamico_valor_pago_acumulado || 0) + abater,
              dinamico_ultima_atualizacao: new Date().toISOString(),
            };
            // Grava ultima_nota_paga_ate SOMENTE quando a nota fica totalmente paga
            // Esse campo é a referência de período faturado pago — controla a próxima cobrança
            if (novoSaldo === 0 && pagoAteData) {
              updates.ultima_nota_paga_ate = pagoAteData;
            }
            if (novoSaldo === 0 && ct.status === "devolvido_pendente") updates.status = "finalizado";
            await base44.entities.Contract.update(item.id, updates);

            // ─── Gerar BillingNote automática se não veio de uma nota já existente
            const temNotaVinculada = !!(req.nota_id || (req.observacoes || "").match(/Nota\s*#(\S+)/i));
            if (!temNotaVinculada) {
              // Verifica se já existe nota para este pagamento (anti-duplo pelo payment_request_id)
              const notasExistentes = await base44.entities.BillingNote.list("-created_date", 20);
              const jaTemNota = notasExistentes.some(n =>
                n.payment_request_id === req.id ||
                (n.contratos_ids || []).includes(item.id) && n.created_date > new Date(Date.now() - 60000).toISOString()
              );
              if (!jaTemNota) {
                let novoNumero = "";
                try {
                  const counters = await base44.entities.Counter.filter({ tipo: "nota_cobranca" });
                  if (counters.length > 0) {
                    const next = (counters[0].ultimo_numero || 1000) + 1;
                    await base44.entities.Counter.update(counters[0].id, { ultimo_numero: next });
                    novoNumero = String(next);
                  } else {
                    await base44.entities.Counter.create({ tipo: "nota_cobranca", ultimo_numero: 1001 });
                    novoNumero = "1001";
                  }
                } catch { novoNumero = Date.now().toString().slice(-6); }

                await base44.entities.BillingNote.create({
                  numero: novoNumero,
                  client_id: req.client_id || ct.client_id,
                  client_nome: req.client_nome || ct.client_nome,
                  client_cpf_cnpj: ct.client_cpf_cnpj || "",
                  contratos_ids: [item.id],
                  contratos_numeros: [item.numero || ct.numero],
                  os_ids: [],
                  os_numeros: [],
                  tipo: "contrato",
                  itens: [{
                    tipo: "contrato",
                    numero: item.numero || ct.numero,
                    id: item.id,
                    descricao: item.descricao || `Contrato #${item.numero || ct.numero}`,
                    valor_original: saldoContrato,
                    desconto: descontoAplicado,
                    valor_final: valorComDesconto,
                  }],
                  valor_bruto: saldoContrato,
                  desconto: descontoAplicado,
                  valor_final: valorComDesconto,
                  valor_pago: abater,
                  saldo_aberto: Math.max(0, valorComDesconto - abater),
                  status: novoSaldo === 0 ? "pago" : abater > 0 ? "parcial" : "pendente",
                  forma_pagamento: formaPgto,
                  pagamentos: [{
                    data: hojeStr,
                    valor: abater,
                    forma: formaPgto,
                    registrado_por: req.registrado_por || currentUser?.full_name || "",
                    observacao: req.observacoes || "",
                    status: "confirmado",
                  }],
                  payment_request_id: req.id,
                  criado_por: currentUser?.email || "",
                });
              }
            }
          }
        } else if (item.tipo === "os" && item.id) {
          const valorOS = item.valor_final || item.valor || 0;
          saldoRestante -= Math.min(saldoRestante, valorOS);
          await base44.entities.ServiceOrder.update(item.id, { status_pagamento: "pago" });
        }
      }

      // ─── Atualiza BillingNote vinculada via nota_id (método direto) ou via padrão de texto nas observações
      const notaId = req.nota_id;
      const notaNumMatch = !notaId && (req.observacoes || "").match(/Nota\s*#(\S+)/i);
      const notaVinculadaQuery = notaId
        ? await base44.entities.BillingNote.filter({ id: notaId }).catch(() => [])
        : notaNumMatch
          ? await base44.entities.BillingNote.filter({ numero: notaNumMatch[1] }).catch(() => [])
          : [];
      const notaVinculada = notaVinculadaQuery[0];
      if (notaVinculada) {
        const pagsAtualizados = (notaVinculada.pagamentos || []).map(p =>
          p.status === "aguardando_confirmacao" ? { ...p, status: "confirmado" } : p
        );
        const totalPagoConfirmado = pagsAtualizados.filter(p => p.status === "confirmado").reduce((s, p) => s + (p.valor || 0), 0);
        const novoSaldoNota = Math.max(0, (notaVinculada.valor_final || 0) - totalPagoConfirmado);
        const novoStatusNota = novoSaldoNota === 0 ? "pago" : totalPagoConfirmado > 0 ? "parcial" : "pendente";
        await base44.entities.BillingNote.update(notaVinculada.id, {
          pagamentos: pagsAtualizados,
          valor_pago: totalPagoConfirmado,
          saldo_aberto: novoSaldoNota,
          status: novoStatusNota,
        });
      }
    } else {
      // Rejeição — reverte pagamentos pendentes na nota vinculada
      const notaId = req.nota_id;
      const notaNumMatch = !notaId && (req.observacoes || "").match(/Nota\s*#(\S+)/i);
      const notaVinculadaQuery = notaId
        ? await base44.entities.BillingNote.filter({ id: notaId }).catch(() => [])
        : notaNumMatch
          ? await base44.entities.BillingNote.filter({ numero: notaNumMatch[1] }).catch(() => [])
          : [];
      const notaVinculada = notaVinculadaQuery[0];
      if (notaVinculada) {
        const pagsAtualizados = (notaVinculada.pagamentos || []).map(p =>
          p.status === "aguardando_confirmacao" ? { ...p, status: "rejeitado" } : p
        );
        await base44.entities.BillingNote.update(notaVinculada.id, { pagamentos: pagsAtualizados });
      }
    }

    setApproving(false);
    toast.success(approve ? "Pagamento aprovado! Caixa e contratos atualizados." : "Pagamento rejeitado.");
    setDialog(null);
    setSelectedRequest(null);
    setRejectionReason("");
    loadData();
  };

  const pendingRequests = paymentRequests.filter((r) => r.status === "aguardando_confirmacao");
  const isFinanceiro = ["admin", "financeiro", "atendente"].includes((currentUser?.role || "").toLowerCase());
  const activeEntryFiltersCount = Object.entries(entryFilters).filter(([, v]) => v && v !== "todos").length;
  const activeReqFiltersCount = Object.entries(reqFilters).filter(([, v]) => v && v !== "todos").length;

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const label = format(d, "dd/MM");
    const dayStr = format(d, "yyyy-MM-dd");
    const dayEntries = entries.filter((e) => e.data === dayStr && e.status === "confirmado");
    return {
      name: label,
      receitas: dayEntries.filter((e) => e.tipo === "receita").reduce((s, e) => s + e.valor, 0),
      despesas: dayEntries.filter((e) => e.tipo === "despesa").reduce((s, e) => s + e.valor, 0),
    };
  });

  const tipoLabel = (tipo) => {
    const map = { receita: "Receita", despesa: "Despesa", sangria: "Sangria", suprimento: "Suprimento" };
    return map[tipo] || tipo;
  };

  const tipoColor = (tipo) => {
    if (tipo === "receita") return "text-emerald-700";
    if (tipo === "despesa") return "text-red-700";
    if (tipo === "sangria") return "text-orange-700";
    if (tipo === "suprimento") return "text-blue-700";
    return "";
  };

  const tipoSign = (tipo) => {
    if (tipo === "receita" || tipo === "suprimento") return "+";
    return "−";
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div>
      <PageHeader title="Fluxo de Caixa" subtitle="Controle financeiro completo">
        <div className="flex gap-2 flex-wrap">
          {openCash ? (
            <Button variant="destructive" size="sm" onClick={() => setDialog("close_cash")} className="gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Fechar Caixa
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setDialog("open_cash")} className="gap-1.5">
              <Unlock className="w-3.5 h-3.5" /> Abrir Caixa
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setDialog("sangria")} className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50">
            <ArrowDownCircle className="w-3.5 h-3.5" /> Sangria
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialog("suprimento")} className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
            <ArrowUpCircle className="w-3.5 h-3.5" /> Suprimento
          </Button>
          <Button size="sm" onClick={() => setDialog("entry")} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Lançamento
          </Button>
        </div>
      </PageHeader>

      {openCash && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
          <Unlock className="w-4 h-4" />
          <span>Caixa aberto por <strong>{openCash.responsavel}</strong> — saldo inicial: R$ {(openCash.valor_inicial || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          <span className="ml-auto font-bold">💵 Saldo em dinheiro: R$ {saldoDinheiro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
        </div>
      )}

      {!openCash && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>❌ Caixa fechado. Abra o caixa para realizar lançamentos, sangrias, suprimentos e aprovar pagamentos.</span>
        </div>
      )}

      {pendingRequests.length > 0 && isFinanceiro && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>{pendingRequests.length} pagamento(s) aguardando confirmação.</span>
          <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => setActiveTab("pagamentos")}>Revisar</Button>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ k: "dia", l: "Hoje" }, { k: "semana", l: "Semana" }, { k: "mes", l: "Mês" }].map(({ k, l }) => (
          <Button key={k} size="sm" variant={period === k ? "default" : "outline"} onClick={() => setPeriod(k)}>{l}</Button>
        ))}
        <div className="ml-auto flex gap-2 flex-wrap">
          {[{ k: "todos", l: "Todos" }, { k: "receita", l: "Receitas" }, { k: "despesa", l: "Despesas" }, { k: "sangria", l: "Sangrias" }, { k: "suprimento", l: "Suprimentos" }].map(({ k, l }) => (
            <Button key={k} size="sm" variant={filterType === k ? "secondary" : "ghost"} onClick={() => setFilterType(k)}>{l}</Button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <SummaryCard title="Entradas" value={totalEntradas} icon={TrendingUp} color="bg-emerald-100 text-emerald-700" />
        <SummaryCard title="Saídas" value={totalSaidas} icon={TrendingDown} color="bg-red-100 text-red-700" />
        <SummaryCard title="Sangrias" value={totalSangria} icon={ArrowDownCircle} color="bg-orange-100 text-orange-700" />
        <SummaryCard title="Saldo" value={saldo} icon={DollarSign} color={saldo >= 0 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="grafico">Gráfico 7 dias</TabsTrigger>
          <TabsTrigger value="caixas">Caixas</TabsTrigger>
          {isFinanceiro && (
            <TabsTrigger value="pagamentos" className="relative">
              Solicitações
              {pendingRequests.length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px]">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
          )}
          {currentUser?.role === "admin" && (
            <TabsTrigger value="automatizacao">
              ⚙ Automação
            </TabsTrigger>
          )}
        </TabsList>

        {/* LANÇAMENTOS */}
        <TabsContent value="lancamentos">
          <div className="flex items-center gap-2 mb-3">
            <Button size="sm" variant={showEntryFilters ? "default" : "outline"} className="gap-1.5 h-8 text-xs" onClick={() => setShowEntryFilters(v => !v)}>
              <Filter className="w-3.5 h-3.5" /> Filtros Avançados
              {activeEntryFiltersCount > 0 && <span className="bg-white text-primary text-[10px] font-bold rounded-full px-1.5 py-0.5">{activeEntryFiltersCount}</span>}
              {showEntryFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
            {activeEntryFiltersCount > 0 && (
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setEntryFilters(ENTRY_DEFAULT_FILTERS)}>
                <X className="w-3.5 h-3.5" /> Limpar
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {filteredEntries.length} registro(s)
            </span>
          </div>
          <FilterPanel filters={entryFilters} setFilters={setEntryFilters} onClear={() => setEntryFilters(ENTRY_DEFAULT_FILTERS)} show={showEntryFilters} />
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-semibold">Data/Hora</th>
                      <th className="text-left p-3 font-semibold">Tipo</th>
                      <th className="text-left p-3 font-semibold">Descrição</th>
                      <th className="text-left p-3 font-semibold hidden sm:table-cell">Responsável</th>
                      <th className="text-left p-3 font-semibold hidden md:table-cell">Forma</th>
                      <th className="text-right p-3 font-semibold">Valor</th>
                      <th className="text-center p-3 font-semibold w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Nenhum lançamento encontrado</td></tr>
                    )}
                    {filteredEntries.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {e.data ? format(parseISO(e.data), "dd/MM/yyyy") : "—"}
                          {e.hora
                            ? <span className="block text-[10px] font-medium text-foreground/70">{e.hora}</span>
                            : e.created_date
                              ? <span className="block text-[10px] text-muted-foreground/60">{format(new Date(e.created_date), "HH:mm")}</span>
                              : null
                          }
                        </td>
                        <td className="p-3 text-xs">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            e.tipo === "receita" ? "bg-emerald-100 text-emerald-700" :
                            e.tipo === "sangria" ? "bg-orange-100 text-orange-700" :
                            e.tipo === "suprimento" ? "bg-blue-100 text-blue-700" :
                            "bg-red-100 text-red-700"
                          }`}>{tipoLabel(e.tipo)}</span>
                        </td>
                        <td className="p-3 font-medium text-xs">
                          <div>{e.descricao || e.motivo || "—"}</div>
                          {e.client_nome && <div className="text-muted-foreground">{e.client_nome}</div>}
                          {e.origem_numero && (
                            <div className="text-[10px] text-primary/80 font-semibold mt-0.5">
                              {e.origem === "contrato" ? "📋 Contrato" : e.origem === "os" ? "📦 OS" : "📄 Ref"}: #{e.origem_numero}
                            </div>
                          )}
                          {e.observacoes && !e.origem_numero && <div className="text-muted-foreground text-[10px]">{e.observacoes}</div>}
                          <EditRequestBadge entry={e} />
                        </td>
                        <td className="p-3 text-xs text-muted-foreground hidden sm:table-cell">
                          {e.usuario_nome || e.responsavel || "—"}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">
                          {FORMAS_PGTO.find(f => f.key === e.forma_pagamento)?.label || e.forma_pagamento || "—"}
                        </td>
                        <td className={`p-3 text-right font-bold text-xs whitespace-nowrap ${tipoColor(e.tipo)}`}>
                          {tipoSign(e.tipo)} R$ {(e.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          {currentUser?.role === "admin" && (e.solicitacoes_edicao || []).some(s => s.status === "aguardando") ? (
                            <button
                              onClick={() => setApproveEditEntry(e)}
                              className="p-1 rounded hover:bg-amber-50 text-amber-600 transition-colors"
                              title="Revisar solicitação de edição"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditRequestEntry(e)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Solicitar edição"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grafico">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base font-heading">Últimos 7 dias</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  <Bar dataKey="receitas" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} name="Receitas" />
                  <Bar dataKey="despesas" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} name="Despesas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="caixas">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">De:</Label>
              <Input type="date" className="h-8 text-xs w-36" value={caixaDateInicio} onChange={e => setCaixaDateInicio(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Até:</Label>
              <Input type="date" className="h-8 text-xs w-36" value={caixaDateFim} onChange={e => setCaixaDateFim(e.target.value)} />
            </div>
            <div className="flex gap-1 flex-wrap">
              {[
                { label: "Hoje", s: todayStr, e: todayStr },
                { label: "Semana", s: weekStart, e: weekEnd },
                { label: "Mês", s: format(startOfMonth(new Date()), "yyyy-MM-dd"), e: format(endOfMonth(new Date()), "yyyy-MM-dd") },
              ].map(({ label, s, e }) => (
                <Button key={label} size="sm" variant={caixaDateInicio === s && caixaDateFim === e ? "default" : "outline"} className="h-8 text-xs" onClick={() => { setCaixaDateInicio(s); setCaixaDateFim(e); }}>
                  {label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => { setCaixaDateInicio(""); setCaixaDateFim(""); }}>
                <X className="w-3 h-3" /> Todos
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {registers.filter(r => {
              if (!caixaDateInicio && !caixaDateFim) return true;
              const d = r.data_abertura ? r.data_abertura.split("T")[0] : "";
              if (caixaDateInicio && d < caixaDateInicio) return false;
              if (caixaDateFim && d > caixaDateFim) return false;
              return true;
            }).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum caixa encontrado no período</p>}
            {registers.filter(r => {
              if (!caixaDateInicio && !caixaDateFim) return true;
              const d = r.data_abertura ? r.data_abertura.split("T")[0] : "";
              if (caixaDateInicio && d < caixaDateInicio) return false;
              if (caixaDateFim && d > caixaDateFim) return false;
              return true;
            }).map((r) => (
              <Card key={r.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{format(new Date(r.data_abertura), "dd/MM/yyyy HH:mm")}</p>
                      <p className="text-xs text-muted-foreground">Responsável: {r.responsavel}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${r.status === "aberto" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {r.status === "aberto" ? "Aberto" : "Fechado"}
                    </span>
                  </div>
                  {r.status === "fechado" && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-2">
                      <div className="bg-muted/30 rounded-lg p-2"><p className="text-muted-foreground">Inicial</p><p className="font-bold">R$ {(r.valor_inicial || 0).toLocaleString("pt-BR")}</p></div>
                      <div className="bg-emerald-50 rounded-lg p-2"><p className="text-muted-foreground">Entradas</p><p className="font-bold text-emerald-700">R$ {(r.total_entradas || 0).toLocaleString("pt-BR")}</p></div>
                      <div className="bg-red-50 rounded-lg p-2"><p className="text-muted-foreground">Saídas</p><p className="font-bold text-red-700">R$ {(r.total_saidas || 0).toLocaleString("pt-BR")}</p></div>
                      <div className="bg-blue-50 rounded-lg p-2"><p className="text-muted-foreground">Saldo Final</p><p className="font-bold text-blue-700">R$ {(r.saldo_final || 0).toLocaleString("pt-BR")}</p></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* SOLICITAÇÕES */}

        {isFinanceiro && (
          <TabsContent value="pagamentos">
            <div className="flex items-center gap-2 mb-3">
              <Button size="sm" variant={showReqFilters ? "default" : "outline"} className="gap-1.5 h-8 text-xs" onClick={() => setShowReqFilters(v => !v)}>
                <Filter className="w-3.5 h-3.5" /> Filtros Avançados
                {activeReqFiltersCount > 0 && <span className="bg-white text-primary text-[10px] font-bold rounded-full px-1.5 py-0.5">{activeReqFiltersCount}</span>}
                {showReqFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
              {activeReqFiltersCount > 0 && (
                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setReqFilters(REQ_DEFAULT_FILTERS)}>
                  <X className="w-3.5 h-3.5" /> Limpar
                </Button>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {filteredRequests.length} solicitação(ões)
              </span>
            </div>
            <RequestFilterPanel filters={reqFilters} setFilters={setReqFilters} onClear={() => setReqFilters(REQ_DEFAULT_FILTERS)} show={showReqFilters} />
            <div className="space-y-3">
              {filteredRequests.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação encontrada</p>}
              {filteredRequests.map((req) => {
                const alreadyApproved = req.status === "confirmado" || entries.some(e => e.payment_request_id === req.id);
                return (
                  <Card key={req.id} className={`border-0 shadow-sm ${req.status === "aguardando_confirmacao" ? "border-l-4 border-l-amber-400" : req.status === "confirmado" ? "border-l-4 border-l-emerald-400" : "border-l-4 border-l-red-400"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{req.client_nome}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              req.status === "aguardando_confirmacao" ? "bg-amber-100 text-amber-700" :
                              req.status === "confirmado" ? "bg-emerald-100 text-emerald-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {req.status === "aguardando_confirmacao" ? "⏳ Aguardando" : req.status === "confirmado" ? "✓ Confirmado" : "✗ Rejeitado"}
                            </span>
                            {alreadyApproved && req.status === "confirmado" && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-200">✓ Já lançado no caixa</span>
                            )}
                          </div>

                          {/* Itens detalhados */}
                          <RequestItemsDetail req={req} />

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-bold text-foreground">Total: R$ {(req.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            <span>Data: {req.data ? format(parseISO(req.data), "dd/MM/yyyy") : "—"}</span>
                            {req.registrado_por && <span>Por: {req.registrado_por}</span>}
                            {req.confirmado_por && req.status !== "aguardando_confirmacao" && <span>Aprovado/Rejeitado por: {req.confirmado_por}</span>}
                            {req.observacoes && <span>Obs: {req.observacoes}</span>}
                          </div>
                          {req.comprovante_url && (
                            <a href={req.comprovante_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Ver comprovante
                            </a>
                          )}
                          {req.motivo_rejeicao && <p className="text-xs text-red-600 mt-1">Motivo: {req.motivo_rejeicao}</p>}
                        </div>
                        {req.status === "aguardando_confirmacao" && !alreadyApproved && (
                          <div className="flex flex-col gap-2 shrink-0">
                            <Button size="sm" className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap" onClick={() => handleApprovePayment(req, true)} disabled={approving}>
                              <CheckCircle className="w-3 h-3" /> {approving ? "..." : "Aprovar"}
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs" onClick={() => { setSelectedRequest(req); setDialog("reject"); }}>
                              <XCircle className="w-3 h-3" /> Rejeitar
                            </Button>
                          </div>
                        )}
                        {alreadyApproved && req.status === "aguardando_confirmacao" && (
                          <span className="text-xs text-muted-foreground shrink-0">Já processado</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        )}

        {/* AUTOMAÇÃO DE CAIXA */}
        {currentUser?.role === "admin" && (
          <TabsContent value="automatizacao">
            <CashAutoConfigPanel
              currentUser={currentUser}
              openCash={openCash}
              registers={registers}
              onRefresh={loadData}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      {/* Dialog: New Entry */}
      <Dialog open={dialog === "entry"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button variant={entryForm.tipo === "receita" ? "default" : "outline"} className="gap-1" onClick={() => setEntryForm(p => ({ ...p, tipo: "receita", categoria: "" }))}>
                <TrendingUp className="w-4 h-4" /> Receita
              </Button>
              <Button variant={entryForm.tipo === "despesa" ? "destructive" : "outline"} className="gap-1" onClick={() => setEntryForm(p => ({ ...p, tipo: "despesa", categoria: "" }))}>
                <TrendingDown className="w-4 h-4" /> Despesa
              </Button>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={entryForm.categoria} onValueChange={(v) => setEntryForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(entryForm.tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Descrição</Label><Input className="mt-1" value={entryForm.descricao} onChange={(e) => setEntryForm(p => ({ ...p, descricao: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Valor (R$) *</Label><Input type="number" className="mt-1" value={entryForm.valor} onChange={(e) => setEntryForm(p => ({ ...p, valor: e.target.value }))} /></div>
              <div><Label className="text-xs">Data *</Label><Input type="date" className="mt-1" value={entryForm.data} onChange={(e) => setEntryForm(p => ({ ...p, data: e.target.value }))} /></div>
            </div>
            <div>
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={entryForm.forma_pagamento} onValueChange={(v) => setEntryForm(p => ({ ...p, forma_pagamento: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS_PGTO.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Observações</Label><Textarea className="mt-1" rows={2} value={entryForm.observacoes} onChange={(e) => setEntryForm(p => ({ ...p, observacoes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleSaveEntry}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Sangria */}
      <Dialog open={dialog === "sangria"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowDownCircle className="w-5 h-5 text-orange-600" /> Sangria de Caixa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-700">
              Registro de retirada de valores do caixa físico.
            </div>
            <div><Label className="text-xs">Valor (R$) *</Label><Input type="number" className="mt-1" value={sangriaForm.valor} onChange={e => setSangriaForm(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" /></div>
            <div>
              <Label className="text-xs">Motivo *</Label>
              <Select value={sangriaForm.motivo} onValueChange={v => setSangriaForm(p => ({ ...p, motivo: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
                <SelectContent>{MOTIVOS_SANGRIA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Responsável</Label><Input className="mt-1" value={sangriaForm.responsavel} onChange={e => setSangriaForm(p => ({ ...p, responsavel: e.target.value }))} placeholder={currentUser?.full_name || "Nome..."} /></div>
            <div><Label className="text-xs">Observações</Label><Textarea className="mt-1" rows={2} value={sangriaForm.observacoes} onChange={e => setSangriaForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Detalhe a retirada..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={handleSaveSangria}>Registrar Sangria</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Suprimento */}
      <Dialog open={dialog === "suprimento"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowUpCircle className="w-5 h-5 text-blue-600" /> Suprimento de Caixa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
              Adição de valores ao caixa físico (reforço, troco inicial, etc.).
            </div>
            <div><Label className="text-xs">Valor (R$) *</Label><Input type="number" className="mt-1" value={suprimentoForm.valor} onChange={e => setSuprimentoForm(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" /></div>
            <div>
              <Label className="text-xs">Origem *</Label>
              <Select value={suprimentoForm.origem} onValueChange={v => setSuprimentoForm(p => ({ ...p, origem: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a origem..." /></SelectTrigger>
                <SelectContent>{ORIGENS_SUPRIMENTO.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Responsável</Label><Input className="mt-1" value={suprimentoForm.responsavel} onChange={e => setSuprimentoForm(p => ({ ...p, responsavel: e.target.value }))} placeholder={currentUser?.full_name || "Nome..."} /></div>
            <div><Label className="text-xs">Observações</Label><Textarea className="mt-1" rows={2} value={suprimentoForm.observacoes} onChange={e => setSuprimentoForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Detalhe o suprimento..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSaveSuprimento}>Registrar Suprimento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Open Cash */}
      <Dialog open={dialog === "open_cash"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Abrir Caixa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Responsável *</Label><Input className="mt-1" value={cashForm.responsavel} onChange={(e) => setCashForm(p => ({ ...p, responsavel: e.target.value }))} /></div>
            <div><Label className="text-xs">Valor Inicial (R$) *</Label><Input type="number" className="mt-1" value={cashForm.valor_inicial} onChange={(e) => setCashForm(p => ({ ...p, valor_inicial: e.target.value }))} /></div>
            <div><Label className="text-xs">Observações</Label><Textarea className="mt-1" rows={2} value={cashForm.observacoes} onChange={(e) => setCashForm(p => ({ ...p, observacoes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleOpenCash}>Abrir Caixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Close Cash */}
      <Dialog open={dialog === "close_cash"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Fechar Caixa</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja fechar o caixa atual? Isso irá consolidar todos os lançamentos.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleCloseCash}>Fechar Caixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reject Payment */}
      <Dialog open={dialog === "reject"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rejeitar Pagamento</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs">Motivo da rejeição</Label>
            <Textarea className="mt-1" rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Explique o motivo..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => handleApprovePayment(selectedRequest, false)}>Confirmar Rejeição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Solicitar edição de lançamento */}
      {editRequestEntry && (
        <RequestEditDialog
          open={!!editRequestEntry}
          onClose={() => setEditRequestEntry(null)}
          entry={editRequestEntry}
          currentUser={currentUser}
          onRequested={loadData}
        />
      )}

      {/* Admin: aprovar/rejeitar/editar lançamento */}
      {approveEditEntry && (
        <ApproveEditDialog
          open={!!approveEditEntry}
          onClose={() => setApproveEditEntry(null)}
          entry={approveEditEntry}
          currentUser={currentUser}
          onDone={loadData}
        />
      )}
    </div>
  );
}