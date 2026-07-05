import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, TrendingDown, DollarSign, X, Filter } from "lucide-react";
import { format, parseISO, isWithinInterval } from "date-fns";
import jsPDF from "jspdf";
import { cn } from "@/lib/utils";

const FORMA_PAG_LABELS = {
  pix: "PIX", dinheiro: "Dinheiro", cartao_debito: "Cartão Débito",
  cartao_credito: "Cartão Crédito", transferencia: "Transferência", boleto: "Boleto", outro: "Outro",
};
const ORIGEM_LABELS = {
  manual: "Caixa Manual", contrato: "Contrato", os: "Ordem de Serviço",
  portal_cliente: "Portal do Cliente", venda: "Venda Balcão",
  sangria: "Sangria", suprimento: "Suprimento",
};

function inRange(dateStr, from, to) {
  if (!dateStr) return true;
  if (!from && !to) return true;
  const d = parseISO(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  if (from && to) return isWithinInterval(d, { start: parseISO(from + "T00:00:00"), end: parseISO(to + "T23:59:59") });
  if (from) return d >= parseISO(from + "T00:00:00");
  if (to) return d <= parseISO(to + "T23:59:59");
  return true;
}

const fmtBRL = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function ReceitasDespesasReport({ cashEntries = [], vehicleExpenses = [] }) {
  const [tipoRel, setTipoRel] = useState("ambos");
  const [origemFilter, setOrigemFilter] = useState("todos");
  const [formaFilter, setFormaFilter] = useState("todos");
  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [clienteFilter, setClienteFilter] = useState("");
  const [contratoFilter, setContratoFilter] = useState("");
  const [usuarioFilter, setUsuarioFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const allLines = useMemo(() => {
    const lines = [];
    cashEntries.filter(e => e.status !== "cancelado").forEach(e => {
      lines.push({
        id: e.id,
        data: e.data,
        hora: e.hora || "",
        tipo: e.tipo === "receita" ? "receita" : e.tipo === "sangria" ? "sangria" : e.tipo === "suprimento" ? "suprimento" : "despesa",
        origem: e.origem || "manual",
        origem_label: ORIGEM_LABELS[e.origem] || "Caixa",
        cliente: e.client_nome || "—",
        contrato: e.origem_numero || "—",
        descricao: e.descricao || e.motivo || e.categoria || "—",
        forma_pagamento: e.forma_pagamento || "—",
        forma_label: FORMA_PAG_LABELS[e.forma_pagamento] || e.forma_pagamento || "—",
        valor: e.valor || 0,
        categoria: e.categoria || "",
        usuario: e.usuario_nome || e.responsavel || e.usuario || "—",
      });
    });
    vehicleExpenses.forEach(e => {
      lines.push({
        id: "ve_" + e.id, data: e.data, hora: "",
        tipo: "despesa", origem: "veiculo", origem_label: "Veículo",
        cliente: e.vehicle_placa || "—", contrato: "—",
        descricao: `${e.tipo === "combustivel" ? "Combustível" : e.tipo} — ${e.vehicle_modelo || ""}${e.descricao ? " — " + e.descricao : ""}`,
        forma_pagamento: "—", forma_label: "—", valor: e.valor || 0, categoria: e.tipo || "",
        usuario: "—",
      });
    });
    return lines.sort((a, b) => {
      const da = (a.data || "") + (a.hora || "");
      const db = (b.data || "") + (b.hora || "");
      return db.localeCompare(da);
    });
  }, [cashEntries, vehicleExpenses]);

  const filtered = useMemo(() => {
    return allLines.filter(l => {
      if (tipoRel === "receitas" && l.tipo !== "receita" && l.tipo !== "suprimento") return false;
      if (tipoRel === "despesas" && l.tipo !== "despesa" && l.tipo !== "sangria") return false;
      if (origemFilter !== "todos" && l.origem !== origemFilter) return false;
      if (formaFilter !== "todos" && l.forma_pagamento !== formaFilter) return false;
      if (!inRange(l.data, dateFrom, dateTo)) return false;
      if (clienteFilter && !l.cliente.toLowerCase().includes(clienteFilter.toLowerCase())) return false;
      if (contratoFilter && !l.contrato.toLowerCase().includes(contratoFilter.toLowerCase())) return false;
      if (usuarioFilter && !l.usuario.toLowerCase().includes(usuarioFilter.toLowerCase())) return false;
      return true;
    });
  }, [allLines, tipoRel, origemFilter, formaFilter, dateFrom, dateTo, clienteFilter, contratoFilter, usuarioFilter]);

  const totalReceitas = filtered.filter(l => l.tipo === "receita" || l.tipo === "suprimento").reduce((s, l) => s + l.valor, 0);
  const totalDespesas = filtered.filter(l => l.tipo === "despesa" || l.tipo === "sangria").reduce((s, l) => s + l.valor, 0);
  const saldo = totalReceitas - totalDespesas;

  // Agrupamento por forma de pagamento (apenas receitas)
  const byForma = {};
  filtered.filter(l => l.tipo === "receita").forEach(l => {
    if (l.forma_pagamento && l.forma_pagamento !== "—") {
      byForma[l.forma_label] = (byForma[l.forma_label] || 0) + l.valor;
    }
  });

  const byOrigem = {};
  filtered.forEach(l => { byOrigem[l.origem_label] = (byOrigem[l.origem_label] || 0) + l.valor; });

  const hasFilters = tipoRel !== "ambos" || origemFilter !== "todos" || formaFilter !== "todos" || dateFrom || dateTo || clienteFilter || contratoFilter || usuarioFilter;
  const clearFilters = () => {
    setTipoRel("ambos"); setOrigemFilter("todos"); setFormaFilter("todos");
    setDateFrom(""); setDateTo(""); setClienteFilter(""); setContratoFilter(""); setUsuarioFilter("");
  };

  const tipoLabel = (tipo) => {
    if (tipo === "receita") return "Receita";
    if (tipo === "despesa") return "Despesa";
    if (tipo === "sangria") return "Sangria";
    if (tipo === "suprimento") return "Suprimento";
    return tipo;
  };

  // ── PDF LIVRO CAIXA COMPLETO ─────────────────────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 8;

    const drawBorder = () => {
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.rect(margin - 2, margin - 2, w - (margin - 2) * 2, pageH - (margin - 2) * 2, "S");
    };

    drawBorder();

    // ── Cabeçalho ─────────────────────────────────────────────────────────
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("LIVRO CAIXA — RELATÓRIO FINANCEIRO", w / 2, margin + 4, { align: "center" });
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
    const periodoStr = `Período: ${dateFrom ? format(parseISO(dateFrom), "dd/MM/yyyy") : "início"} a ${dateTo ? format(parseISO(dateTo), "dd/MM/yyyy") : "hoje"} | Gerado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
    doc.text(periodoStr, w / 2, margin + 9, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // ── Totais rápidos ────────────────────────────────────────────────────
    let y = margin + 15;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    const totRow = [
      { label: "RECEITAS", value: totalReceitas, color: [16, 150, 100] },
      { label: "DESPESAS", value: totalDespesas, color: [200, 50, 50] },
      { label: "SALDO", value: saldo, color: saldo >= 0 ? [16, 100, 200] : [200, 50, 50] },
    ];
    const boxW = 55;
    totRow.forEach((t, i) => {
      const bx = margin + i * (boxW + 6);
      doc.setDrawColor(...t.color);
      doc.setLineWidth(0.4);
      doc.rect(bx, y - 4, boxW, 10, "S");
      doc.setTextColor(...t.color);
      doc.text(t.label, bx + 3, y + 0.5);
      doc.setFontSize(9);
      doc.text(`R$ ${fmtBRL(t.value)}`, bx + 3, y + 5);
      doc.setFontSize(8);
    });
    doc.setTextColor(0, 0, 0);
    y += 16;

    // ── Cabeçalho da tabela ───────────────────────────────────────────────
    const cols = [
      { label: "Data/Hora",   x: margin,       w: 22 },
      { label: "Contrato",    x: margin + 22,  w: 18 },
      { label: "Tipo",        x: margin + 40,  w: 16 },
      { label: "Descrição",   x: margin + 56,  w: 44 },
      { label: "Cliente",     x: margin + 100, w: 40 },
      { label: "Forma Pag.",  x: margin + 140, w: 24 },
      { label: "Usuário",     x: margin + 164, w: 24 },
      { label: "Crédito",     x: margin + 188, w: 26, align: "right" },
      { label: "Débito",      x: margin + 214, w: 24, align: "right" },
    ];

    doc.setFillColor(235, 235, 235);
    doc.rect(margin, y - 3.5, w - margin * 2, 5.5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
    cols.forEach(c => {
      if (c.align === "right") doc.text(c.label, c.x + c.w, y, { align: "right" });
      else doc.text(c.label, c.x, y);
    });
    y += 3;
    doc.setLineWidth(0.3); doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, w - margin, y);
    y += 3;

    // ── Linhas da tabela ──────────────────────────────────────────────────
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);

    filtered.forEach((l, idx) => {
      if (y > pageH - 30) {
        doc.addPage();
        drawBorder();
        y = margin + 4;
        // Repetir cabeçalho
        doc.setFillColor(235, 235, 235);
        doc.rect(margin, y - 3.5, w - margin * 2, 5.5, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
        cols.forEach(c => {
          if (c.align === "right") doc.text(c.label, c.x + c.w, y, { align: "right" });
          else doc.text(c.label, c.x, y);
        });
        y += 3;
        doc.setLineWidth(0.3); doc.setDrawColor(180, 180, 180);
        doc.line(margin, y, w - margin, y);
        y += 3;
        doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
      }

      // Linha alternada sutil
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 3, w - margin * 2, 4.5, "F");
      }

      const isCredito = l.tipo === "receita" || l.tipo === "suprimento";
      const dataStr = l.data ? format(new Date(l.data + "T00:00:00"), "dd/MM/yyyy") : "—";
      const horaStr = l.hora ? ` ${l.hora}` : "";

      doc.setTextColor(60, 60, 60);
      doc.text(`${dataStr}${horaStr}`, cols[0].x, y);
      doc.text((l.contrato || "—").slice(0, 12), cols[1].x, y);

      // Tipo colorido
      if (l.tipo === "receita") doc.setTextColor(16, 130, 80);
      else if (l.tipo === "sangria") doc.setTextColor(180, 90, 0);
      else if (l.tipo === "suprimento") doc.setTextColor(30, 80, 200);
      else doc.setTextColor(180, 50, 50);
      doc.text(tipoLabel(l.tipo), cols[2].x, y);
      doc.setTextColor(60, 60, 60);

      const descTrunc = doc.splitTextToSize(l.descricao || "—", cols[3].w)[0] || "—";
      doc.text(descTrunc, cols[3].x, y);
      const clienteTrunc = doc.splitTextToSize(l.cliente || "—", cols[4].w)[0] || "—";
      doc.text(clienteTrunc, cols[4].x, y);
      doc.text((l.forma_label || "—").slice(0, 12), cols[5].x, y);
      doc.text((l.usuario || "—").slice(0, 12), cols[6].x, y);

      if (isCredito) {
        doc.setTextColor(16, 130, 80);
        doc.text(`R$ ${fmtBRL(l.valor)}`, cols[7].x + cols[7].w, y, { align: "right" });
        doc.setTextColor(60, 60, 60);
        doc.text("—", cols[8].x + cols[8].w, y, { align: "right" });
      } else {
        doc.setTextColor(60, 60, 60);
        doc.text("—", cols[7].x + cols[7].w, y, { align: "right" });
        doc.setTextColor(180, 50, 50);
        doc.text(`R$ ${fmtBRL(l.valor)}`, cols[8].x + cols[8].w, y, { align: "right" });
      }
      doc.setTextColor(0, 0, 0);

      y += 4.5;

      // Linha separadora leve
      doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.1);
      doc.line(margin, y - 0.5, w - margin, y - 0.5);
    });

    // ── Resumo final ──────────────────────────────────────────────────────
    if (y > pageH - 55) { doc.addPage(); drawBorder(); y = margin + 8; }
    y += 6;
    doc.setDrawColor(100, 100, 100); doc.setLineWidth(0.4);
    doc.line(margin, y, w - margin, y);
    y += 6;

    // Resumo por forma de pagamento
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("RESUMO POR FORMA DE PAGAMENTO (RECEITAS)", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    const formaKeys = ["PIX", "Dinheiro", "Cartão Débito", "Cartão Crédito", "Transferência", "Boleto", "Outro"];
    const colsFP = Math.ceil(formaKeys.length / 2);
    formaKeys.forEach((fk, i) => {
      const val = byForma[fk] || 0;
      const col = i % colsFP;
      const row = Math.floor(i / colsFP);
      const fx = margin + col * 65;
      const fy = y + row * 5;
      doc.setTextColor(80, 80, 80);
      doc.text(`${fk}:`, fx, fy);
      doc.setTextColor(16, 100, 40);
      doc.setFont("helvetica", "bold");
      doc.text(`R$ ${fmtBRL(val)}`, fx + 28, fy);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
    });
    y += Math.ceil(formaKeys.length / colsFP) * 5 + 8;

    // Resumo geral
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 120, y);
    y += 5;
    doc.setTextColor(16, 130, 80);
    doc.text(`TOTAL RECEITAS: R$ ${fmtBRL(totalReceitas)}`, margin, y);
    y += 5;
    doc.setTextColor(180, 50, 50);
    doc.text(`TOTAL DESPESAS: R$ ${fmtBRL(totalDespesas)}`, margin, y);
    y += 5;
    doc.setTextColor(saldo >= 0 ? 16 : 200, saldo >= 0 ? 100 : 50, saldo >= 0 ? 200 : 50);
    doc.setFontSize(9);
    doc.text(`SALDO FINAL: R$ ${fmtBRL(saldo)}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 7;

    doc.setFont("helvetica", "normal"); doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} | Sistema de Gestão`, w / 2, pageH - margin, { align: "center" });

    doc.save(`livro_caixa_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const exportCSV = () => {
    const header = ["Data", "Hora", "Tipo", "Origem", "Cliente", "Contrato", "Descrição", "Forma Pagamento", "Usuário", "Crédito", "Débito"];
    const rows = filtered.map(l => {
      const isCredito = l.tipo === "receita" || l.tipo === "suprimento";
      return [
        l.data ? format(new Date(l.data + "T00:00:00"), "dd/MM/yyyy") : "—",
        l.hora || "—", tipoLabel(l.tipo), l.origem_label, l.cliente, l.contrato, l.descricao, l.forma_label, l.usuario,
        isCredito ? l.valor.toFixed(2).replace(".", ",") : "0,00",
        !isCredito ? l.valor.toFixed(2).replace(".", ",") : "0,00",
      ];
    });
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `livro_caixa_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5 space-y-4">
          <div>
            <Label className="text-xs font-semibold">Tipo de Relatório</Label>
            <div className="flex gap-2 mt-2">
              {[
                { v: "receitas", label: "Receitas", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
                { v: "despesas", label: "Despesas", color: "bg-red-100 text-red-700 border-red-300" },
                { v: "ambos", label: "Ambos", color: "bg-primary/10 text-primary border-primary/30" },
              ].map(({ v, label, color }) => (
                <button key={v} onClick={() => setTipoRel(v)}
                  className={cn("px-4 py-1.5 rounded-lg text-sm font-medium border-2 transition-all",
                    tipoRel === v ? color : "border-border hover:border-primary/30 text-muted-foreground bg-background"
                  )}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Data inicial</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Data final</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1" /></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)} className={cn("gap-2", showFilters && "border-primary text-primary")}>
              <Filter className="w-3.5 h-3.5" /> Filtros Avançados
              {hasFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
            </Button>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-destructive hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t">
              <div>
                <Label className="text-xs">Origem</Label>
                <Select value={origemFilter} onValueChange={setOrigemFilter}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {Object.entries(ORIGEM_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    <SelectItem value="veiculo">Veículo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Forma de Pagamento</Label>
                <Select value={formaFilter} onValueChange={setFormaFilter}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {Object.entries(FORMA_PAG_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Cliente</Label><Input placeholder="Buscar cliente..." value={clienteFilter} onChange={e => setClienteFilter(e.target.value)} className="mt-1 h-8 text-xs" /></div>
              <div><Label className="text-xs">Contrato / Ref.</Label><Input placeholder="Nº contrato/OS..." value={contratoFilter} onChange={e => setContratoFilter(e.target.value)} className="mt-1 h-8 text-xs" /></div>
              <div><Label className="text-xs">Usuário</Label><Input placeholder="Nome do usuário..." value={usuarioFilter} onChange={e => setUsuarioFilter(e.target.value)} className="mt-1 h-8 text-xs" /></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Receitas</div>
            <p className="text-xl font-bold font-heading text-emerald-600">R$ {fmtBRL(totalReceitas)}</p>
            <p className="text-xs text-muted-foreground">{filtered.filter(l => l.tipo === "receita" || l.tipo === "suprimento").length} registros</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingDown className="w-3.5 h-3.5 text-red-500" /> Despesas</div>
            <p className="text-xl font-bold font-heading text-red-600">R$ {fmtBRL(totalDespesas)}</p>
            <p className="text-xs text-muted-foreground">{filtered.filter(l => l.tipo === "despesa" || l.tipo === "sangria").length} registros</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><DollarSign className="w-3.5 h-3.5" /> Saldo</div>
            <p className={cn("text-xl font-bold font-heading", saldo >= 0 ? "text-emerald-600" : "text-red-600")}>R$ {fmtBRL(saldo)}</p>
            <p className="text-xs text-muted-foreground">{filtered.length} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Por forma de pagamento */}
      {Object.keys(byForma).length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Por Forma de Pagamento (Receitas)</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              {Object.entries(byForma).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold text-emerald-700">R$ {fmtBRL(v)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Por Origem</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              {Object.entries(byOrigem).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold">R$ {fmtBRL(v)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-heading">{filtered.length} registro(s)</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2"><Download className="w-3.5 h-3.5" /> Excel/CSV</Button>
              <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2"><Download className="w-3.5 h-3.5" /> PDF Livro Caixa</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">Nenhum registro com os filtros selecionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 text-xs font-semibold">Data/Hora</th>
                    <th className="text-left p-3 text-xs font-semibold">Tipo</th>
                    <th className="text-left p-3 text-xs font-semibold">Contrato/Ref</th>
                    <th className="text-left p-3 text-xs font-semibold">Descrição</th>
                    <th className="text-left p-3 text-xs font-semibold">Cliente</th>
                    <th className="text-left p-3 text-xs font-semibold hidden md:table-cell">Forma Pag.</th>
                    <th className="text-left p-3 text-xs font-semibold hidden lg:table-cell">Usuário</th>
                    <th className="text-right p-3 text-xs font-semibold text-emerald-700">Crédito</th>
                    <th className="text-right p-3 text-xs font-semibold text-red-700">Débito</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l, i) => {
                    const isCredito = l.tipo === "receita" || l.tipo === "suprimento";
                    return (
                      <tr key={l.id || i} className="border-b border-dashed hover:bg-muted/20">
                        <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                          {l.data ? format(new Date(l.data + "T00:00:00"), "dd/MM/yyyy") : "—"}
                          {l.hora && <span className="block text-[10px]">{l.hora}</span>}
                        </td>
                        <td className="p-3">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                            l.tipo === "receita" ? "bg-emerald-100 text-emerald-700" :
                            l.tipo === "sangria" ? "bg-orange-100 text-orange-700" :
                            l.tipo === "suprimento" ? "bg-blue-100 text-blue-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {tipoLabel(l.tipo)}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{l.contrato}</td>
                        <td className="p-3 text-xs max-w-[180px] truncate">{l.descricao}</td>
                        <td className="p-3 text-xs">{l.cliente}</td>
                        <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{l.forma_label}</td>
                        <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">{l.usuario}</td>
                        <td className="p-3 text-right text-xs font-bold text-emerald-700">
                          {isCredito ? `R$ ${fmtBRL(l.valor)}` : "—"}
                        </td>
                        <td className="p-3 text-right text-xs font-bold text-red-700">
                          {!isCredito ? `R$ ${fmtBRL(l.valor)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30">
                    <td colSpan={7} className="p-3 text-xs font-bold text-right">TOTAIS:</td>
                    <td className="p-3 text-right text-xs font-bold text-emerald-700">R$ {fmtBRL(totalReceitas)}</td>
                    <td className="p-3 text-right text-xs font-bold text-red-700">R$ {fmtBRL(totalDespesas)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}