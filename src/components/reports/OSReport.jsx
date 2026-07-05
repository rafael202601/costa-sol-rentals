import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Package } from "lucide-react";
import { format, parseISO, differenceInDays, isWithinInterval } from "date-fns";
import jsPDF from "jspdf";

const STATUS_LABELS = {
  pendente: "Pendente", em_transito: "Em Trânsito", entregue: "Entregue",
  aguardando_recolha: "Ag. Recolha", recolhida: "Recolhida",
  finalizada: "Finalizada", cancelada: "Cancelada"
};

export default function OSReport({ orders, billingNotes = [] }) {
  // Marca quais OS IDs já têm nota gerada
  const osComNota = new Set();
  billingNotes.forEach(n => {
    (n.os_ids || []).forEach(id => osComNota.add(id));
  });
  const ordersEnriched = (orders || []).map(o => ({ ...o, _temNota: osComNota.has(o.id) }));

  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("todos");
  const [pagtoFilter, setPagtoFilter] = useState("todos");
  const [clientSearch, setClientSearch] = useState("");
  const [tempoAbertoMin, setTempoAbertoMin] = useState("");
  const [semNota, setSemNota] = useState(false);

  const today = new Date();

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
    return ordersEnriched.filter(o => {
      if (!inRange(o.data_entrega || o.created_date)) return false;
      if (statusFilter !== "todos" && o.status !== statusFilter) return false;
      if (pagtoFilter !== "todos" && o.status_pagamento !== pagtoFilter) return false;
      if (clientSearch && !(o.client_nome || "").toLowerCase().includes(clientSearch.toLowerCase())) return false;
      if (tempoAbertoMin) {
        const dataBase = o.created_date || o.data_entrega;
        if (!dataBase) return false;
        const dias = differenceInDays(today, parseISO(dataBase.slice(0, 10)));
        if (dias < Number(tempoAbertoMin)) return false;
      }
      if (semNota && o.status === "cancelada") return false;
      if (semNota && o._temNota) return false;
      return true;
    });
  }, [orders, dateFrom, dateTo, statusFilter, pagtoFilter, clientSearch, tempoAbertoMin, semNota]);

  const totalValor = filtered.reduce((s, o) => s + (o.valor || 0), 0);
  const totalPago = filtered.filter(o => o.status_pagamento === "pago").reduce((s, o) => s + (o.valor || 0), 0);
  const totalPendente = totalValor - totalPago;

  const exportPDF = () => {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("Relatório de Ordens de Serviço", w / 2, 16, { align: "center" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, w / 2, 22, { align: "center" });

    let y = 30;
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(`Total: ${filtered.length} OS | Valor: R$ ${totalValor.toFixed(2)} | Pago: R$ ${totalPago.toFixed(2)} | Pendente: R$ ${totalPendente.toFixed(2)}`, 15, y);
    y += 8;

    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    filtered.forEach(o => {
      if (y > 270) { doc.addPage(); y = 15; }
      const dias = o.created_date ? differenceInDays(today, parseISO(o.created_date.slice(0, 10))) : "—";
      doc.text(`${o.numero || "—"} | ${o.client_nome} | ${STATUS_LABELS[o.status] || o.status} | Pgto: ${o.status_pagamento || "—"} | ${dias} dias | R$ ${(o.valor || 0).toFixed(2)}`, 15, y);
      y += 5;
    });
    doc.save(`os_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

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
              <Label className="text-xs">Pagamento</Label>
              <Select value={pagtoFilter} onValueChange={setPagtoFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cliente</Label>
              <Input placeholder="Buscar..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Abertas há + de (dias)</Label>
              <Input type="number" min="0" placeholder="Ex: 30" value={tempoAbertoMin}
                onChange={e => setTempoAbertoMin(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={semNota}
                  onChange={e => setSemNota(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-sm font-medium">Apenas sem nota</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total de OS", val: filtered.length, isMoney: false, color: "text-foreground" },
          { label: "Valor Total", val: totalValor, isMoney: true, color: "text-primary" },
          { label: "Pendente Pgto", val: totalPendente, isMoney: true, color: "text-amber-600" },
        ].map(({ label, val, isMoney, color }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-xl font-bold font-heading ${color}`}>
                {isMoney ? `R$ ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : val}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-heading">{filtered.length} OS encontrada(s)</CardTitle>
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
            <Download className="w-3.5 h-3.5" /> Exportar PDF
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 text-xs font-semibold">OS</th>
                  <th className="text-left p-3 text-xs font-semibold">Cliente</th>
                  <th className="text-left p-3 text-xs font-semibold">Local</th>
                  <th className="text-left p-3 text-xs font-semibold">Status</th>
                  <th className="text-center p-3 text-xs font-semibold">Pgto</th>
                  <th className="text-right p-3 text-xs font-semibold">Dias aberto</th>
                  <th className="text-right p-3 text-xs font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const dias = o.created_date ? differenceInDays(today, parseISO(o.created_date.slice(0, 10))) : null;
                  return (
                    <tr key={o.id} className="border-b border-dashed hover:bg-muted/20">
                      <td className="p-3 font-medium">#{o.numero || "—"}</td>
                      <td className="p-3 text-muted-foreground">{o.client_nome}</td>
                      <td className="p-3 text-muted-foreground text-xs">{o.local_entrega}</td>
                      <td className="p-3">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{STATUS_LABELS[o.status] || o.status}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.status_pagamento === "pago" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {o.status_pagamento === "pago" ? "Pago" : "Pendente"}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-medium ${dias > 30 ? "text-red-500" : ""}`}>{dias ?? "—"}</td>
                      <td className="p-3 text-right font-medium">R$ {(o.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>Nenhuma OS encontrada.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}