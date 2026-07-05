import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle2, Download, FileText, Package, ShoppingCart, ClipboardList, Receipt } from "lucide-react";
import { format, parseISO, isWithinInterval, differenceInDays } from "date-fns";
import jsPDF from "jspdf";
import ReceitasDespesasReport from "../components/reports/ReceitasDespesasReport";
import SalesReport from "../components/reports/SalesReport";
import OSReport from "../components/reports/OSReport";
import BillingNotesReport from "../components/reports/BillingNotesReport";

const COLORS = ["#2563eb", "#f97316", "#10b981", "#ef4444", "#8b5cf6"];

const STATUS_LABELS = {
  rascunho: "Rascunho", em_transito: "Em Trânsito", na_obra: "Na Obra",
  aguardando_recolha: "Ag. Recolha", devolvido_parcial: "Dev. Parcial",
  devolvido_pendente: "Dev. Pendente", finalizado: "Finalizado", cancelado: "Cancelado",
};

export default function Reports() {
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [cashEntries, setCashEntries] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [vehicleExpenses, setVehicleExpenses] = useState([]);
  const [billingNotes, setBillingNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  // Contract tempo ativo filter
  const [tempoAtivoFilter, setTempoAtivoFilter] = useState("");
  const [contratosSemNota, setContratosSemNota] = useState(false);

  // Filters — padrão: hoje
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [finFilter, setFinFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");

  // Equipment report filters — padrão: hoje
  const [eqSearch, setEqSearch] = useState("");
  const [eqClientSearch, setEqClientSearch] = useState("");
  const [eqDateFrom, setEqDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [eqDateTo, setEqDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [eqGroupBy, setEqGroupBy] = useState("equipamento");

  useEffect(() => {
    Promise.all([
      base44.entities.Contract.list("-created_date", 1000),
      base44.entities.ServiceOrder.list("-created_date", 1000),
      base44.entities.CashEntry.list("-created_date", 1000),
      base44.entities.Equipment.list("-created_date", 500),
      base44.entities.VehicleExpense.list("-data", 500),
      base44.entities.Sale.list("-created_date", 1000),
      base44.entities.Product.list("-created_date", 500),
      base44.entities.BillingNote.list("-created_date", 2000),
    ]).then(([c, o, ce, eq, ve, sl, pr, bn]) => {
      setContracts(c);
      setOrders(o);
      setCashEntries(ce);
      setEquipments(eq);
      setVehicleExpenses(ve);
      setSales(sl);
      setProducts(pr);
      setBillingNotes(bn);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // --- FILTERED DATA ---
  const inRange = (dateStr) => {
    if (!dateStr) return true;
    if (!dateFrom && !dateTo) return true;
    const d = parseISO(dateStr);
    if (dateFrom && dateTo) return isWithinInterval(d, { start: parseISO(dateFrom), end: parseISO(dateTo) });
    if (dateFrom) return d >= parseISO(dateFrom);
    if (dateTo) return d <= parseISO(dateTo);
    return true;
  };

  const today = new Date();

  // Contratos que já têm nota/cobrança vinculada
  const contratosComNota = new Set();
  billingNotes.forEach(n => { (n.contratos_ids || []).forEach(id => contratosComNota.add(id)); });

  const filteredContracts = contracts.filter((c) => {
    if (!inRange(c.data_inicio)) return false;
    if (statusFilter !== "todos" && c.status !== statusFilter) return false;
    if (finFilter !== "todos" && c.status_financeiro !== finFilter) return false;
    if (tempoAtivoFilter) {
      if (!c.data_inicio) return false;
      const dias = differenceInDays(today, parseISO(c.data_inicio));
      if (dias < Number(tempoAtivoFilter)) return false;
    }
    if (contratosSemNota) {
      if (c.status === "cancelado") return false;
      if (contratosComNota.has(c.id)) return false;
    }
    return true;
  });

  const filteredOrders = orders.filter((o) => {
    if (!inRange(o.data_entrega || o.created_date)) return false;
    if (finFilter === "pago" && o.status_pagamento !== "pago") return false;
    if (finFilter === "pendente" && o.status_pagamento !== "pendente") return false;
    return true;
  });

  const filteredEntries = cashEntries.filter((e) => inRange(e.data));

  // Summaries
  const contratsTotal = filteredContracts.reduce((s, c) => s + (c.valor_total || 0), 0);
  const contratsPago = filteredContracts.reduce((s, c) => s + (c.valor_pago || 0) + (c.sinal || 0), 0);
  const contratsReceber = filteredContracts.reduce((s, c) => s + (c.saldo_pagar || 0), 0);

  const totalEntradas = filteredEntries.filter((e) => e.tipo === "receita").reduce((s, e) => s + (e.valor || 0), 0);
  const totalSaidas = filteredEntries.filter((e) => e.tipo === "despesa").reduce((s, e) => s + (e.valor || 0), 0);

  const statusCount = {};
  filteredContracts.forEach((c) => { const s = c.status || "rascunho"; statusCount[s] = (statusCount[s] || 0) + 1; });
  const pieData = Object.entries(statusCount).map(([key, value]) => ({ name: STATUS_LABELS[key] || key, value }));

  const finStatusData = {};
  filteredContracts.forEach((c) => {
    const s = c.status_financeiro || "pendente";
    finStatusData[s] = (finStatusData[s] || 0) + (c.valor_total || 0);
  });
  const barData = Object.entries(finStatusData).map(([key, value]) => ({
    name: key === "pago" ? "Pago" : key === "parcial" ? "Parcial" : "Pendente", valor: value,
  }));

  // --- EQUIPMENT REPORT ---
  const allRentedItems = [];
  contracts.forEach((c) => {
    if (!c.itens?.length) return;
    const inEqRange = (str) => {
      if (!str || (!eqDateFrom && !eqDateTo)) return true;
      const d = parseISO(str);
      if (eqDateFrom && eqDateTo) return isWithinInterval(d, { start: parseISO(eqDateFrom), end: parseISO(eqDateTo) });
      if (eqDateFrom) return d >= parseISO(eqDateFrom);
      if (eqDateTo) return d <= parseISO(eqDateTo);
      return true;
    };
    if (!inEqRange(c.data_inicio)) return;

    c.itens.forEach((item) => {
      if (!item.equipamento_id) return;
      const matchEq = !eqSearch || (item.equipamento_nome || "").toLowerCase().includes(eqSearch.toLowerCase());
      const matchClient = !eqClientSearch || (c.client_nome || "").toLowerCase().includes(eqClientSearch.toLowerCase());
      if (!matchEq || !matchClient) return;
      allRentedItems.push({
        equipamento: item.equipamento_nome || "—",
        equipamento_id: item.equipamento_id,
        cliente: c.client_nome || "—",
        contrato: c.numero || c.id?.slice(-6),
        quantidade: item.quantidade_retirada || 0,
        data_inicio: c.data_inicio,
        data_fim: c.data_prevista_termino,
        status: c.status,
        valor: (item.quantidade_retirada || 0) * (item.valor_unitario || 0) - (item.desconto || 0),
      });
    });
  });

  // Group by
  const grouped = {};
  allRentedItems.forEach((item) => {
    const key = eqGroupBy === "cliente" ? item.cliente : item.equipamento;
    if (!grouped[key]) grouped[key] = { key, items: [], total: 0, totalQty: 0 };
    grouped[key].items.push(item);
    grouped[key].total += item.valor;
    grouped[key].totalQty += item.quantidade;
  });
  const groupedArray = Object.values(grouped).sort((a, b) => b.total - a.total);

  const exportEquipPDF = () => {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Equipamentos Alugados", w / 2, 18, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, w / 2, 25, { align: "center" });

    let y = 35;
    groupedArray.forEach((group) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(group.key, 15, y);
      doc.text(`Total: R$ ${group.total.toFixed(2)} | Qtd: ${group.totalQty}`, w - 15, y, { align: "right" });
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      group.items.forEach((item) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const line = `  • ${item.equipamento} — Cliente: ${item.cliente} — Contrato: ${item.contrato} — Qtd: ${item.quantidade} — R$ ${item.valor.toFixed(2)}`;
        doc.text(line, 15, y);
        y += 4;
      });
      y += 3;
    });

    doc.save(`relatorio_equipamentos_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const exportContractsPDF = () => {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Contratos", w / 2, 18, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Período: ${dateFrom || "—"} a ${dateTo || "—"}   |   Gerado em ${format(new Date(), "dd/MM/yyyy")}`, w / 2, 25, { align: "center" });

    let y = 35;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total: R$ ${contratsTotal.toFixed(2)}  |  Recebido: R$ ${contratsPago.toFixed(2)}  |  A Receber: R$ ${contratsReceber.toFixed(2)}`, w / 2, y, { align: "center" });
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    filteredContracts.forEach((c) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`#${c.numero || "—"} — ${c.client_nome} — R$ ${(c.valor_total || 0).toFixed(2)} — ${STATUS_LABELS[c.status] || c.status}`, 15, y);
      y += 5;
    });
    doc.save(`contratos_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Análise financeira e operacional" />

      <Tabs defaultValue="financeiro">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="financeiro" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" />Financeiro</TabsTrigger>
          <TabsTrigger value="receitas_despesas" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Receitas x Despesas</TabsTrigger>
          <TabsTrigger value="contratos" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Contratos</TabsTrigger>
          <TabsTrigger value="os" className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" />OS</TabsTrigger>
          <TabsTrigger value="vendas" className="gap-1.5"><ShoppingCart className="w-3.5 h-3.5" />Vendas/Lucro</TabsTrigger>
          <TabsTrigger value="equipamentos" className="gap-1.5"><Package className="w-3.5 h-3.5" />Equipamentos Alugados</TabsTrigger>
          <TabsTrigger value="notas_cobrancas" className="gap-1.5"><Receipt className="w-3.5 h-3.5" />Notas/Cobranças</TabsTrigger>
        </TabsList>

        {/* ---- FINANCEIRO ---- */}
        <TabsContent value="financeiro">
          {/* Filters */}
          <Card className="border-0 shadow-sm mb-6">
            <CardContent className="pt-5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs">Data Inicial</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Data Final</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Status Contrato</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status Financeiro</Label>
                  <Select value={finFilter} onValueChange={setFinFilter}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><DollarSign className="w-3.5 h-3.5" />Total Contratos</div>
                <p className="text-2xl font-bold font-heading">R$ {contratsTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground mt-1">{filteredContracts.length} contratos</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Recebido</div>
                <p className="text-2xl font-bold font-heading text-emerald-600">R$ {contratsPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" />A Receber</div>
                <p className="text-2xl font-bold font-heading text-amber-600">R$ {contratsReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingUp className="w-3.5 h-3.5 text-secondary" />Caixa (período)</div>
                <p className="text-lg font-bold text-emerald-600">+ R$ {totalEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-destructive">− R$ {totalSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-heading">Financeiro por Status</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 88%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    <Bar dataKey="valor" fill="hsl(217 72% 42%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-heading">Contratos por Status</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- RECEITAS X DESPESAS ---- */}
        <TabsContent value="receitas_despesas">
          <ReceitasDespesasReport
            cashEntries={cashEntries}
            contracts={contracts}
            orders={orders}
            vehicleExpenses={vehicleExpenses}
          />
        </TabsContent>

        {/* ---- CONTRATOS ---- */}
        <TabsContent value="contratos">
          <Card className="border-0 shadow-sm mb-4">
            <CardContent className="pt-5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label className="text-xs">Data Inicial</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Data Final</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Financeiro</Label>
                  <Select value={finFilter} onValueChange={setFinFilter}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Tempo Ativo mínimo (dias)</Label>
                <div className="flex gap-2 mt-1">
                  <Input type="number" min="0" placeholder="Ex: 30" value={tempoAtivoFilter}
                    onChange={e => setTempoAtivoFilter(e.target.value)} className="w-32" />
                  <Select value={tempoAtivoFilter} onValueChange={setTempoAtivoFilter}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Atalhos..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Sem filtro</SelectItem>
                      <SelectItem value="20">+ 20 dias</SelectItem>
                      <SelectItem value="30">+ 30 dias</SelectItem>
                      <SelectItem value="60">+ 2 meses</SelectItem>
                      <SelectItem value="90">+ 3 meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={contratosSemNota}
                    onChange={e => setContratosSemNota(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <span className="text-sm font-medium">Apenas contratos sem nota/cobrança</span>
                </label>
              </div>
              <div className="flex items-center justify-between mt-4">
               <p className="text-sm text-muted-foreground">{filteredContracts.length} contrato(s) encontrado(s)</p>
               <Button variant="outline" size="sm" onClick={exportContractsPDF} className="gap-2">
                 <Download className="w-3.5 h-3.5" /> Exportar PDF
               </Button>
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "Total", val: contratsTotal, color: "text-foreground" },
              { label: "Recebido", val: contratsPago, color: "text-emerald-600" },
              { label: "A Receber", val: contratsReceber, color: "text-amber-600" },
            ].map(({ label, val, color }) => (
              <Card key={label} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold font-heading ${color}`}>R$ {val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                     <th className="text-left p-3 text-xs font-semibold">Contrato</th>
                     <th className="text-left p-3 text-xs font-semibold">Cliente</th>
                     <th className="text-left p-3 text-xs font-semibold">Início</th>
                     <th className="text-center p-3 text-xs font-semibold">Dias Ativo</th>
                     <th className="text-left p-3 text-xs font-semibold">Status</th>
                     <th className="text-right p-3 text-xs font-semibold">Total</th>
                     <th className="text-right p-3 text-xs font-semibold">Saldo</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredContracts.map((c) => {
                     const dias = c.data_inicio ? differenceInDays(today, parseISO(c.data_inicio)) : null;
                     return (
                     <tr key={c.id} className="border-b border-dashed hover:bg-muted/20">
                       <td className="p-3 font-medium">#{c.numero || "—"}</td>
                       <td className="p-3 text-muted-foreground">{c.client_nome}</td>
                       <td className="p-3 text-muted-foreground">{c.data_inicio ? format(parseISO(c.data_inicio), "dd/MM/yyyy") : "—"}</td>
                       <td className={`p-3 text-center font-medium ${dias > 30 ? "text-amber-600" : ""}`}>{dias ?? "—"}</td>
                       <td className="p-3"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{STATUS_LABELS[c.status] || c.status}</span></td>
                       <td className="p-3 text-right font-medium">R$ {(c.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                       <td className={`p-3 text-right font-medium ${(c.saldo_pagar || 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                         R$ {(c.saldo_pagar || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                       </td>
                     </tr>
                    );})}
                  </tbody>
                </table>
                {filteredContracts.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground text-sm">Nenhum contrato encontrado com os filtros selecionados.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- OS ---- */}
        <TabsContent value="os">
          <OSReport orders={orders} billingNotes={billingNotes} />
        </TabsContent>

        {/* ---- VENDAS / LUCRO ---- */}
        <TabsContent value="vendas">
          <SalesReport sales={sales} products={products} />
        </TabsContent>

        {/* ---- EQUIPAMENTOS ALUGADOS ---- */}
        <TabsContent value="equipamentos">
          <Card className="border-0 shadow-sm mb-4">
            <CardContent className="pt-5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label className="text-xs">Equipamento</Label>
                  <Input placeholder="Buscar por nome..." value={eqSearch} onChange={(e) => setEqSearch(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Cliente</Label>
                  <Input placeholder="Buscar por cliente..." value={eqClientSearch} onChange={(e) => setEqClientSearch(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Data Início (de)</Label>
                  <Input type="date" value={eqDateFrom} onChange={(e) => setEqDateFrom(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Data Início (até)</Label>
                  <Input type="date" value={eqDateTo} onChange={(e) => setEqDateTo(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Label className="text-xs">Agrupar por:</Label>
                  <div className="flex gap-2">
                    {[{ k: "equipamento", l: "Equipamento" }, { k: "cliente", l: "Cliente" }].map(({ k, l }) => (
                      <button key={k} onClick={() => setEqGroupBy(k)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${eqGroupBy === k ? "bg-primary text-white border-primary" : "border-border hover:border-primary/40"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{allRentedItems.length} item(ns)</span>
                </div>
                <Button variant="outline" size="sm" onClick={exportEquipPDF} className="gap-2">
                  <Download className="w-3.5 h-3.5" /> Exportar PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total de Itens</p>
                <p className="text-2xl font-bold font-heading">{allRentedItems.length}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Qtd Total Alugada</p>
                <p className="text-2xl font-bold font-heading">{allRentedItems.reduce((s, i) => s + i.quantidade, 0)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold font-heading text-primary">
                  R$ {allRentedItems.reduce((s, i) => s + i.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {groupedArray.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p>Nenhum equipamento alugado encontrado com os filtros selecionados.</p>
                </CardContent>
              </Card>
            )}
            {groupedArray.map((group) => (
              <Card key={group.key} className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-heading">{group.key}</CardTitle>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Qtd: <strong>{group.totalQty}</strong></span>
                      <span>R$ <strong>{group.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1.5">Equipamento</th>
                        <th className="text-left py-1.5">Cliente</th>
                        <th className="text-left py-1.5">Contrato</th>
                        <th className="text-right py-1.5">Qtd</th>
                        <th className="text-left py-1.5 pl-4">Início</th>
                        <th className="text-left py-1.5">Fim</th>
                        <th className="text-left py-1.5">Status</th>
                        <th className="text-right py-1.5">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item, i) => (
                        <tr key={i} className="border-b border-dashed last:border-0 hover:bg-muted/20">
                          <td className="py-1.5 font-medium">{item.equipamento}</td>
                          <td className="py-1.5 text-muted-foreground">{item.cliente}</td>
                          <td className="py-1.5">#{item.contrato}</td>
                          <td className="py-1.5 text-right">{item.quantidade}</td>
                          <td className="py-1.5 pl-4">{item.data_inicio ? format(parseISO(item.data_inicio), "dd/MM/yy") : "—"}</td>
                          <td className="py-1.5">{item.data_fim ? format(parseISO(item.data_fim), "dd/MM/yy") : "—"}</td>
                          <td className="py-1.5">
                            <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{STATUS_LABELS[item.status] || item.status}</span>
                          </td>
                          <td className="py-1.5 text-right font-medium">R$ {item.valor.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        {/* ---- NOTAS / COBRANÇAS ---- */}
        <TabsContent value="notas_cobrancas">
          <BillingNotesReport billingNotes={billingNotes} />
        </TabsContent>

      </Tabs>
    </div>
  );
}