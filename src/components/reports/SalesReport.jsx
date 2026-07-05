import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, ShoppingCart, DollarSign } from "lucide-react";
import { format, parseISO, isWithinInterval } from "date-fns";
import jsPDF from "jspdf";

const FORMA_LABEL = {
  dinheiro: "Dinheiro", pix: "PIX",
  cartao_debito: "Cartão Débito", cartao_credito: "Cartão Crédito", boleto: "Boleto"
};
const STATUS_LABEL = {
  aguardando_aprovacao: "Ag. Aprovação", aprovado: "Aprovado", cancelado: "Cancelado"
};

export default function SalesReport({ sales, products }) {
  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [prodFilter, setProdFilter] = useState("todos");
  const [clientSearch, setClientSearch] = useState("");
  const [formaFilter, setFormaFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("aprovado");

  const productMap = useMemo(() => {
    const map = {};
    (products || []).forEach(p => { map[p.id] = p; });
    return map;
  }, [products]);

  const inRange = (dateStr) => {
    if (!dateStr) return true;
    if (!dateFrom && !dateTo) return true;
    try {
      const d = parseISO(dateStr.slice(0, 10));
      if (dateFrom && dateTo) return isWithinInterval(d, { start: parseISO(dateFrom), end: parseISO(dateTo) });
      if (dateFrom) return d >= parseISO(dateFrom);
      if (dateTo) return d <= parseISO(dateTo);
    } catch { return true; }
    return true;
  };

  const filtered = useMemo(() => {
    return (sales || []).filter(s => {
      if (!inRange(s.created_date)) return false;
      if (statusFilter !== "todos" && s.status !== statusFilter) return false;
      if (formaFilter !== "todos" && s.forma_pagamento !== formaFilter) return false;
      if (clientSearch && !(s.client_nome || "").toLowerCase().includes(clientSearch.toLowerCase())) return false;
      if (prodFilter !== "todos") {
        const hasProduct = (s.itens || []).some(it => it.produto_id === prodFilter);
        if (!hasProduct) return false;
      }
      return true;
    });
  }, [sales, dateFrom, dateTo, statusFilter, formaFilter, clientSearch, prodFilter]);

  // Build line items with cost/profit
  const lineItems = useMemo(() => {
    const rows = [];
    filtered.forEach(s => {
      (s.itens || []).forEach(item => {
        const prod = productMap[item.produto_id] || {};
        const custo_unit = prod.custo || 0;
        const custo_total = custo_unit * (item.quantidade || 1);
        const receita = item.total || 0;
        const lucro = receita - custo_total;
        const margem = receita > 0 ? (lucro / receita) * 100 : 0;
        rows.push({
          venda_numero: s.numero,
          cliente: s.client_nome,
          produto: item.produto_nome,
          quantidade: item.quantidade || 1,
          valor_unit: item.valor_unitario || 0,
          receita,
          custo_total,
          lucro,
          margem,
          status: s.status,
          data: s.created_date,
          forma: s.forma_pagamento,
        });
      });
    });
    return rows;
  }, [filtered, productMap]);

  const totals = useMemo(() => ({
    vendas: filtered.length,
    receita: lineItems.reduce((s, i) => s + i.receita, 0),
    custo: lineItems.reduce((s, i) => s + i.custo_total, 0),
    lucro: lineItems.reduce((s, i) => s + i.lucro, 0),
    qty: lineItems.reduce((s, i) => s + i.quantidade, 0),
  }), [lineItems]);

  const margemTotal = totals.receita > 0 ? (totals.lucro / totals.receita) * 100 : 0;

  const exportPDF = () => {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(15); doc.setFont("helvetica", "bold");
    doc.text("Relatório de Vendas — Lucratividade", w / 2, 16, { align: "center" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, w / 2, 22, { align: "center" });

    let y = 30;
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(`Total Vendas: ${totals.vendas} | Receita: R$ ${totals.receita.toFixed(2)} | Custo: R$ ${totals.custo.toFixed(2)} | Lucro: R$ ${totals.lucro.toFixed(2)} | Margem: ${margemTotal.toFixed(1)}%`, 15, y);
    y += 8;

    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    lineItems.forEach(row => {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.text(`${row.venda_numero || "—"} | ${row.cliente} | ${row.produto} | Qtd: ${row.quantidade} | Rec: R$ ${row.receita.toFixed(2)} | Custo: R$ ${row.custo_total.toFixed(2)} | Lucro: R$ ${row.lucro.toFixed(2)} | Mg: ${row.margem.toFixed(1)}%`, 15, y);
      y += 5;
    });
    doc.save(`vendas_lucro_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const uniqueProducts = useMemo(() => {
    const seen = new Set();
    const list = [];
    (sales || []).forEach(s => (s.itens || []).forEach(it => {
      if (it.produto_id && !seen.has(it.produto_id)) { seen.add(it.produto_id); list.push({ id: it.produto_id, nome: it.produto_nome }); }
    }));
    return list;
  }, [sales]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Cliente</Label>
              <Input placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Produto</Label>
              <Select value={prodFilter} onValueChange={setProdFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {uniqueProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Forma Pgto</Label>
              <Select value={formaFilter} onValueChange={setFormaFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {Object.entries(FORMA_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="aguardando_aprovacao">Ag. Aprovação</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Vendas", val: totals.vendas, unit: "", color: "text-foreground", Ico: ShoppingCart },
          { label: "Receita Total", val: totals.receita, unit: "R$", color: "text-primary", Ico: DollarSign },
          { label: "Custo Total", val: totals.custo, unit: "R$", color: "text-amber-600", Ico: DollarSign },
          { label: "Lucro Total", val: totals.lucro, unit: "R$", color: "text-emerald-600", Ico: TrendingUp },
        ].map(({ label, val, unit, color, Ico }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Ico className="w-3.5 h-3.5" />{label}
              </div>
              <p className={`text-xl font-bold font-heading ${color}`}>
                {unit ? `${unit} ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : val}
              </p>
              {label === "Lucro Total" && (
                <p className="text-xs text-muted-foreground mt-0.5">Margem: {margemTotal.toFixed(1)}%</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-heading">Detalhamento por Item Vendido</CardTitle>
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
            <Download className="w-3.5 h-3.5" /> Exportar PDF
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-semibold">Venda</th>
                  <th className="text-left p-3 font-semibold">Cliente</th>
                  <th className="text-left p-3 font-semibold">Produto</th>
                  <th className="text-right p-3 font-semibold">Qtd</th>
                  <th className="text-right p-3 font-semibold">Receita</th>
                  <th className="text-right p-3 font-semibold text-amber-700">Custo</th>
                  <th className="text-right p-3 font-semibold text-emerald-700">Lucro</th>
                  <th className="text-right p-3 font-semibold">Margem</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((row, i) => (
                  <tr key={i} className="border-b border-dashed hover:bg-muted/20">
                    <td className="p-3 font-medium">{row.venda_numero || "—"}</td>
                    <td className="p-3 text-muted-foreground">{row.cliente}</td>
                    <td className="p-3">{row.produto}</td>
                    <td className="p-3 text-right">{row.quantidade}</td>
                    <td className="p-3 text-right font-medium">R$ {row.receita.toFixed(2)}</td>
                    <td className="p-3 text-right text-amber-700">R$ {row.custo_total.toFixed(2)}</td>
                    <td className={`p-3 text-right font-semibold ${row.lucro >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      R$ {row.lucro.toFixed(2)}
                    </td>
                    <td className="p-3 text-right">{row.margem.toFixed(1)}%</td>
                    <td className="p-3">
                      <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{STATUS_LABEL[row.status] || row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lineItems.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>Nenhuma venda encontrada com os filtros selecionados.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}